import io
import json
import zipfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
import backend.app as api
from backend.store import LocalStore
from backend.scanner import sample_zip, analyze
from backend.guidance import guidance


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db = LocalStore("sqlite:///" + str(tmp_path / "test.sqlite3"))
    monkeypatch.setattr(api, "DB", db)
    api.limits.clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with TestClient(api.app) as c:
        yield c
    db.engine.dispose()


def account(c, email="owner@local.example"):
    r = c.post(
        "/api/auth/signup", json={"email": email, "password": "Test-account-only-135!"}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_auth_lifecycle(client):
    assert client.get("/api/scans").status_code == 401
    h = account(client)
    assert client.get("/api/me", headers=h).json()["email"] == "owner@local.example"
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "owner@local.example", "password": "incorrect"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "owner@local.example", "password": "Test-account-only-135!"},
        ).status_code
        == 200
    )
    with api.DB.engine.connect() as c:
        saved = c.execute(select(api.DB.users.c.password_hash)).scalar()
        assert "Test-account" not in saved
        assert (
            h["Authorization"][7:]
            not in c.execute(select(api.DB.sessions.c.digest)).scalars().all()
        )
    assert client.post("/api/logout", headers=h).status_code == 200
    assert client.get("/api/scans", headers=h).status_code == 401


def test_short_password(client):
    assert (
        client.post(
            "/api/auth/signup", json={"email": "a@b.test", "password": "short"}
        ).status_code
        == 422
    )


def test_archive_limits_and_content_type(client):
    h = account(client)
    assert client.post("/api/scan", headers=h, content=b"not zip").status_code == 415
    assert (
        client.post(
            "/api/scan",
            headers={**h, "Content-Type": "application/zip"},
            content=b"not zip",
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/scan",
            headers={
                **h,
                "Content-Type": "application/zip",
                "Content-Length": str(5 * 1024 * 1024 + 1),
            },
            content=b"x",
        ).status_code
        == 413
    )
    assert client.get("/api/scans", headers=h).json() == []


def test_real_upload_and_per_user_isolation(client):
    h = account(client)
    other = account(client, "second@local.example")
    r = client.post(
        "/api/scan?name=review.zip",
        headers={**h, "Content-Type": "application/zip"},
        content=sample_zip("vulnerable-demo"),
    )
    assert r.status_code == 201, r.text
    scan = r.json()
    assert scan["status"] == "Complete" and len(scan["findings"]) > 0
    assert {e["name"] for e in scan["engines"] if e["count"] > 0} == {
        "Bandit",
        "Semgrep",
        "detect-secrets",
    }
    assert "specimen-only" not in r.text and "hashed_secret" not in r.text
    assert client.get("/api/scans", headers=other).json() == []
    f = scan["findings"][0]
    ask = {"scan_id": scan["id"], "finding_id": f["id"], "intent": "Suggest a fix"}
    triage = {"id": scan["id"], "finding": f["id"], "status": "Resolved"}
    assert client.post("/api/assistant", headers=other, json=ask).status_code == 404
    assert client.put("/api/scans", headers=other, json=triage).status_code == 404
    assert (
        client.request(
            "DELETE", "/api/scans", headers=other, json={"id": scan["id"]}
        ).status_code
        == 404
    )
    advice = client.post("/api/assistant", headers=h, json=ask)
    assert advice.status_code == 200 and "Local rule" in advice.json()["provider"]
    assert client.put("/api/scans", headers=h, json=triage).status_code == 200
    assert (
        client.get("/api/scans", headers=h).json()[0]["triage"][f["id"]] == "Resolved"
    )
    assert (
        client.request(
            "DELETE", "/api/scans", headers=h, json={"id": scan["id"]}
        ).status_code
        == 200
    )
    assert client.get("/api/scans", headers=h).json() == []


def test_secure_demo_real_pipeline(client):
    h = account(client)
    r = client.post("/api/scan/sample/secure-demo", headers=h)
    assert r.status_code == 201
    assert (
        r.json()["status"] == "Complete"
        and r.json()["findings"] == []
        and r.json()["origin"] == "Live sample scan"
    )
    assert client.post("/api/scan/sample/unlisted", headers=h).status_code == 404


def test_source_not_executed(tmp_path):
    marker = tmp_path / "unexpected.txt"
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(
            "sitecustomize.py",
            f'from pathlib import Path\nPath({str(marker)!r}).write_text("test")\n',
        )
    r = analyze(out.getvalue(), "non-execution-check")
    assert r["status"] == "Complete" and not marker.exists()


def test_missing_engine_not_clean(monkeypatch):
    import backend.scanner as scanner

    monkeypatch.setattr(scanner, "executable", lambda _: None)
    r = analyze(sample_zip("secure-demo"), "missing-engines")
    assert r["status"] == "Partial" and all(
        e["status"] == "Unavailable" for e in r["engines"]
    )


def test_cors(client):
    good = client.options(
        "/api/scan",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert good.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options(
        "/api/scan",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in bad.headers


def test_gemini_outage_fallback(monkeypatch):
    import httpx

    def unavailable(*a, **kw):
        raise httpx.ConnectError("offline")

    monkeypatch.setenv("GEMINI_API_KEY", "test-only-not-a-real-key")
    monkeypatch.setattr(httpx, "post", unavailable)
    ans = guidance(
        {"engine": "Bandit", "rule": "B105", "severity": "Low"}, "Suggest a fix"
    )
    assert "Local rule" in ans["provider"] and "secret store" in ans["answer"]


def test_gemini_minimal_metadata(monkeypatch):
    import httpx

    seen = {}

    def stub(url, **kwargs):
        seen.update(kwargs["json"])
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": "Use a secret store."}]},
                    }
                ]
            },
        )

    monkeypatch.setenv("GEMINI_API_KEY", "test-only-not-a-real-key")
    monkeypatch.setattr(httpx, "post", stub)
    r = guidance(
        {
            "engine": "Bandit",
            "rule": "B105",
            "severity": "Low",
            "file": "private-name.py",
            "source": "private-only",
            "email": "private@example.test",
        },
        "Suggest a fix",
    )
    assert "Gemini" in r["provider"]
    assert all(
        marker not in json.dumps(seen)
        for marker in ["private-name.py", "private-only", "private@example.test"]
    )


def test_recorded_provenance():
    import hashlib

    records = api.examples()
    assert len(records) == 2
    for r in records:
        assert r["sha256"] == hashlib.sha256(sample_zip(r["sample"])).hexdigest()
        assert (
            r["origin"] == "Recorded sample"
            and len(r["engines"]) == 3
            and sum(e["count"] for e in r["engines"]) == len(r["findings"])
        )

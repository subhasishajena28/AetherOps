from __future__ import annotations
import json
import os
import re
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from .archive import MAX_ZIP, ArchiveError
from .scanner import analyze, sample_zip, EXAMPLES, ENGINES, executable
from .store import open_local_store
from .guidance import guidance

ROOT = Path(__file__).resolve().parent.parent
MODE = os.getenv("STORAGE_MODE", "sqlite")
if MODE not in ("sqlite", "gateway"):
    raise RuntimeError("Invalid STORAGE_MODE")
DB = open_local_store() if MODE == "sqlite" else None
ORIGINS = [
    x.strip().rstrip("/")
    for x in os.getenv(
        "CORS_ORIGINS",
        "" if MODE == "gateway" else "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if x.strip()
]
if "*" in ORIGINS:
    raise RuntimeError("Set exact frontend origins; wildcards are not accepted.")


def hosted_origin(value: str) -> bool:
    try:
        u = urlsplit(value.rstrip("/"))
        return bool(
            u.scheme == "https"
            and u.hostname
            and u.username is None
            and not (u.path or u.query or u.fragment)
            and "*" not in value
            and not any(c.isspace() for c in value)
            and u.port != 0
        )
    except ValueError:
        return False


if MODE == "gateway" and (not ORIGINS or not all(map(hosted_origin, ORIGINS))):
    raise RuntimeError(
        "Set CORS_ORIGINS to exact HTTPS frontend origins without paths."
    )
if MODE == "gateway" and (
    not os.getenv("SCANNER_GATEWAY_SECRET")
    or not all(hosted_origin(os.getenv(x, "")) for x in ("SUPABASE_URL", "GATEWAY_URL"))
    or not os.getenv("SUPABASE_ANON_KEY")
):
    raise RuntimeError(
        "Hosted mode requires HTTPS gateway and Supabase URLs, anon key, and gateway secret."
    )
app = FastAPI(
    title="AetherOps analysis service",
    version="1.0.0",
    docs_url=None if MODE == "gateway" else "/api/docs",
    redoc_url=None,
)


class BoundedBody:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "DELETE"):
            return await self.app(scope, receive, send)
        from starlette.responses import JSONResponse

        limit = MAX_ZIP if scope["path"] == "/api/scan" else 8192
        headers = dict(scope["headers"])
        if (
            headers.get(b"content-length", b"0").isdigit()
            and int(headers.get(b"content-length", b"0")) > limit
        ):
            return await JSONResponse({"detail": "Request body is too large."}, 413)(
                scope, receive, send
            )
        size = 0

        async def limited():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > limit:
                raise HTTPException(413, "Request body is too large.")
            return message

        return await self.app(scope, limited, send)


app.add_middleware(BoundedBody)
# CORS must also cover early rejection responses from the body-size guard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo invalid credential or source values from Pydantic's input field.
    return JSONResponse(
        {"detail": "Invalid request. Check the required fields and allowed values."},
        status_code=422,
    )


# Single-process bounds are intentional. Deploy one worker per container.
slots = threading.BoundedSemaphore(1)
limits = defaultdict(deque)
limit_lock = threading.Lock()


def rate(key, count, seconds=60):
    with limit_lock:
        now = time.monotonic()
        queue = limits[key]
        while queue and queue[0] < now - seconds:
            queue.popleft()
        if len(queue) >= count:
            raise HTTPException(429, "Rate limit reached. Please try again later.")
        queue.append(now)
        if len(limits) > 4096:
            for k in list(limits):
                if not limits[k] or limits[k][-1] < now - 3600:
                    del limits[k]


def local():
    if DB is None:
        raise HTTPException(404, "Use the hosted authentication or storage gateway.")
    return DB


def bearer(request: Request):
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer ") or len(h) > 8192:
        raise HTTPException(401, "A valid workspace session is required.")
    return h[7:]


def user(t=Depends(bearer)):
    if DB:
        return DB.user(t)
    try:
        r = httpx.get(
            os.environ["SUPABASE_URL"].rstrip("/") + "/auth/v1/user",
            headers={
                "apikey": os.environ["SUPABASE_ANON_KEY"],
                "Authorization": "Bearer " + t,
            },
            timeout=8,
        )
        if r.status_code in (401, 403):
            raise HTTPException(401, "Session expired. Sign in again.")
        r.raise_for_status()
        data = r.json()
        return {"id": data["id"], "email": data.get("email", "")}
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Authentication service unavailable.")


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Model):
    email: str = Field(
        min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    password: str = Field(min_length=1, max_length=128)


class ScanId(Model):
    id: str = Field(min_length=1, max_length=64)


class Triage(ScanId):
    finding: str = Field(max_length=32)
    status: Literal["Open", "In review", "Resolved"]


class Ask(Model):
    scan_id: str = Field(max_length=64)
    finding_id: str = Field(max_length=32)
    intent: Literal["Explain the risk", "Suggest a fix", "Verify remediation"]


@app.get("/health")
def health():
    return {
        "service": "aetherops",
        "storage": MODE,
        "engines": {n: bool(executable(e)) for n, e in ENGINES},
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/api/auth/{mode}")
def auth(mode: Literal["signup", "login"], c: Credentials, request: Request):
    db = local()
    rate("auth:" + str(request.client.host if request.client else "local"), 12)
    if mode == "signup" and len(c.password) < 10:
        raise HTTPException(422, "Use at least 10 characters for the password.")
    return db.auth(c.email, c.password, mode == "signup")


@app.get("/api/me")
def me(u=Depends(user)):
    return u


@app.post("/api/logout")
def logout(t=Depends(bearer), u=Depends(user)):
    local().logout(t)
    return {"ok": True}


@app.get("/api/examples")
def examples():
    return json.loads((ROOT / "public/data/records.json").read_text())


@app.get("/api/scans")
def listing(u=Depends(user)):
    return local().list(u["id"])


@app.put("/api/scans")
def triage(body: Triage, u=Depends(user)):
    local().triage(u["id"], body.id, body.finding, body.status)
    return {"ok": True}


@app.delete("/api/scans")
def remove(body: ScanId, u=Depends(user)):
    local().remove(u["id"], body.id)
    return {"ok": True}


def gateway(method, t, **kwargs):
    try:
        r = httpx.request(
            method,
            os.environ["GATEWAY_URL"].rstrip("/") + "/api/scans",
            headers={
                "Authorization": "Bearer " + t,
                "X-Scanner-Key": os.environ["SCANNER_GATEWAY_SECRET"],
            },
            timeout=18,
            **kwargs,
        )
        if r.status_code == 409:
            raise HTTPException(
                409, "Workspace limit reached. Remove an older scan first."
            )
        r.raise_for_status()
        return r.json()
    except (ValueError, httpx.HTTPError):
        raise HTTPException(
            503, "Workspace storage is unavailable. The operation was not confirmed."
        )


def run(data, project, uid, t, sample=None):
    if not slots.acquire(blocking=False):
        raise HTTPException(
            429, "Analysis engine is busy. Try again after the current scan finishes."
        )
    try:
        r = analyze(
            data,
            project,
            sample=sample,
            origin="Live sample scan" if sample else "Uploaded archive",
        )
        return DB.save(uid, r) if DB else gateway("POST", t, json={"report": r})
    except ArchiveError as e:
        raise HTTPException(400, str(e))
    finally:
        slots.release()


@app.post("/api/scan", status_code=201)
async def scan(
    request: Request,
    name: str = Query(default="project.zip", min_length=1, max_length=110),
    u=Depends(user),
    t=Depends(bearer),
):
    if request.headers.get("content-type", "").split(";")[0] != "application/zip":
        raise HTTPException(
            415, "Send binary ZIP data with Content-Type: application/zip."
        )
    rate("scan:" + u["id"], 8, 600)
    if slots._value == 0:
        raise HTTPException(429, "A scan is already in progress. Try again shortly.")
    data = await request.body()
    project = re.sub("[^a-zA-Z0-9_. -]", "_", Path(name).stem)[:100] or "Python project"
    return await run_in_threadpool(run, data, project, u["id"], t)


@app.post("/api/scan/sample/{sample}", status_code=201)
def scan_sample(sample: str, u=Depends(user), t=Depends(bearer)):
    if sample not in EXAMPLES:
        raise HTTPException(404, "Sample not found.")
    rate("scan:" + u["id"], 8, 600)
    return run(
        sample_zip(sample),
        "Atlas · "
        + ("Secure baseline" if sample == "secure-demo" else "Review sample"),
        u["id"],
        t,
        sample,
    )


@app.post("/api/assistant")
def assistant(body: Ask, u=Depends(user), t=Depends(bearer)):
    rate("guide:" + u["id"], 12, 60)
    report = (
        DB.get(u["id"], body.scan_id)
        if DB
        else next((s for s in gateway("GET", t) if s["id"] == body.scan_id), None)
    )
    if not report:
        raise HTTPException(404, "Scan not found.")
    f = next((f for f in report["findings"] if f["id"] == body.finding_id), None)
    if not f:
        raise HTTPException(404, "Finding not found.")
    return guidance(f, body.intent)

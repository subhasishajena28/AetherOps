"""Finite Chromium acceptance test with the real FastAPI app + a disposable SQLite DB.

Requires Python Playwright and its compatible installed Chromium. No dev server,
external identity provider, paid API, or persistent personal account is used.
"""

import functools
import http.server
import json
import os
import pathlib
import subprocess
import tempfile
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    with tempfile.TemporaryDirectory(prefix="aether-browser-") as tmp:
        tmp = pathlib.Path(tmp)
        dist = tmp / "dist"
        dist.mkdir()
        os.environ.update(
            STORAGE_MODE="sqlite",
            DATABASE_URL="sqlite:///" + str(tmp / "test.db"),
            GEMINI_API_KEY="",
        )
        from fastapi.testclient import TestClient
        from backend.app import app

        api = TestClient(app)

        class TestHTTP(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def api_call(self):
                data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                r = api.request(
                    self.command,
                    self.path,
                    content=data,
                    headers={
                        k: v
                        for k, v in self.headers.items()
                        if k.lower()
                        not in ("host", "accept-encoding", "content-length")
                    },
                )
                self.send_response(r.status_code)
                for k, v in r.headers.items():
                    if k.lower() not in (
                        "content-length",
                        "connection",
                        "content-encoding",
                    ):
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(r.content)))
                self.end_headers()
                self.wfile.write(r.content)

            def do_GET(self):
                if self.path.startswith("/api/"):
                    return self.api_call()
                if urlsplit(self.path).path.split("/")[1] in (
                    "demo",
                    "login",
                    "workspace",
                    "docs",
                ):
                    self.path = "/index.html"
                return super().do_GET()

            do_POST = do_PUT = do_DELETE = api_call

        host = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(TestHTTP, directory=str(dist))
        )
        origin = "http://127.0.0.1:" + str(host.server_port)
        subprocess.run(
            ["npm", "run", "build", "--", "--outDir", str(dist)],
            cwd=ROOT,
            env={**os.environ, "VITE_AUTH_MODE": "local", "VITE_API_URL": origin},
            check=True,
            timeout=100,
        )
        threading.Thread(target=host.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(args=["--no-sandbox"])
                p = browser.new_page(
                    viewport={"width": 1440, "height": 950}, accept_downloads=True
                )
                p.set_default_timeout(15000)
                errors = []
                p.on("pageerror", lambda e: errors.append(str(e)))
                p.goto(origin)
                expect(p.get_by_role("heading", level=1)).to_contain_text("Your code.")
                p.get_by_role("link", name="Explore demo", exact=True).click()
                expect(
                    p.get_by_role("heading", name="Security overview")
                ).to_be_visible()
                p.get_by_role("link", name="Vulnerabilities", exact=True).click()
                p.get_by_label("Filter severity").select_option("High")
                expect(p.locator(".finding-list>button")).to_have_count(1)
                p.locator(".finding-list>button").first.click()
                expect(p.get_by_role("dialog")).to_be_visible()
                p.keyboard.press("Escape")
                expect(p.get_by_role("dialog")).to_have_count(0)
                print(
                    "PASS: landing, demo navigation, real catalog, severity filter, dialog keyboard dismissal",
                    flush=True,
                )
                p.goto(origin + "/workspace")
                p.wait_for_url("**/login")
                p.get_by_role("button", name="Create an account").click()
                p.get_by_label("Email address").fill("browser@local.example")
                p.locator("input[autocomplete=new-password]").fill(
                    "OnlyForBrowserTest-184!"
                )
                p.get_by_role("button", name="Create workspace", exact=True).click()
                expect(
                    p.get_by_role("heading", name="Security overview")
                ).to_be_visible()
                expect(p.get_by_text("No scans yet", exact=True)).to_be_visible()
                p.get_by_role("button", name="New scan", exact=True).click()
                p.locator("input[type=file]").set_input_files(
                    str(ROOT / "public/downloads/vulnerable-demo.zip")
                )
                p.get_by_role("button", name="Run security scan").click()
                expect(
                    p.get_by_role("heading", name="Analysis manifest")
                ).to_be_visible(timeout=150000)
                expect(p.locator(".finding-list>button")).to_have_count(5)
                print(
                    "PASS: protected route, sign-up, ZIP upload, live three-engine scan, persisted findings",
                    flush=True,
                )
                p.locator(".finding-list>button").first.click()
                p.get_by_label("Review status").select_option("Resolved")
                expect(p.get_by_label("Review status")).to_have_value("Resolved")
                p.get_by_role("button", name="Explore with assistant").click()
                p.get_by_role("button", name="Suggest a fix", exact=True).click()
                p.get_by_role("button", name="Get guidance").click()
                expect(p.locator(".answer")).to_contain_text("Local rule guidance")
                expect(p.locator(".answer")).to_contain_text("secret store")
                p.get_by_role("link", name="Reports", exact=True).click()
                for fmt in ("PDF", "JSON"):
                    with p.expect_download() as dl:
                        p.get_by_role("button", name="Export " + fmt).first.click()
                    payload = pathlib.Path(dl.value.path()).read_bytes()
                    if fmt == "PDF":
                        assert payload.startswith(b"%PDF-") and len(payload) > 2000
                    else:
                        report = json.loads(payload)
                        assert (
                            len(report["findings"]) == 5
                            and "Resolved" in report["triage"].values()
                        )
                print(
                    "PASS: finding triage, local guidance, valid PDF download and JSON evidence",
                    flush=True,
                )
                p.get_by_role("link", name="Scan history", exact=True).click()
                p.locator(".table-project").first.click()
                p.get_by_role("button", name="Delete scan", exact=True).click()
                p.get_by_role("dialog").get_by_role(
                    "button", name="Delete scan", exact=True
                ).click()
                expect(p.get_by_text("No scans yet", exact=True)).to_be_visible()
                p.get_by_role("button", name="Sign out").click()
                p.goto(origin + "/workspace")
                p.wait_for_url("**/login")
                p.get_by_label("Email address").fill("browser@local.example")
                p.locator("input[autocomplete=current-password]").fill(
                    "OnlyForBrowserTest-184!"
                )
                p.get_by_role("button", name="Sign in", exact=True).click()
                expect(p.get_by_text("No scans yet", exact=True)).to_be_visible()
                print(
                    "PASS: delete confirmation, logout, login, private empty workspace",
                    flush=True,
                )
                p.set_viewport_size({"width": 375, "height": 812})
                p.goto(origin)
                assert p.evaluate(
                    "document.documentElement.scrollWidth<=window.innerWidth"
                )
                p.get_by_label("Toggle navigation").click()
                p.get_by_role("link", name="Documentation", exact=True).first.click()
                expect(
                    p.get_by_role("heading", name="Platform field guide.")
                ).to_be_visible()
                p.goto(origin + "/demo")
                p.get_by_label("Toggle workspace navigation").click()
                p.get_by_role("link", name="Reports", exact=True).click()
                expect(p.get_by_role("button", name="Export PDF").first).to_be_visible()
                assert p.evaluate(
                    "document.documentElement.scrollWidth<=window.innerWidth"
                )
                assert not errors, errors
                print(
                    "PASS: mobile layouts, responsive navigation, documentation, no browser runtime errors",
                    flush=True,
                )
                browser.close()
        finally:
            host.shutdown()
            host.server_close()
            api.close()


if __name__ == "__main__":
    main()

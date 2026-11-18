# Verification report

## Local checks completed

- **34 pytest cases passed** with the actual Python 3.12 scanner environment, including five hosted-configuration checks. The test runner emitted one Starlette TestClient deprecation warning about the installed HTTP transport; no test was skipped.
- TypeScript compilation and the Vite production build passed. ESLint passed.
- **Browser acceptance test passed** using Chromium, a production-built frontend, a disposable SQLite database, and requests dispatched to the real FastAPI application with TestClient. This does not mock scanner output. The temporary HTTP bridge is test-only and removed at completion.
- Desktop landing layout checked at 1440px; mobile at 375px and 390px. The automated flow checked mobile navigation and horizontal overflow; no browser runtime exceptions were observed.
- An actual Supabase email/password sign-in returned a session for the provisioned test account. No session token is included in the project or report.

### Deployment preflight — verified locally

- Clean `npm ci`, ESLint, TypeScript and Vite build. Node loaded the gateway's real sample JSON. The configured rewrite pattern matched SPA deep links and excluded API routes and downloads.
- Parsed the Render Blueprint and checked its Docker context, COPY sources, environment names and health path. Ran the **exact Docker CMD on the Linux host** with a temporary `PORT` and noncredential test settings; Uvicorn served `/health` in gateway mode and detected all three engines. The Dockerfile's new sample-scan build check also passed on this host. This is not a Docker image build or a Render deployment.
- Applied `deployment/schema.sql` **twice** in isolated embedded PostgreSQL (PGlite) with test Supabase roles and an `auth.uid()` stand-in. Verified service-role insertion, separate reads for two owners, public catalog access, denied anonymous private reads, and denied client writes. No production schema or data was changed.
- Allowed and untrusted preflights were tested, as were missing gateway credentials, blank/wildcard origins, and origins containing route paths. These invalid hosted settings now fail at startup.
- No GitHub repository was linked or pushed from this workspace. GitHub authorization, Render provisioning, actual production credentials and a cross-host upload/persistence test remain owner actions in README §3.

### Genuine sample evidence


| Bundled sample | Bandit 1.9.4 | Semgrep 1.186.0 | detect-secrets 1.5.0 | Result |
|---|---:|---:|---:|---|
| Review sample | 2 | 2 | 1 | 5 engine observations |
| Secure baseline | 0 | 0 | 0 | No findings under the installed checks |

Both were analyzed by `backend.scanner.analyze`, exactly as uploaded ZIPs are. The review sample contains a deliberately nonworking dummy password and a non-cryptographic randomness example; it is not an exploit or executable service. Repeated reports from different engines are intentionally not deduplicated. `public/data/records.json` contains the engine versions, archive SHA-256, timestamps and actual durations. Tests verify that the downloadable archives match the recorded archive digests.

### Tested behavior

- Archive traversal, absolute/Windows paths, duplicate entries, symlinks, unsupported binary-only inputs, invalid ZIPs, encrypted flags, nested archive names and signatures, entry-count limit, expanded per-file limit, and excessive compression ratios.
- Generated internal filenames, constrained text selection, and isolation from user-supplied scanner configuration.
- A harmless marker-writing source file named `sitecustomize.py` was scanned without being executed; the marker was never created.
- A deliberately unavailable engine yields `Partial` coverage, not a successful clean report.
- Signup, password verification, token hashing, session revocation on logout, private reads, cross-account denial of assistant/triage/delete, JSON validation, and exact-origin CORS behavior.
- Full local browser journey: landing → protected-route login → signup → new scan → binary ZIP upload → real analysis → open finding → mark resolved → assistant → suggested fix → valid downloaded PDF and parsed JSON → delete → logout → login.
- Public read-only demo, search/filter controls, keyboard dialog dismissal, responsive navigation and documentation.
- Gemini network failure is simulated to test **fallback**. A controlled provider-response unit test verifies request minimization and result parsing; it does **not** establish a live model call.

## Not claimed as verified

- **Render was not provisioned.** `render.yaml`, the nonroot Dockerfile, environment templates and step-by-step deployment guide are included. The public hosted demo uses previously computed real scans. No claim of a live hosted upload is made until the scanner is connected.
- Docker was unavailable in the build workspace. The local Python dependency installation and scanner executions succeeded, but the supplied Docker image was not built here.
- **No live Gemini call** or Google OAuth consent flow was completed. The backend handles provider omission, refusal and failure with explicit local guidance. Email authentication and Google OAuth are separate capabilities.
- PostgreSQL is provided via Supabase; no separate Render-hosted PostgreSQL database or DB migration was provisioned. The managed deployment must use the same Supabase project in both services.
- No penetration test, production load certification, independent security audit, or exhaustiveness guarantee. The bounded test fixtures are not a comprehensive archive fuzzer. Hardening requirements and scaling limits are described in README.

## Reproduce

```bash
# From the project root, after README installation steps:
. .venv/bin/activate
python -m pytest -q
npm run lint
npm run build
python -m scripts.build_examples
python -m scripts.package_source
```

For the browser acceptance test, install `playwright==1.62.0` in the test environment and provide its compatible Chromium browser. With Playwright/Chromium available, run:

```bash
. .venv/bin/activate
python -m scripts.browser_check
```

The browser test builds a temporary local-mode bundle and serves it on a random loopback port for the duration of the test only. It does not start an unattended dev server, modify production data, or require credentials. Its fixed outputs are assertions against the shipped pinned scanner environment; changes to the rulepack may require updating those assertions after reviewing genuine results.

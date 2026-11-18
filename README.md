# AetherOps — Application Security Intelligence

A premium, dark-and-gold application security workspace for **defensive static review of Python projects**. The supplied earlier result was a public deployment pointer rather than source code. This is an independently implemented full-stack continuation of its branding, read-only scanning workflow, finding-aware assistance, and reporting.

## What runs where

| Mode | Authentication and persistence | Scans | Guidance |
|---|---|---|---|
| Public Vercel demo (`/demo`) | No account; read-only example catalog | Two genuine recorded three-engine analyses, not on-demand scans | Labeled local rule guidance |
| Signed-in Vercel workspace | Supabase Auth; persistent Supabase PostgreSQL through Vercel APIs | Import either recorded sample, triage findings, delete, export. New uploads require `VITE_API_URL`. | Local rule guidance without a scanner service |
| Self-contained local app | Scrypt passwords and expiring opaque sessions; SQLAlchemy Core with SQLite | Actual Bandit, Semgrep, detect-secrets subprocesses for uploads and samples | Optional Gemini; explicit local fallback |
| Connected hosted app | Supabase Auth; persistent PostgreSQL; Render validates the same access token | Render Docker service runs the full three-engine pipeline | Optional server-side Gemini |

**Try it:** landing → Explore demo → select a recent scan → inspect a finding → Explore with assistant → Suggest a fix → Reports → Export PDF. To change triage or upload personal code, create your own account. The public demo never accepts private uploads. In the hosted preview, use a *new personal account*, not a shared review account, for private work.

**Deployment boundary:** the Vercel UI and gateway can be deployed independently of Render. The supplied recorded artifacts come from actual local scanner runs. No Render service or live Gemini account was provisioned by this build. A missing backend is displayed explicitly in the upload dialog. No spinner or prerecorded result impersonates a fresh scan. See `TESTING.md` for verified and unverified paths.

## 1. Local launch — no external keys required

Prerequisites: **Linux (or WSL2 Linux), Python 3.12, Node.js 22.12+ or 24, npm, git**. Scanner child limits use POSIX `resource` and process groups; native Windows is not supported. On macOS, use the Docker route below or validate scanner wheel support yourself.

From the extracted `aetherops/` folder:

```bash
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/dev-requirements.txt
cp backend/.env.example backend/.env
cp .env.example .env.local
python -m scripts.package_source
npm ci
```

Terminal 1, from the repository root:

```bash
. .venv/bin/activate
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --workers 1 --limit-concurrency 20
```

Terminal 2, same root:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**. Get started → create an account (10+ character password) → New scan → select a ZIP → Run security scan. The two example ZIPs are under `public/downloads/`. Results are saved before returning to the browser. Open any finding, request a fix, change its status, then export PDF or JSON. To scan a sample afresh, choose New scan → Demo projects while the backend is connected.

- API health: `curl -s http://127.0.0.1:8000/health` (availability on PATH, not a substitute for a real scan).
- Local API schema: `http://127.0.0.1:8000/api/docs`.
- Default local data: `~/.aetherops/aetherops.sqlite3`. Set `LOCAL_DATA_DIR` or an absolute `DATABASE_URL=sqlite:////...` to change it. Protect the directory through filesystem permissions. Back up stopped SQLite databases using the SQLite backup facility or a consistent snapshot.
- Session lifetime: eight hours; logout invalidates the hashed token. Passwords are salted with 128-bit salts and hashed with scrypt. Passwords and raw session tokens are not stored in the database. Browser session tokens use sessionStorage in local mode; hosted mode uses the Supabase session client. Use HTTPS outside loopback.
- Local auth is a standalone development option, not an attempt to reimplement hosted account verification or recovery. Production uses Supabase Auth.

### Local Docker alternative for the backend

```bash
docker build -f backend/Dockerfile -t aetherops-scanner .
docker volume create aetherops-local
docker run --rm --init --name aetherops-scanner --memory=2g --cpus=2 --pids-limit=128 \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -p 127.0.0.1:8000:8000 -v aetherops-local:/home/aether/.aetherops \
  -e STORAGE_MODE=sqlite -e CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 \
  aetherops-scanner
```

Use the same `.env.local` and frontend launch. SQLite is **not** used on an ephemeral Render filesystem in the production recipe.

## 2. Architecture and project files

```text
src/                   React 19, TypeScript, Vite, Tailwind, Framer Motion
  pages/               Landing, auth, documentation, protected and demo workspaces
  components/          Navigation, accessible dialogs, archive selection, auth guard
  lib/                 API transport, shared types, Google auth, PDF/JSON reports
api/                   Vercel JS functions: catalog, verified per-user CRUD
server/http.js         CORS, bearer verification, real recorded artifact loader
backend/app.py         FastAPI routes, Pydantic models, limits, identity checks
backend/archive.py     Bounded ZIP validation and safe extraction
backend/scanner.py     Fixed-command engine orchestration and redacted normalization
backend/engine_guard.py POSIX child CPU, descriptor, output and core-dump constraints
backend/guidance.py    Allowlisted defensive questions; optional Gemini and fallback
backend/store.py       Local SQLAlchemy Core repository, no ORM
backend/rules.yml      Two offline Semgrep Python rules
backend/example_projects/  Non-networked review fixture and secure counterpart
public/data/records.json   Real scanner outputs normalized for the workspace
public/downloads/      Deterministic sample archives and source ZIP
scripts/               Regenerate evidence, bundle source, run browser checks
tests/                 Archive, auth, isolation, scanner and provider tests
deployment/schema.sql PostgreSQL schema, grants, indexes, RLS, example seed
render.yaml            Render scanner blueprint
vercel.json            Vite build, SPA rewrites, security headers
```

The frontend uses React Router, Lucide React, Recharts (actual severity counts), and lazy-loaded jsPDF for offline report output. Report generation is local to the browser and does not upload a report to a third party. A triage decision never changes underlying scanner evidence.

### Persistence and authorization

Local SQLAlchemy **Core** uses portable JSON, text, and identifier columns. Hosted persistence uses **Supabase's managed PostgreSQL**, accessed solely through the JavaScript client in Vercel; it does **not** open direct Postgres connections. This is an intentional adapter boundary, not a claim that changing a SQLite URL alone enables hosted mode. No ORM or direct database password is shipped to the browser. Moving existing data between modes requires an explicit account/owner mapping and migration; it is not automatic.

`aether_examples(id, title, description)` is a public catalog. `aether_scans(id, user_id, report JSONB, triage JSONB, created_at)` stores private evidence. The server verifies the bearer token with Supabase's auth server and derives the owner; it never trusts an owner supplied by a client. Every record read, mutation, and delete filters by that owner. Row-level security grants authenticated owners direct read access only. No client-side write policy exists. The service-role key is restricted to Vercel server functions. The schema script explicitly revokes public write privileges.

Render sends a completed report to the Vercel gateway using the end-user bearer token **and** `SCANNER_GATEWAY_SECRET`. Only the trusted scanner can submit a new arbitrary report. A browser can request an existing example by allowlisted ID, never upload an invented findings JSON as a clean scan.

## 3. Deploy persistent PostgreSQL + Vercel + Render

**Publish in this order:** GitHub source → Supabase schema → Vercel frontend/gateway → Render scanner → Vercel rebuild with the scanner URL. These are separate services. The existing preview is not a deployment into your accounts.

### Prepare the GitHub release (repository write access required)

1. Clone your GitHub repository and check out the branch both hosts will deploy. If starting from **Documentation → Project files → Download source**, copy the **contents** of the extracted `aetherops/` folder into the clone's root, including dotfiles. `package.json`, `vercel.json`, `render.yaml`, `api/` and `backend/` must be siblings. The ZIP contains a portable Vercel config without builder-specific environment overrides.
2. Run the release checks from that root. No hosting credentials are needed:

   ```bash
   python3.12 -m venv .venv && . .venv/bin/activate
   python -m pip install -r backend/dev-requirements.txt -c backend/requirements.lock
   python -m pytest -q
   npm ci && npm run lint
   python -m scripts.package_source
   npm run build
   ```

3. From the clone, run `git add -A` and inspect `git diff --cached --stat` and `git diff --cached --name-only`. Include both `.env.example` files, the lockfiles, `public/data/records.json` and all three ZIPs in `public/downloads/`; **exclude real env files, credentials, databases and dependencies**. Unstage any unexpected files before committing. Run `git commit -m "Prepare AetherOps deployment"` and `git push -u origin HEAD`. If the branch is protected, merge via pull request. Select the merged commit's branch on both hosts.

**Account actions:** a GitHub repository owner must authorize the Vercel and Render GitHub integrations for this repository. A Supabase project administrator must apply the SQL and configure authentication; a deployment administrator must enter private values in the host dashboards. Never commit them or attach them to a public issue. Use separate projects and credentials for untrusted preview branches.

### A. Provision persistent PostgreSQL and authentication

1. Create your **own Supabase project** and retain its database; this is the persistent PostgreSQL service for Render. You do not need a second, unused Render Postgres database. A bare Render Postgres endpoint is not interchangeable with this Supabase gateway.
2. In its SQL editor, run `deployment/schema.sql`. It creates tables, owner/date index, grants, RLS policies, and two sample catalog rows. Re-running the script preserves scan data.
3. Enable email/password authentication. Enable email confirmation and suitable production email delivery according to your policy. Set your production **Site URL** and allowed redirects to your exact Vercel origin once assigned. For standard Google OAuth, configure Google's client credentials in Supabase, authorize Supabase's callback URI, and allow `<frontend-origin>/workspace` as a redirect.
4. Copy the project HTTPS URL, public anon/publishable key, and **server-only** service-role/secret key into the appropriate host's secret settings. Do not place them in source. Set retention, backups, and recovery according to your organization's requirements.
5. Generate a gateway secret once, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Store it only in the two servers' environment settings.

### B. Deploy the frontend and gateway on Vercel

1. Push the project files to a private or public Git repository (never commit `.env`, `.env.local`, `backend/.env`, SQLite data, `.venv`, or tokens). The downloadable source includes a sanitized `vercel.json` with no environment-specific values. If deploying directly from the original builder workspace instead, remove its template `env` object in **your copy** and configure your own project settings.
2. In Vercel, create a new project and import the GitHub repository. Select the intended production branch. Root directory: repository root; framework: **Vite**; Node **24.x** (tested). Install `npm ci`, build `npm run build`, output `dist`. **No start command**: Vercel serves static assets and runs the root `api/` functions. Do not deploy just `dist` if you need authenticated persistence.
3. Set these **Production** variables (also Preview if needed):

| Vercel variable | Value |
|---|---|
| `VITE_AUTH_MODE` | `hosted` |
| `VITE_SUPABASE_URL` | Your Supabase project HTTPS origin |
| `VITE_SUPABASE_ANON_KEY` | Public key from A |
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase origin, used by server gateway |
| `SUPABASE_SERVICE_ROLE_KEY` | **Private**, server only, never `VITE_` |
| `SCANNER_GATEWAY_SECRET` | Private shared secret from A |
| `VITE_API_URL` | Initially unset; set to Render HTTPS origin after step C |

`VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_AUTH_PROXY` are optional for the builder's supplied popup service. Leave both unset in your own deployment to use Supabase-managed Google OAuth. Google sign-in only works if you configure the provider; email auth does not depend on Google. `FULLSTACK_PROJECT_REF` and `FULLSTACK_RESTORE_API_URL` are builder-specific optional database recovery hooks; leave unset elsewhere.

4. Deploy and note your canonical frontend origin. Verify `/`, `/demo`, `/docs`, `/api/examples`, and unauthenticated `/api/scans` (must return **401**). Test direct refresh of deep `/demo/scan/...` URLs; SPA rewrites must not intercept API requests.

### C. Deploy the Python scanner on Render

1. From Render, create a Blueprint from the same repository using `render.yaml`, or a Docker web service with **Dockerfile `backend/Dockerfile`, build context `.`**. The image runs as UID 10001. Select a Linux service with sufficient memory for Semgrep (start with 2 GiB and load-test) and working directory space. No raw uploads or SQLite databases belong on an ephemeral disk.
   Keep the service root at the repository root, not `backend/`, so Docker can copy the rule fixtures and `public/data`. Leave the Docker command override empty: the image supplies the start command. Fill each Blueprint `sync: false` variable in Render before the first deploy. Its Docker build runs a real three-engine sample scan as the nonroot runtime user and fails if an engine cannot analyze the fixture.
2. Set `STORAGE_MODE=gateway`. Set `CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app` to the exact HTTPS frontend origin (comma-separated explicit origins if needed; no wildcard, no paths). Set `GATEWAY_URL` to the same canonical frontend origin; it must **not** include `/api`.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` to the same project used by Vercel, and `SCANNER_GATEWAY_SECRET` to the **same secret** as Vercel. The Render service does not need a service-role key or direct DB password.
4. Optional: set `GEMINI_API_KEY` as a Render secret and `GEMINI_MODEL` to a model enabled for that account. The default model identifier is configurable, not a promise of account availability. Without a key, with a blocked response, or on timeout/failure, local rule guidance is returned and labeled. There is no browser field that collects provider credentials.
5. Deploy. Render supplies `PORT`; Docker starts `uvicorn backend.app:app --host 0.0.0.0 --port "$PORT" --workers 1 --limit-concurrency 20`. Health path: `/health`. Check all three executable flags, then verify an actual end-to-end scan. No DB migration is needed on Render in gateway mode.
6. Put the Render service's HTTPS origin into **Vercel `VITE_API_URL`** and **redeploy the frontend**. Vite values are baked into the build. Add the final Vercel URL to Supabase Auth redirect settings. Set trusted production CORS origins when using a custom domain. CORS authenticates nobody: verified bearer tokens and owner constraints remain required.
7. Verify sign-up/confirmation → login → New scan → upload `vulnerable-demo.zip` → engine coverage → findings → guidance → triage → export PDF and JSON. Verify another user sees none of these rows. Restart the Render service and verify the report persists in PostgreSQL. Test rejecting unsupported archives and unavailable scanners before admitting untrusted users.

   **Post-deploy checks** (substitute your actual production origins; no secrets needed for these probes):

   ```bash
   FRONTEND=https://your-frontend.vercel.app
   SCANNER=https://your-scanner.onrender.com
   curl -fsS "$SCANNER/health"                 # storage: gateway; all three engines true
   curl -fsS "$FRONTEND/api/examples"          # JSON array with the two real sample reports, not HTML
   curl -sS -o /dev/null -w '%{http_code}\n' "$FRONTEND/api/scans"  # 401 without a session
   curl -isS -X OPTIONS "$SCANNER/api/scan" -H "Origin: $FRONTEND" \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: authorization,content-type'
   ```

   The preflight must include `Access-Control-Allow-Origin` equal to `$FRONTEND`. Repeat with an unrelated origin and expect no allow-origin header. The Vercel gateway uses bearer authentication rather than browser cookies; its generic CORS response does not grant access to another user's reports. For the signed-in smoke test, confirm the result says **Uploaded archive**, not **Recorded sample**. If deployment protection blocks Render's server-to-server request to Vercel, use the publicly reachable **production** gateway, not a protected preview URL. Inspect both hosts' logs for the same release; do not log request bodies or tokens.

### D. Host hardening and operational limits

This is a deployable bounded demo, **not a security certification**. Keep dependencies patched, set container memory/CPU/PID limits, protect provider budgets, and add an edge rate limiter before public high-volume use. Use one worker for the included in-process concurrency and rate caps. For multi-replica deployments replace these with shared quotas, a durable job queue, and per-job isolated workers. Long scans are synchronous requests, not durable background jobs. A process restart can interrupt one without a result. The browser times out after 180 s; platform HTTP timeouts may be shorter. Failed persistence is reported rather than claimed as successful.

The Render container does not execute uploaded source. Scanner parsers are still an attack surface: for high-risk multitenancy use a separate unprivileged, **egress-denied** job sandbox or microVM, no inherited mounts, read-only root, ephemeral tmpfs, seccomp/AppArmor, and enforce resource limits externally. `--no-verify`, offline rules, disabled metrics, and stripped child environments are not an OS network sandbox. The application intentionally does **not** claim a perfect sandbox. Disable HTTP body logging at your proxy. Do not submit secrets to public shared accounts. Scan metadata includes original relative file names, but not uploaded source or detected values.

## 4. Actual scan coverage and limitations

- 5 MiB archive; 20 MiB total expanded; 1 MiB per entry; 300 entries; maximum compression ratio 100:1. Central-directory lengths and actual streamed output are checked. Stored/DEFLATE only. Rejects absolute paths, Windows paths, `..`, duplicate names, symlinks/special entries, encrypted entries, nested archive names/signatures, corruption, and unsafe control characters.
- Files are copied under **server-generated names** in a new private temp directory. Source-controlled `.bandit`, baseline files, ignore files, Python startup hooks, package configuration, and rule/plugin definitions are never loaded as scanner configuration. The original relative path is restored in findings. The scanner process runs in the trusted parent of the normalized input, not inside the uploaded tree. No shell strings, package installations, builds, imports, tests, or hooks from uploads.
- Accepts UTF-8 `.py`, `.txt`, `.json`, `.yaml`, `.yml`, `.cfg`, `.ini`, `.toml`, `.env` for text inspection; at least one `.py` is mandatory. Skips vendor trees and unsupported/binary content, with an excluded-entry count. The safe rename strategy sacrifices some package/path-sensitive and inter-file context. This is **not** dependency, malware, infrastructure, or dynamic analysis.
- **Bandit:** installed default Python AST checks, ignoring inline nosec suppression. **Semgrep:** two bundled, offline Python rules for hardcoded passwords and non-cryptographic randomness; no remote registry rulepack. **detect-secrets:** native default plugins, all files, credential verification disabled. Keyword detections are candidates, not confirmed live credentials. Their UI severity is a conservative review priority. Multiple engines can report the same underlying issue; the totals count engine observations, not deduplicated CVEs.
- Every report includes archive SHA-256, actual duration, engine/version/status, file and line, severity, and capped metadata. Unknown rules get generic review guidance rather than invented technical claims. `Partial` means any engine was missing, failed, timed out, had parse errors, or hit the 500-finding output cap. No findings is never proof of security.
- Each child has a 55-second wall timeout, CPU/file-size/fd limits, no core dumps, no shell, and a clean environment with no auth/provider secrets. Timed-out process groups are killed. Temp files are removed on normal completion and exceptions; use ephemeral containers and cleanup on host crash. Reports strip source snippets, secret values, secret hashes, raw stderr, and absolute paths.
- The fallback assistant is **not Gemini**. It provides reviewed explanations, fix patterns, and verification steps tied to a real rule. Gemini receives only trusted rule category/ID, severity, and one of three predefined defensive questions. Suggestions always require developer review. Manual “Resolved” means triaged by the user, not rescanned verification.

## 5. Reproduce, test, build and package

```bash
. .venv/bin/activate
python -m pytest -q
python -m scripts.build_examples    # genuine rerun; refuses to publish incomplete coverage
npm run lint
npm run build
python -m scripts.package_source    # regenerate the credential-free source download
npm run build                      # include the refreshed source ZIP
```

Optionally run browser checks as documented in `TESTING.md`. The sample ZIP bytes are deterministic, but report UUIDs, timestamps, durations, and findings from other scanner versions can differ. `backend/requirements.txt` pins tested direct dependencies; `backend/requirements.lock` captures the complete resolved Linux/Python 3.12 environment. Install the lock for exact transitive versions. `package-lock.json` and `.npmrc` support reproducible frontend installation. Manrope font files are self-hosted with their OFL license under `public/fonts/`.

To reproduce the API without the UI, get a local session by signing up or logging in at `POST /api/auth/signup` or `/api/auth/login` with JSON `{"email":"you@example.test","password":"your-own-long-passphrase"}`. Use its token as `Authorization: Bearer ...` for subsequent calls. Upload raw ZIP bytes (not multipart) to `POST /api/scan?name=project.zip` with `Content-Type: application/zip`. `GET /api/scans` lists your reports. `PUT /api/scans` accepts `{id, finding, status}`, with status `Open`, `In review`, or `Resolved`. `DELETE /api/scans` accepts `{id}`. `POST /api/assistant` accepts `{scan_id, finding_id, intent}`. PDF/JSON export uses the authorized result in the browser.

## Troubleshooting

- **Not connected:** set `VITE_API_URL` and rebuild. The demo displays only the recorded sample; it never fabricates a new scan.
- **401 / no workspace:** use the same Supabase project on both hosts, confirm the email, refresh the session, and check that `VITE_AUTH_MODE` matches the backend mode. Local and hosted users do not share sessions.
- **403 from gateway:** verify the shared secret on both servers and that no proxy drops Authorization headers. Do not put the shared secret in a Vite environment value.
- **CORS errors:** origin includes scheme and port; `localhost` is not `127.0.0.1`. Set exact origins; redeploy Render.
- **Partial:** inspect the engine manifest; a completed HTTP response does not imply complete coverage. Check installed executables, supported file types, container memory, CPU and timeouts.
- **429:** one scan per process at a time; per-user scan limit of 8/10 minutes, guidance 12/minute, local auth 12/minute per peer address. Retry later. Maximum 100 saved scans per account.
- **503 storage:** check PostgreSQL availability, gateway environment, RLS/grants and service-role configuration. The local report is not presented as persisted on failure.
- **Auth confirmation or Google unavailable:** configure Supabase provider settings. You can explore the public read-only demo without either integration.

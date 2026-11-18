"""One pipeline for uploaded ZIPs, both examples, and reproducible recorded reports."""

from __future__ import annotations
import hashlib
import importlib.metadata
import io
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from .archive import extract

HERE = Path(__file__).resolve().parent
EXAMPLES = ("vulnerable-demo", "secure-demo")
ENGINES = (
    ("Bandit", "bandit"),
    ("Semgrep", "semgrep"),
    ("detect-secrets", "detect-secrets"),
)


def sample_zip(name: str) -> bytes:
    if name not in EXAMPLES:
        raise ValueError("Unknown example")
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        for p in sorted((HERE / "example_projects" / name).glob("*.py")):
            entry = zipfile.ZipInfo(p.name, (2025, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(entry, p.read_bytes())
    return out.getvalue()


def advice(engine, rule):
    if (
        rule in ("B105", "B106", "B107", "aether-hardcoded-password")
        or engine == "detect-secrets"
    ):
        return (
            "Potential hardcoded credential"
            if engine == "detect-secrets"
            else "Hardcoded password",
            "A static rule identified a credential-like value in source. Anyone with repository access may be able to read it. The value is intentionally omitted from this report; review it privately to confirm.",
            "Remove the literal, load the value from a deployment secret store, and rotate it if it was ever a real credential. Review repository history for previous exposure.",
            'import os\npassword = os.environ["DATABASE_PASSWORD"]',
        )
    if rule in ("B311", "aether-weak-random-token"):
        return (
            "Non-cryptographic randomness",
            "The standard random generator is not suitable for session identifiers or security tokens. Confirm whether the reported value crosses a security boundary. Non-security uses may be acceptable.",
            "Use the secrets module for tokens. Keep ordinary random number generation only for simulation or other non-security uses.",
            "import secrets\nnonce = secrets.token_urlsafe(32)",
        )
    return (
        f"{engine} rule {rule}",
        f"{engine} reported {rule} at the indicated source location. This is a static signal, not evidence of successful exploitation.",
        "Review this rule in the scanner documentation and inspect the surrounding code. Apply a context-specific defensive fix, then rerun all three engines.",
        "",
    )


def executable(name):
    path = Path(sys.executable).parent / name
    return str(path) if path.is_file() else shutil.which(name)


def _run(cmd, work, name, env):
    binary = executable(cmd[0])
    if not binary:
        return None, "Unavailable", "Scanner executable is not installed."
    with (
        (work / (name + ".out")).open("wb") as out,
        (work / (name + ".err")).open("wb") as err,
    ):
        p = subprocess.Popen(
            [sys.executable, "-I", str(HERE / "engine_guard.py"), binary, *cmd[1:]],
            cwd=work,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=out,
            stderr=err,
            start_new_session=True,
            close_fds=True,
        )
        try:
            code = p.wait(timeout=55)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            p.wait()
            return None, "Timed out", "Engine exceeded its 55-second wall-clock limit."
    if code != 0:
        return None, "Failed", "Engine exited without a complete report."
    try:
        return json.loads((work / (name + ".out")).read_bytes()), "Complete", ""
    except (ValueError, UnicodeError):
        return None, "Failed", "Engine did not produce valid JSON."


def analyze(data: bytes, project: str, *, origin="Uploaded archive", sample=None):
    start = time.monotonic()
    findings = []
    engines = []
    with tempfile.TemporaryDirectory(prefix="aether-scan-") as tmp:
        work = Path(tmp)
        source = work / "input"
        source.mkdir()
        home = work / "home"
        home.mkdir()
        mapping, skipped = extract(data, source)
        env = {
            "PATH": str(Path(sys.executable).parent) + ":/usr/local/bin:/usr/bin:/bin",
            "HOME": str(home),
            "TMPDIR": str(home),
            "LANG": "C.UTF-8",
            "PYTHONSAFEPATH": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "SEMGREP_SEND_METRICS": "off",
            "SEMGREP_ENABLE_VERSION_CHECK": "0",
            "SEMGREP_SETTINGS_FILE": str(home / "settings.yml"),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "OTEL_SDK_DISABLED": "true",
        }
        commands = [
            [
                "bandit",
                "-r",
                "input",
                "-f",
                "json",
                "--ignore-nosec",
                "--exit-zero",
                "-q",
            ],
            [
                "semgrep",
                "scan",
                "--config",
                str(HERE / "rules.yml"),
                "--json",
                "--metrics=off",
                "--disable-version-check",
                "--no-git-ignore",
                "--disable-nosem",
                "--no-rewrite-rule-ids",
                "--oss-only",
                "--jobs=1",
                "--timeout=8",
                "--max-memory=384",
                "input",
            ],
            ["detect-secrets", "scan", "--all-files", "--no-verify", "input"],
        ]
        for (name, package), cmd in zip(ENGINES, commands):
            try:
                version = importlib.metadata.version(package)
            except importlib.metadata.PackageNotFoundError:
                version = "not installed"
            before = len(findings)
            try:
                result, status, note = _run(cmd, work, package, env)
                if result is not None:
                    if result.get("errors"):
                        status, note = (
                            "Partial",
                            "Some files could not be analyzed. See scanner coverage limitations.",
                        )
                    if name == "Bandit":
                        rows = [
                            (
                                x["test_id"],
                                x["filename"],
                                x["line_number"],
                                x["issue_severity"].title(),
                            )
                            for x in result["results"]
                        ]
                    elif name == "Semgrep":
                        rows = [
                            (
                                x["check_id"],
                                x["path"],
                                x["start"]["line"],
                                {
                                    "ERROR": "High",
                                    "WARNING": "Medium",
                                    "INFO": "Low",
                                }.get(x["extra"]["severity"], "Low"),
                            )
                            for x in result["results"]
                        ]
                    else:
                        rows = [
                            (x["type"], path, x["line_number"], "High")
                            for path, items in result["results"].items()
                            for x in items
                        ]
                    for rule, path, line, severity in rows:
                        if len(findings) >= 500:
                            status, note = (
                                "Partial",
                                "500-finding report limit reached.",
                            )
                            break
                        filename = mapping[Path(path).name]
                        title, explain, fix, pattern = advice(name, rule)
                        findings.append(
                            dict(
                                id=f"F-{len(findings) + 1:03d}",
                                engine=name,
                                rule=rule,
                                title=title,
                                severity=severity,
                                file=filename,
                                line=line,
                                explanation=explain,
                                fix=fix,
                                pattern=pattern,
                            )
                        )
            except (OSError, KeyError, TypeError, ValueError):
                status, note = (
                    "Failed",
                    "Engine launch or structured output validation failed.",
                )
            engines.append(
                dict(
                    name=name,
                    version=version,
                    status=status,
                    count=len(findings) - before,
                    note=note,
                )
            )
    return dict(
        id=str(uuid.uuid4()),
        project=project[:100],
        created_at=datetime.now(timezone.utc).isoformat(),
        status="Complete"
        if all(e["status"] == "Complete" for e in engines)
        else "Partial",
        files=len(mapping),
        skipped=skipped,
        duration=round(time.monotonic() - start, 2),
        engines=engines,
        findings=findings,
        triage={},
        origin=origin,
        sample=sample,
        sha256=hashlib.sha256(data).hexdigest(),
    )

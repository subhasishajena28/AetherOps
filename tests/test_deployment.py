"""Credential-free smoke checks of the Render entry point in hosted mode."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BASE = dict(
    STORAGE_MODE="gateway",
    SUPABASE_URL="https://database.example.test",
    SUPABASE_ANON_KEY="test-only",
    GATEWAY_URL="https://frontend.example.test",
    SCANNER_GATEWAY_SECRET="test-only",
    CORS_ORIGINS="https://frontend.example.test",
)


def test_gateway_boot_and_cors():
    # No Supabase/Render account or network call; import the same ASGI entry point as Docker.
    script = """
from fastapi.testclient import TestClient
from backend.app import app, DB
assert DB is None
with TestClient(app) as c:
    assert c.get('/health').json()['storage'] == 'gateway'
    assert c.get('/api/scans').status_code == 401
    for origin, allowed in [('https://frontend.example.test', True), ('https://other.example.test', False)]:
        h = {'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'}
        r = c.options('/api/scan', headers=h)
        assert (r.headers.get('access-control-allow-origin') == origin) == allowed
"""
    subprocess.run(
        [sys.executable, "-c", script],
        cwd=ROOT,
        env={**os.environ, **BASE},
        check=True,
        timeout=20,
    )


@pytest.mark.parametrize(
    "setting,value",
    [
        ("SCANNER_GATEWAY_SECRET", ""),
        ("CORS_ORIGINS", ""),
        ("CORS_ORIGINS", "*"),
        ("CORS_ORIGINS", "https://frontend.example.test/workspace"),
    ],
)
def test_invalid_hosted_configuration_fails_at_boot(setting, value):
    result = subprocess.run(
        [sys.executable, "-c", "import backend.app"],
        cwd=ROOT,
        env={**os.environ, **BASE, setting: value},
        capture_output=True,
        timeout=20,
    )
    assert result.returncode != 0 and b"RuntimeError:" in result.stderr

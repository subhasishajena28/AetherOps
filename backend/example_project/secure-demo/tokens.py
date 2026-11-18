"""A cryptographically generated nonce."""

import secrets


def make_session_nonce():
    return secrets.token_urlsafe(32)

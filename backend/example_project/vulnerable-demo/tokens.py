"""Non-runnable application fragment for reviewing randomness choices."""

import random


def make_session_nonce():
    return str(random.random())

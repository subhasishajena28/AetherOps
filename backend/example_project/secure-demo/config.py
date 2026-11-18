"""A configuration fragment that reads a deployment-provided value."""

import os


def database_password():
    return os.environ["DATABASE_PASSWORD"]

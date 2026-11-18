"""Trusted, POSIX-only child wrapper. Input code is never on the import path."""

import os
import resource
import sys

resource.setrlimit(resource.RLIMIT_CPU, (45, 48))
resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024, 8 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
os.execv(sys.argv[1], sys.argv[1:])

"""Validate every entry; only materialize supported text under generated names."""

from __future__ import annotations
import io
import re
import stat
import zipfile
import zlib
from pathlib import Path, PurePosixPath

MIB = 1024 * 1024
MAX_ZIP, MAX_TOTAL, MAX_FILE, MAX_COUNT, MAX_RATIO = 5 * MIB, 20 * MIB, MIB, 300, 100
TEXT = {".py", ".txt", ".json", ".yaml", ".yml", ".cfg", ".ini", ".toml", ".env"}
ARCHIVES = {
    ".zip",
    ".jar",
    ".whl",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
    ".tar",
    ".rar",
    ".7z",
    ".egg",
}


class ArchiveError(ValueError):
    pass


def extract(data: bytes, root: Path) -> tuple[dict[str, str], int]:
    if len(data) > MAX_ZIP:
        raise ArchiveError("The archive exceeds the 5 MiB upload limit.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            entries = z.infolist()
            if not entries or len(entries) > MAX_COUNT:
                raise ArchiveError("An archive must have between 1 and 300 entries.")
            seen, names, declared, expanded, skipped = set(), {}, 0, 0, 0
            for i, entry in enumerate(entries):
                name = entry.orig_filename
                parts = name.rstrip("/").split("/")
                if (
                    not name
                    or len(name) > 240
                    or len(parts) > 20
                    or name.startswith("/")
                    or "\\" in name
                    or ":" in name
                    or any(p in ("", ".", "..") for p in parts)
                    or re.search(r"[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]", name)
                ):
                    raise ArchiveError(
                        "Unsafe archive path. Use relative, ordinary filenames only."
                    )
                key = name.rstrip("/").casefold()
                if key in seen:
                    raise ArchiveError("Duplicate archive paths are not allowed.")
                seen.add(key)
                kind = stat.S_IFMT(entry.external_attr >> 16)
                if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or entry.flag_bits & 1:
                    raise ArchiveError(
                        "Links, special files, and encrypted entries are not supported."
                    )
                if entry.compress_type not in (
                    zipfile.ZIP_STORED,
                    zipfile.ZIP_DEFLATED,
                ):
                    raise ArchiveError(
                        "Only stored or DEFLATE-compressed ZIP entries are supported."
                    )
                declared += entry.file_size
                if (
                    entry.file_size > MAX_FILE
                    or declared > MAX_TOTAL
                    or entry.file_size > MAX_RATIO * max(entry.compress_size, 1)
                ):
                    raise ArchiveError(
                        "Archive exceeds expanded-size or compression-ratio limits."
                    )
                if entry.is_dir():
                    continue
                ext = PurePosixPath(name).suffix.lower()
                if PurePosixPath(name).name == ".env":
                    ext = ".env"
                if ext in ARCHIVES:
                    raise ArchiveError("Nested archives are not accepted.")
                # Read to EOF with real byte accounting and CRC validation, including excluded entries.
                content = bytearray()
                with z.open(entry) as f:
                    while chunk := f.read(65536):
                        content.extend(chunk)
                        expanded += len(chunk)
                        if (
                            len(content) > MAX_FILE
                            or expanded > MAX_TOTAL
                            or len(content) > entry.file_size
                        ):
                            raise ArchiveError(
                                "Actual expanded data exceeds archive limits."
                            )
                if len(content) != entry.file_size:
                    raise ArchiveError("Inconsistent archive entry length.")
                if content.startswith(
                    (
                        b"PK\x03\x04",
                        b"PK\x05\x06",
                        b"\x1f\x8b",
                        b"7z\xbc\xaf\x27\x1c",
                        b"Rar!",
                    )
                ):
                    raise ArchiveError("Nested archive contents are not accepted.")
                if ext not in TEXT or any(
                    p
                    in {
                        ".git",
                        "node_modules",
                        "venv",
                        ".venv",
                        "__pycache__",
                        "vendor",
                    }
                    for p in parts
                ):
                    skipped += 1
                    continue
                try:
                    content.decode("utf-8")
                except UnicodeDecodeError:
                    skipped += 1
                    continue
                if b"\0" in content:
                    skipped += 1
                    continue
                safe = f"source_{i:04d}{ext}"
                (root / safe).write_bytes(content)
                names[safe] = name
            if not any(n.endswith(".py") for n in names):
                raise ArchiveError(
                    "Include at least one UTF-8 Python source file in the ZIP."
                )
            return names, skipped
    except (
        zipfile.BadZipFile,
        zlib.error,
        RuntimeError,
        NotImplementedError,
        EOFError,
        OSError,
    ) as exc:
        raise ArchiveError("Invalid, corrupt, or unsupported ZIP archive.") from exc

"""Small bounded fixtures exercise rejection; no large archive is generated."""

import io
import stat
import zipfile
import pytest
from backend.archive import extract, ArchiveError, MAX_FILE


def packed(items, compression=zipfile.ZIP_DEFLATED):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=compression) as z:
        for n, v in items:
            z.writestr(n, v)
    return out.getvalue()


@pytest.mark.parametrize(
    "name",
    [
        "../outside.py",
        "/absolute.py",
        "C:/drive.py",
        "a\\b.py",
        "x/../y.py",
        "test//b.py",
        "a/./b.py",
    ],
)
def test_rejects_unsafe_names(tmp_path, name):
    with pytest.raises(ArchiveError):
        extract(packed([(name, "x=1")]), tmp_path)
    assert not list(tmp_path.iterdir())


def test_symlinks(tmp_path):
    info = zipfile.ZipInfo("linked.py")
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    with pytest.raises(ArchiveError, match="Links"):
        extract(packed([(info, "benign.txt")]), tmp_path)


def test_duplicate_casefold(tmp_path):
    with pytest.raises(ArchiveError, match="Duplicate"):
        extract(packed([("app.py", "x=1"), ("APP.py", "x=2")]), tmp_path)


def test_entry_count(tmp_path):
    with pytest.raises(ArchiveError, match="300"):
        extract(packed([(f"{i}.py", "") for i in range(301)]), tmp_path)


def test_compression_ratio(tmp_path):
    with pytest.raises(ArchiveError, match="ratio"):
        extract(packed([("app.py", " " * 65536)]), tmp_path)


def test_expanded_file_limit(tmp_path):
    with pytest.raises(ArchiveError, match="expanded-size"):
        extract(
            packed([("app.py", "x" * (MAX_FILE + 1))], zipfile.ZIP_STORED), tmp_path
        )


@pytest.mark.parametrize(
    "name,data", [("inner.zip", b"x"), ("renamed.py", b"PK\x03\x04payload")]
)
def test_nested(tmp_path, name, data):
    with pytest.raises(ArchiveError, match="Nested"):
        extract(packed([(name, data)]), tmp_path)


def test_encrypted_flag(tmp_path):
    archive = bytearray(packed([("app.py", "x=1")]))
    archive[6] |= 1
    i = archive.index(b"PK\x01\x02")
    archive[i + 8] |= 1
    with pytest.raises(ArchiveError, match="encrypted"):
        extract(bytes(archive), tmp_path)


def test_bad_archive(tmp_path):
    with pytest.raises(ArchiveError):
        extract(b"not a ZIP", tmp_path)


def test_binary_without_python(tmp_path):
    with pytest.raises(ArchiveError, match="Python"):
        extract(packed([("photo.png", b"hello")]), tmp_path)


def test_renames_and_exclusions(tmp_path):
    names, skip = extract(
        packed(
            [
                ("project/safe.py", "value=1"),
                ("node_modules/lib.py", "x=1"),
                ("project/.bandit", "unused"),
                ("picture.png", b"x"),
            ]
        ),
        tmp_path,
    )
    assert list(names.values()) == ["project/safe.py"] and skip == 3
    assert (
        not (tmp_path / "project").exists() and (tmp_path / "source_0000.py").is_file()
    )

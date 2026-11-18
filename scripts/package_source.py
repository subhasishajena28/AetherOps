"""Explicit allowlist: never ship environment secrets, data stores, caches or uploads."""

from pathlib import Path
import json, zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "README.md",
    "TESTING.md",
    "package.json",
    "package-lock.json",
    "index.html",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "eslint.config.js",
    ".env.example",
    ".gitignore",
    ".dockerignore",
    ".vercelignore",
    "render.yaml",
    ".npmrc",
    "pytest.ini",
]
DIRS = ["src", "api", "server", "backend", "tests", "scripts", "deployment", "public"]


def main():
    target = ROOT / "public/downloads/aetherops-source.zip"
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, strict_timestamps=False) as z:
        for name in FILES:
            if (ROOT / name).is_file():
                z.write(ROOT / name, "aetherops/" + name)
        for dirname in DIRS:
            for p in sorted((ROOT / dirname).rglob("*")):
                if (
                    not p.is_file()
                    or p == target
                    or "__pycache__" in p.parts
                    or p.name.startswith(".env")
                    and p.name != ".env.example"
                    or p.suffix in (".pyc", ".sqlite", ".db", ".png")
                    or p.name in ("vite.svg", "react.svg", "App.css")
                ):
                    continue
                z.write(p, "aetherops/" + str(p.relative_to(ROOT)))
        # Public hosted settings are environment-specific. A clean deploy sets them in Vercel settings.
        v = json.loads((ROOT / "vercel.json").read_text())
        v.pop("env", None)
        z.writestr("aetherops/vercel.json", json.dumps(v, indent=2) + "\n")
    print("Source bundle:", target.name, target.stat().st_size, "bytes")


if __name__ == "__main__":
    main()

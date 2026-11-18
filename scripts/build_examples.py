"""Run, never synthesize, demo findings. Run as python -m scripts.build_examples."""

from pathlib import Path
import json
from backend.scanner import analyze, sample_zip, EXAMPLES

ROOT = Path(__file__).resolve().parent.parent


def main():
    out = ROOT / "public/data"
    out.mkdir(parents=True, exist_ok=True)
    zips = ROOT / "public/downloads"
    zips.mkdir(parents=True, exist_ok=True)
    records = []
    for name in EXAMPLES:
        data = sample_zip(name)
        r = analyze(
            data,
            "Atlas · "
            + ("Secure baseline" if name == "secure-demo" else "Review sample"),
            origin="Recorded sample",
            sample=name,
        )
        print(name, r["status"], r["engines"], flush=True)
        if r["status"] != "Complete":
            raise SystemExit(
                "Refusing to publish an incomplete example. Inspect engine availability."
            )
        (zips / (name + ".zip")).write_bytes(data)
        records.append(r)
    (out / "records.json").write_text(json.dumps(records, indent=2) + "\n")


if __name__ == "__main__":
    main()

"""Package ReelPilot for the Chrome Web Store → dist/reelpilot-<version>.zip

Usage:  python tools/build_zip.py

Only ships what the extension needs (manifest.json, icons/, src/) and checks that every file the
manifest points to exists, so a broken upload is caught here instead of in store review.
"""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["manifest.json", "icons", "src"]
SKIP_SUFFIXES = {".map", ".md", ".py", ".log"}


def referenced_files(manifest):
    files = set(manifest.get("icons", {}).values())
    action = manifest.get("action", {})
    files.update(action.get("default_icon", {}).values())
    if action.get("default_popup"):
        files.add(action["default_popup"])
    if manifest.get("background", {}).get("service_worker"):
        files.add(manifest["background"]["service_worker"])
    for cs in manifest.get("content_scripts", []):
        files.update(cs.get("js", []))
        files.update(cs.get("css", []))
    return files


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    missing = sorted(f for f in referenced_files(manifest) if not (ROOT / f).is_file())
    if missing:
        sys.exit(f"manifest.json references missing files: {', '.join(missing)}")
    if len(manifest.get("description", "")) > 132:
        sys.exit("manifest description is longer than the store's 132-character limit")

    files = []
    for entry in INCLUDE:
        path = ROOT / entry
        candidates = [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file())
        files += [p for p in candidates if p.suffix not in SKIP_SUFFIXES]

    out = ROOT / "dist" / f"reelpilot-{manifest['version']}.zip"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(f, f.relative_to(ROOT).as_posix())  # store paths with "/" — required by the store

    size_kb = out.stat().st_size / 1024
    print(f"{out.relative_to(ROOT).as_posix()}  ({len(files)} files, {size_kb:.0f} KB)")
    for f in files:
        print("  ", f.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()

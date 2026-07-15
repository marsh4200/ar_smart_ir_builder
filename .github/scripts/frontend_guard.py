#!/usr/bin/env python3
"""Frontend guard for ar_smart_ir_builder.

Two checks, both of which have burned us before:

1. Version sync — manifest.json "version" must match the version string the
   panel prints in its own header. When these drift, a user reporting a bug
   quotes a version number that doesn't exist in any release.

2. Cache-buster bump — panel.js is served with a ?v=N query string. Home
   Assistant frontends cache it hard. If panel.js changes and N does not,
   the change ships and nobody sees it. On a pull request this compares
   against the base branch and fails if panel.js moved but N didn't.

Run from the repo root. Exits non-zero with a GitHub Actions annotation on
failure.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMPONENT = ROOT / "custom_components" / "ar_smart_ir_builder"
MANIFEST = COMPONENT / "manifest.json"
PANEL = COMPONENT / "www" / "panel.js"
INIT = COMPONENT / "__init__.py"

PANEL_REL = PANEL.relative_to(ROOT).as_posix()
INIT_REL = INIT.relative_to(ROOT).as_posix()

VERSION_IN_PANEL = re.compile(r'class="ir-version">v([0-9]+\.[0-9]+\.[0-9]+)<')
CACHE_BUSTER = re.compile(r'panel\.js\?v=([0-9]+)')

failures: list[str] = []


def fail(file: str, msg: str) -> None:
    print(f"::error file={file}::{msg}")
    failures.append(msg)


def note(msg: str) -> None:
    print(f"  {msg}")


def git(*args: str) -> str | None:
    """Run a git command, returning None if it fails (e.g. no base ref)."""
    try:
        out = subprocess.run(
            ["git", *args], cwd=ROOT, capture_output=True, text=True, check=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return out.stdout


def check_version_sync() -> None:
    print("→ Version sync")
    manifest_version = json.loads(MANIFEST.read_text(encoding="utf-8")).get("version")
    if not manifest_version:
        fail("custom_components/ar_smart_ir_builder/manifest.json", "manifest.json has no 'version' key")
        return

    panel_src = PANEL.read_text(encoding="utf-8")
    match = VERSION_IN_PANEL.search(panel_src)
    if not match:
        fail(PANEL_REL, 'panel.js has no <div class="ir-version">vX.Y.Z</div> header')
        return

    panel_version = match.group(1)
    if panel_version != manifest_version:
        fail(
            PANEL_REL,
            f"Version mismatch: manifest.json says {manifest_version}, "
            f"panel.js header says v{panel_version}. Bump both together.",
        )
        return

    note(f"manifest.json and panel.js header agree on {manifest_version}")


def current_cache_buster(source: str) -> int | None:
    match = CACHE_BUSTER.search(source)
    return int(match.group(1)) if match else None


def check_cache_buster() -> None:
    print("→ Cache-buster bump")
    head_v = current_cache_buster(INIT.read_text(encoding="utf-8"))
    if head_v is None:
        fail(INIT_REL, "No 'panel.js?v=N' cache-buster found in __init__.py")
        return

    base_ref = os.environ.get("BASE_REF", "").strip()
    if not base_ref:
        note(f"cache-buster is v={head_v} (not a pull request — bump check skipped)")
        return

    if git("fetch", "origin", base_ref, "--depth=1") is None:
        note("could not fetch base ref — bump check skipped")
        return

    diff = git("diff", "--name-only", f"origin/{base_ref}", "HEAD")
    if diff is None:
        note("could not diff against base ref — bump check skipped")
        return

    changed = set(diff.split())
    if PANEL_REL not in changed:
        note(f"panel.js unchanged vs {base_ref} — no bump needed (v={head_v})")
        return

    base_init = git("show", f"origin/{base_ref}:{INIT_REL}")
    if base_init is None:
        note("__init__.py is new on this branch — bump check skipped")
        return

    base_v = current_cache_buster(base_init)
    if base_v is None:
        note("base branch had no cache-buster — bump check skipped")
        return

    if head_v <= base_v:
        fail(
            INIT_REL,
            f"panel.js changed but the cache-buster is still v={head_v} "
            f"(base is v={base_v}). Bump 'panel.js?v=' or the frontend will "
            f"serve stale JS to every existing install.",
        )
        return

    note(f"panel.js changed and cache-buster bumped {base_v} → {head_v}")


def main() -> int:
    for path in (MANIFEST, PANEL, INIT):
        if not path.exists():
            fail(path.relative_to(ROOT).as_posix(), "Expected file is missing")
            return 1

    check_version_sync()
    check_cache_buster()

    print()
    if failures:
        print(f"FAILED — {len(failures)} problem(s):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("PASSED — frontend guard clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Offline 404 check for a built site.

Crawls every *.html and *.css under <site_dir>, extracts local references
(href / src / CSS url()), resolves each against the file tree, and fails if any
target is missing. Catches the class of bug `zensical --strict` does NOT —
missing static assets and broken CSS url() paths (e.g. tab-icon masks that 404
when the site is served under a project sub-path).

External (http://, https://, //host, mailto:, tel:, data:) and pure #anchor
references are skipped — this is a local-asset existence check, not a network
crawl, so it runs fully offline.

    check_links.py <site_dir> [--ignore SUBSTR]...   # exit 1 on any missing target

--ignore SUBSTR skips any finding whose source path or reference contains SUBSTR
(repeatable) — use it to allowlist known pre-existing breakage so the gate still
catches NEW regressions. Run AFTER relativize_links.py so references are in their
served form.
"""
import glob
import os
import re
import sys
from urllib.parse import unquote

HREF_SRC_RE = re.compile(r'(?:href|src)="([^"]+)"')
CSS_URL_RE = re.compile(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)')
SKIP_PREFIXES = ("http://", "https://", "//", "mailto:", "tel:", "data:", "#", "javascript:")


def is_local(ref):
    ref = ref.strip()
    return bool(ref) and not ref.startswith(SKIP_PREFIXES)


def resolve(site, src_file, ref):
    """Map a reference to a filesystem path inside `site`, or None if external."""
    if not is_local(ref):
        return None
    ref = unquote(ref.split("#", 1)[0].split("?", 1)[0])
    if not ref:
        return None
    if ref.startswith("/"):
        target = os.path.join(site, ref.lstrip("/"))
    else:
        target = os.path.normpath(os.path.join(os.path.dirname(src_file), ref))
    # A directory / trailing-slash link resolves to its index.html.
    if ref.endswith("/") or os.path.isdir(target):
        target = os.path.join(target, "index.html")
    return target


def main():
    args = sys.argv[1:]
    ignores = []
    while "--ignore" in args:
        i = args.index("--ignore")
        ignores.append(args[i + 1])
        del args[i : i + 2]
    site = args[0].rstrip("/")
    missing = []
    checked = 0

    files = glob.glob(f"{site}/**/*.html", recursive=True) + glob.glob(
        f"{site}/**/*.css", recursive=True
    )
    for path in files:
        # 404.html is served from any URL depth, so it deliberately references
        # assets via the deployment-root prefix that does not resolve in the
        # flat build dir — skip it.
        if os.path.basename(path) == "404.html":
            continue
        s = open(path, encoding="utf-8", errors="ignore").read()
        refs = HREF_SRC_RE.findall(s) if path.endswith(".html") else []
        refs += CSS_URL_RE.findall(s)
        for ref in refs:
            target = resolve(site, path, ref)
            if target is None:
                continue
            checked += 1
            if not os.path.exists(target):
                rel = os.path.relpath(path, site)
                if any(g in rel or g in ref for g in ignores):
                    continue
                missing.append((rel, ref))

    if missing:
        print(f"✗ {len(missing)} broken local reference(s) in {site}/:", file=sys.stderr)
        for src, ref in sorted(set(missing)):
            print(f"    {src}  →  {ref}", file=sys.stderr)
        sys.exit(1)
    print(f"✓ {checked} local reference(s) OK in {site}/ — no 404s")


if __name__ == "__main__":
    main()

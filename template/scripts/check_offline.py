#!/usr/bin/env python3
"""Fail the build if the site would fetch anything from the internet at runtime.

These docs get served on airgapped networks (mirrored copies, the nginx image),
so every subresource must be local. check_links.py deliberately skips external
references — it only proves that local assets exist — which is how the theme's
CDN loads for mermaid/glightbox/fonts went unnoticed: nothing was checking. This
is the check that catches them.

    check_offline.py <site_dir> [--allow HOST]

Flags external *subresources* only — script/link/img/iframe sources, CSS url()
and @import, and any URL left in the theme's JS (where the bundle's dynamic
loaders live). Ordinary <a href> links out to the wider web are fine: they are
navigation the reader chooses, not something the page fetches on load.
"""

import glob
import os
import re
import sys
from urllib.parse import urlparse

# Hosts that never produce a network request from a page load:
#   www.w3.org      — XML/SVG namespace URIs, identifiers not fetched.
#   api.github.com  — the theme's repo-stars fetch, dead code here: it only fires
#                     for a github.com repo_url, and ours is GitLab.
#   cdn.plyr.io     — GLightbox's default player config. Only read when a lightbox
#                     slide is a video/audio/YouTube embed; ours are all images, so
#                     it is never fetched. Vendoring plyr would drag in its own CDN
#                     defaults (icon sprite, blank.mp4) for a feature we don't use.
#                     If these docs ever gain a video lightbox, vendor plyr then.
ALLOW = {"www.w3.org", "api.github.com", "cdn.plyr.io"}

# Assets a browser actually loads. Third-party libraries are full of URLs in
# error messages and license headers (mermaid alone has dozens), so inside
# vendored code only these count as a real fetch.
ASSET_EXT = (
    ".js",
    ".mjs",
    ".css",
    ".svg",
    ".png",
    ".jpg",
    ".gif",
    ".woff",
    ".woff2",
    ".ttf",
    ".mp4",
)

# <script src="http…">, <img src>, <iframe src>.
SRC_RE = re.compile(r'<(?:script|img|iframe)\b[^>]*\bsrc=["\'](https?://[^"\']+)', re.I)
# <link …> — only the rels that make the browser fetch/connect.
LINK_RE = re.compile(r"<link\b[^>]*>", re.I)
LINK_HREF_RE = re.compile(r'\bhref=["\'](https?://[^"\']+)', re.I)
LINK_REL_RE = re.compile(r'\brel=["\']([^"\']+)', re.I)
FETCHING_RELS = {
    "stylesheet",
    "preload",
    "prefetch",
    "preconnect",
    "dns-prefetch",
    "modulepreload",
    "icon",
    "shortcut icon",
    "apple-touch-icon",
    "manifest",
}
# url(http…) and @import "http…" in stylesheets (and inline <style> blocks).
CSS_RE = re.compile(r'url\(\s*["\']?(https?://[^)"\']+)|@import\s+["\'](https?://[^"\']+)', re.I)
# Any absolute URL surviving in JS — the bundle's lazy loaders build their
# <script>/<link> tags from plain string literals, so this is where they hide.
JS_RE = re.compile(r'["\'`](https?://[^"\'`\s]+)')


def external(url, allow):
    # A URL built at runtime ("https://${e}/api/v4/...") can't be resolved
    # statically. The only one the theme has is its repo-facts fetch, which goes
    # to repo_url's own host — a LAN host, and merely cosmetic when unreachable.
    if "${" in url:
        return False
    host = urlparse(url).hostname or ""
    return host and host not in allow


def scan(path, allow):
    s = open(path, encoding="utf-8", errors="replace").read()
    vendored = "/assets/vendor/" in path.replace("\\", "/")
    hits = set()
    if path.endswith(".html"):
        hits |= {u for u in SRC_RE.findall(s) if external(u, allow)}
        for tag in LINK_RE.findall(s):
            rel = LINK_REL_RE.search(tag)
            href = LINK_HREF_RE.search(tag)
            if not (rel and href) or rel.group(1).lower() not in FETCHING_RELS:
                continue
            if external(href.group(1), allow):
                hits.add(href.group(1))
    if path.endswith((".html", ".css")):
        hits |= {u or v for u, v in CSS_RE.findall(s) if external(u or v, allow)}
    if path.endswith(".js"):
        for u in JS_RE.findall(s):
            if not external(u, allow):
                continue
            if vendored and not urlparse(u).path.lower().endswith(ASSET_EXT):
                continue  # a doc link or license URL inside a third-party lib
            hits.add(u)
    return hits


def main():
    args = sys.argv[1:]
    site, allow = None, set(ALLOW)
    i = 0
    while i < len(args):
        if args[i] == "--allow":
            allow.add(args[i + 1])
            i += 2
        else:
            site = args[i]
            i += 1
    if not site:
        sys.exit("usage: check_offline.py <site_dir> [--allow HOST]")

    findings = []
    for ext in ("html", "css", "js"):
        for path in sorted(glob.glob(f"{site}/**/*.{ext}", recursive=True)):
            for url in sorted(scan(path, allow)):
                findings.append((os.path.relpath(path, site), url))

    if findings:
        print(f"{len(findings)} external reference(s) — the site would hit the network:")
        for path, url in findings:
            print(f"  {path}: {url}")
        print(
            "\nVendor them in scripts/vendor_assets.py, or --allow the host if it is never fetched."
        )
        sys.exit(1)
    print(f"offline check passed: no external subresources in {site}/")


if __name__ == "__main__":
    main()

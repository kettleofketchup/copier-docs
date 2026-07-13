#!/usr/bin/env python3
"""Vendor external assets (Google Fonts, unpkg JS/CSS) into a built site so it
serves fully offline / airgapped — zensical has no offline plugin. Runs from
every `just docs::build*` recipe, so no publish target (Pages, a mirror, the
nginx image) can ship a CDN reference. Needs network; downloads are cached in
.cache/vendor/, so repeat builds work offline.

    vendor_assets.py <site_dir>

Every rewritten reference is page-relative, so the output stays prefix-agnostic:
it works at the domain root and under any `/<project>/` serve-prefix alike.

The unpkg URLs are not in the HTML: the theme bundle lazy-loads mermaid,
glightbox and the resize-observer polyfill from string literals inside
bundle.min.js, and a page-relative path there would resolve against whatever
page is open. Those become __mdVendor("js/mermaid.min.js"), a resolver
prepended to the bundle that derives the vendor dir from the bundle's own
<script src> — correct at any page depth, under any prefix.

`:material-*` icons are already inlined SVG, so nothing to do there.
"""

import glob
import hashlib
import os
import re
import sys
import urllib.request

# A desktop browser UA so Google Fonts serves woff2 (not ttf).
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(REPO, ".cache", "vendor")

# Prepended to any JS file whose external URLs we rewrote. The IIFE runs while
# the bundle is executing, so document.currentScript is the bundle's own <script>
# tag; vendor/ sits one level up from assets/javascripts/. The #__config fallback
# covers a bundle loaded as a module (currentScript === null), where the theme's
# own page-relative base is the best available answer.
RESOLVER = (
    "var __mdVendorBase=(function(){"
    "var s=document.currentScript&&document.currentScript.src;"
    'if(s)return new URL("../vendor/",s).href;'
    'var c=document.getElementById("__config"),b=".";'
    'try{b=JSON.parse(c.textContent).base||"."}catch(e){}'
    'return new URL("assets/vendor/",new URL(b.replace(/\\/?$/,"/"),location.href)).href'
    "})(),__mdVendor=function(p){return __mdVendorBase+p};\n"
)


def fetch(url, browser=False):
    """Download `url`, caching the bytes under .cache/vendor/ across builds."""
    os.makedirs(CACHE, exist_ok=True)
    hit = os.path.join(CACHE, hashlib.sha256(url.encode()).hexdigest()[:16])
    if os.path.exists(hit):
        with open(hit, "rb") as f:
            return f.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA if browser else "curl/8"})
    data = urllib.request.urlopen(req, timeout=60).read()
    with open(hit, "wb") as f:
        f.write(data)
    return data


def vendor_name(url):
    """Local <subdir>/<file> for an unpkg URL (bare package URLs serve JS)."""
    leaf = url.rstrip("/").split("/")[-1].split("?")[0]
    if leaf.endswith(".css"):
        return f"css/{leaf}"
    if leaf.endswith(".js"):
        return f"js/{leaf}"
    return "js/" + re.sub(r"[^a-zA-Z0-9._-]", "-", leaf) + ".js"


def main():
    site = sys.argv[1]
    vendor = os.path.join(site, "assets", "vendor")
    for sub in ("fonts", "js", "css"):
        os.makedirs(os.path.join(vendor, sub), exist_ok=True)

    # External refs live in HTML (<link>), the JS bundle (dynamic loaders) and
    # sometimes CSS. Scan + rewrite all of them, but never the vendored files.
    text_files = [
        f
        for ext in ("html", "js", "css")
        for f in glob.glob(f"{site}/**/*.{ext}", recursive=True)
        if "/assets/vendor/" not in f.replace("\\", "/")
    ]
    blob = "\n".join(open(f, encoding="utf-8", errors="replace").read() for f in text_files)
    # external URL -> path under assets/vendor/
    rewrites = {}

    # --- Google Fonts: fetch the CSS, pull its woff2 files local, rewrite url()s ---
    m = re.search(r'https://fonts\.googleapis\.com/css\?[^"\'> ]+', blob)
    if m:
        html_url = m.group(0)  # may contain &amp;
        css = fetch(html_url.replace("&amp;", "&"), browser=True).decode("utf-8")
        for furl in sorted(set(re.findall(r'https://fonts\.gstatic\.com/[^)\'" ]+', css))):
            ext = ".woff2" if ".woff2" in furl else (".woff" if ".woff" in furl else ".ttf")
            name = hashlib.md5(furl.encode()).hexdigest()[:12] + ext
            with open(os.path.join(vendor, "fonts", name), "wb") as f:
                f.write(fetch(furl))
            # fonts.css sits in vendor/, the files in vendor/fonts/.
            css = css.replace(furl, f"fonts/{name}")
        with open(os.path.join(vendor, "fonts.css"), "w", encoding="utf-8") as f:
            f.write(css)
        rewrites[html_url] = "fonts.css"

    # --- unpkg.com JS/CSS (mermaid, glightbox, polyfills) ---
    for url in sorted(set(re.findall(r'https://unpkg\.com/[^"\'> ]+', blob))):
        name = vendor_name(url)
        with open(os.path.join(vendor, name), "wb") as f:
            f.write(fetch(url))
        rewrites[url] = name

    # --- rewrite every text file; drop the now-useless gstatic preconnect ---
    for tf in text_files:
        s = orig = open(tf, encoding="utf-8", errors="replace").read()
        if tf.endswith(".js"):
            # String literals consumed by the bundle's script/style loaders —
            # resolve them at runtime, relative to the bundle itself.
            for url, name in rewrites.items():
                s = re.sub(
                    r"(['\"`])" + re.escape(url) + r"\1",
                    lambda _m, n=name: f'__mdVendor("{n}")',
                    s,
                )
            if s != orig:
                s = RESOLVER + s
        else:
            # HTML/CSS: a path relative to this file works at any serve prefix.
            rel = os.path.relpath(vendor, os.path.dirname(tf)).replace(os.sep, "/")
            for url, name in rewrites.items():
                s = s.replace(url, f"{rel}/{name}")
            if tf.endswith(".html"):
                s = re.sub(r"<link[^>]*fonts\.gstatic\.com[^>]*>", "", s)
        if s != orig:
            with open(tf, "w", encoding="utf-8") as f:
                f.write(s)

    print(f"vendored {len(rewrites)} external asset(s) into {vendor}/")


if __name__ == "__main__":
    main()

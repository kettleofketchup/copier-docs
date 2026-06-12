#!/usr/bin/env python3
"""Vendor external assets (Google Fonts, unpkg JS/CSS) into a built site so it
serves fully offline / airgapped — zensical has no offline plugin. Run after
`zensical build`, with network (i.e. in the Docker image build).

    vendor_assets.py <site_dir>

Rewrites references to root-absolute /assets/vendor/... paths, so the site must be
served at the domain root (which the nginx image does). `:material-*` icons are
already inlined SVG, so nothing to do there.
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


def fetch(url, browser=False):
    req = urllib.request.Request(
        url, headers={"User-Agent": UA if browser else "curl/8"}
    )
    return urllib.request.urlopen(req, timeout=60).read()


def main():
    site = sys.argv[1]
    vendor = os.path.join(site, "assets", "vendor")
    for sub in ("fonts", "js", "css"):
        os.makedirs(os.path.join(vendor, sub), exist_ok=True)

    # External refs live in HTML (<link>) and the JS bundle (dynamic loaders),
    # sometimes CSS. Scan + rewrite all of them, but never the vendored files.
    text_files = [
        f
        for ext in ("html", "js", "css")
        for f in glob.glob(f"{site}/**/*.{ext}", recursive=True)
        if "/assets/vendor/" not in f.replace("\\", "/")
    ]
    blob = "\n".join(open(f, encoding="utf-8", errors="replace").read() for f in text_files)
    rewrites = {}

    # --- Google Fonts: fetch the CSS, pull its woff2 files local, rewrite url()s ---
    m = re.search(r'https://fonts\.googleapis\.com/css\?[^"\'> ]+', blob)
    if m:
        html_url = m.group(0)                       # may contain &amp;
        css = fetch(html_url.replace("&amp;", "&"), browser=True).decode("utf-8")
        for furl in sorted(set(re.findall(r'https://fonts\.gstatic\.com/[^)\'" ]+', css))):
            ext = ".woff2" if ".woff2" in furl else (".woff" if ".woff" in furl else ".ttf")
            name = hashlib.md5(furl.encode()).hexdigest()[:12] + ext
            with open(os.path.join(vendor, "fonts", name), "wb") as f:
                f.write(fetch(furl))
            css = css.replace(furl, f"/assets/vendor/fonts/{name}")
        with open(os.path.join(vendor, "fonts.css"), "w", encoding="utf-8") as f:
            f.write(css)
        rewrites[html_url] = "/assets/vendor/fonts.css"

    # --- unpkg.com JS/CSS (mermaid, glightbox, polyfills) ---
    for url in sorted(set(re.findall(r'https://unpkg\.com/[^"\'> ]+', blob))):
        leaf = url.rstrip("/").split("/")[-1].split("?")[0]
        if leaf.endswith(".css"):
            sub, name = "css", leaf
        elif leaf.endswith(".js"):
            sub, name = "js", leaf
        else:
            sub, name = "js", re.sub(r"[^a-zA-Z0-9._-]", "-", leaf) + ".js"
        with open(os.path.join(vendor, sub, name), "wb") as f:
            f.write(fetch(url))
        rewrites[url] = f"/assets/vendor/{sub}/{name}"

    # --- rewrite every text file; drop the now-useless gstatic preconnect ---
    for tf in text_files:
        s = open(tf, encoding="utf-8", errors="replace").read()
        for ext, loc in rewrites.items():
            s = s.replace(ext, loc)
        if tf.endswith(".html"):
            s = re.sub(r'<link[^>]*fonts\.gstatic\.com[^>]*>', "", s)
        with open(tf, "w", encoding="utf-8") as f:
            f.write(s)

    print(f"vendored {len(rewrites)} external asset(s) into {vendor}/")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Rewrite root-absolute internal links to page-relative ones.

Markdown links written as `/page/` (e.g. in shared _includes/cards snippets,
which are included from pages at different depths) pass through zensical
verbatim. They only resolve when the site is served at the domain root — but
GitLab/GitHub Pages serve project sites under a `/<project>/` prefix, so those
links 404 there. This rewrites every root-absolute href/src in the built HTML —
and every root-absolute `url(/...)` in the built CSS (e.g. tab-icon masks in a
custom stylesheet) — to be relative to its file, making the output
prefix-agnostic like the rest of zensical's links.

    relativize_links.py <site_dir>
"""
import glob
import os
import re
import sys

# `="/foo` (href/src), leaving protocol-relative `="//host` alone.
HTML_RE = re.compile(r'((?:href|src)=")/(?!/)')
# `url(/foo`, `url("/foo`, `url('/foo` — leaving `url(//host` alone.
CSS_RE = re.compile(r'(url\((["\']?))/(?!/)')


def rewrite(site, pattern, glob_pat):
    rewritten = 0
    for path in glob.glob(f"{site}/**/{glob_pat}", recursive=True):
        depth = os.path.relpath(path, site).count(os.sep)
        prefix = "../" * depth if depth else "./"
        s = open(path, encoding="utf-8").read()
        out, n = pattern.subn(lambda m: m.group(1) + prefix, s)
        if n:
            open(path, "w", encoding="utf-8").write(out)
            rewritten += n
    return rewritten


def main():
    site = sys.argv[1]
    html = rewrite(site, HTML_RE, "*.html")
    css = rewrite(site, CSS_RE, "*.css")
    print(f"relativized {html} html link(s) + {css} css url(s) in {site}/")


if __name__ == "__main__":
    main()

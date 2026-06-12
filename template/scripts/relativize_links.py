#!/usr/bin/env python3
"""Rewrite root-absolute internal links to page-relative ones.

Markdown links written as `/page/` (e.g. in shared _includes/cards snippets,
which are included from pages at different depths) pass through zensical
verbatim. They only resolve when the site is served at the domain root — but
GitLab/GitHub Pages serve project sites under a `/<project>/` prefix, so those
links 404 there. This rewrites every root-absolute href/src in the built HTML
to be relative to its page, making the output prefix-agnostic like the rest of
zensical's links.

    relativize_links.py <site_dir>
"""
import glob
import os
import re
import sys


def main():
    site = sys.argv[1]
    rewritten = 0

    for path in glob.glob(f"{site}/**/*.html", recursive=True):
        depth = os.path.relpath(path, site).count(os.sep)
        prefix = "../" * depth if depth else "./"
        s = open(path, encoding="utf-8").read()
        # `/foo` -> relative; leave protocol-relative `//host` URLs alone
        out, n = re.subn(r'((?:href|src)=")/(?!/)', rf"\1{prefix}", s)
        if n:
            open(path, "w", encoding="utf-8").write(out)
            rewritten += n

    print(f"relativized {rewritten} root-absolute link(s) in {site}/")


if __name__ == "__main__":
    main()

# Backport inf-docs theme + infra improvements into the template

**Date:** 2026-06-12
**Source:** `inf-docs` divergence since scaffold commit `fa4d86a` (template v0.2.0)
**Target:** copier-docs v0.3.0

## Goal

Everything generically useful that inf-docs grew after scaffolding comes back
into the template, so future `copier copy` / `copier update` projects get it
for free. Nothing network-specific (hostnames, branding, the graynet/darknet
dual-audience build) is stored in the template.

## What ports (and why)

1. **Full `markdown_extensions` set** — zensical disables its implicit default
   extensions the moment any one extension is configured. The template
   configures `pymdownx.snippets`, so generated sites silently lose
   admonitions, content tabs, etc. Port the explicit full set from
   `base.toml` (incl. `toc.permalink`, mermaid superfences, emoji).
2. **Drop `navigation.instant` / `navigation.instant.prefetch`** — broke the
   logo/header whenever the serving host differs from `site_url` (localhost
   preview, Pages prefix). Disabled deliberately in inf-docs (`e2fe636`).
3. **Dark-purple theme** — palette `slate` / `deep-purple` / `purple` in the
   toml plus `docs/stylesheets/extra.css`: purple-tinted darker backgrounds,
   translucent blended header/tabs, styled content tabs (bordered box, purple
   active pill), purple titles/selection, card-grid elevation + hover, larger
   header logo. Comments de-branded. Icon `url()`s made **relative**
   (`../assets/icons/…`) so the CSS works under any site prefix (inf-docs
   uses root-absolute ones, which only resolve at a domain root).
4. **Nav tab icons** — masked-SVG-via-`currentColor` pattern + five generic
   Material Design icons (`home`, `gitlab`, `guides`, `services`, `network`).
   First tab always gets the home icon; the href-matched rules are inert until
   a project has matching sections. `swap.svg` (cxacopy) and the favicon-based
   AI tab rule stay behind.
5. **Card includes ("macros")** — `_includes/cards/` snippet pattern with one
   generic example card, demonstrated in `docs/showcase.md` via
   `--8<-- "_includes/cards/example.md"` inside a `grid cards` div. Works via
   the existing snippets `base_path = ["docs", "."]`.
6. **`scripts/relativize_links.py`** — rewrites root-absolute hrefs in built
   HTML to page-relative, making output prefix-agnostic (GitLab Pages serves
   project sites under `/<project>/`). Wired into `just docs::build`.
7. **`scripts/vendor_assets.py`** — vendors Google Fonts / unpkg assets into
   the built site so the nginx image serves fully offline / airgapped. Wired
   into `docker/Dockerfile.docs` (stdlib only, no new deps).
8. **`just docs::build`** gains `--clean --strict` + relativize step;
   **`docs::lint`** enables pymarkdown front-matter support.
9. **GitLab CI hardening** — `docker login --password-stdin`; new copier
   questions:
   - `repo_url` (default empty) → header repo link, "edit this page" pencil
     (`edit_uri` per platform), repo icon, social link.
   - `gitlab_runner_tag` (default empty, gitlab-only) → `tags:` on the uv jobs.
   - `docker_build_strategy` (`dood` default | `dind`, gitlab-only) → dood
     variant builds on the runner host's daemon: `tags: [dood]`, no dind
     service, per-job `DOCKER_CONFIG` so concurrent logins don't collide.

## What stays out (graynet-specific)

- Multi-audience build system: `base.toml` + `graynet.toml`/`darknet.toml`
  overlays, `render_config.py`, `prune_audience.py` (audience names are
  hardcoded), `docs-darknet` staging, `AUDIENCE` build-arg, `tomli-w` dep.
- cxacopy Claude skill, `publish-skill` / `publish-help` CI jobs, s3-sync
  component include, copyparty mirroring.
- All graynet branding/content: edge logo, favicon, site names/URLs, the
  service card contents, `/cxacopy/`+`/localai/` CSS rules, graynet/darknet
  tag icons.

## Compatibility

All new questions have defaults, so `copier update` on existing projects works
non-interactively. `just copier::test` is extended: the gitlab variant
exercises `repo_url` + `dood`; the github variant keeps defaults (empty
`repo_url`, no gitlab questions) and still builds the site end-to-end.

## Release

Commit, run `just copier::test`, tag `v0.3.0`, push with tags (copier resolves
the latest tag on update).

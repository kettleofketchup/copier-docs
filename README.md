# copier-docs

A [Copier](https://copier.readthedocs.io) template for **Zensical** documentation
sites, with a choice of **GitLab CI** or **GitHub Actions** for build + publish,
an nginx Docker image of the built site, `just` task automation, and lefthook
git hooks. Generated projects stay updatable via `copier update`.

Companion to [`go-template`](https://github.com/kettleofketchup/go-template) —
that one scaffolds Go CLIs; this one scaffolds documentation sites.

## Create a new docs site

```bash
# from GitHub
copier copy gh:kettleofketchup/copier-docs my-docs
# or from a clone
copier copy git@github.com:kettleofketchup/copier-docs.git my-docs
```

You'll be asked for the project name, site title/description/URL, author, and CI
platform (GitLab or GitHub). Then:

```bash
cd my-docs
./dev               # install uv + just, sync deps, install lefthook
just docs::live     # live preview at http://localhost:8000
```

## Update an existing site from the template

```bash
cd my-docs
just copier::update     # or: copier update --trust
```

Copier performs a three-way merge against the version recorded in
`.copier-answers.yml`. Commit your work first — `copier update` needs a clean tree.

## What gets generated

| Area | Tooling |
|------|---------|
| Site generator | Zensical (built with uv) |
| Tasks | `just` modules: `docs::`, `docker::`, `version::`, `cicd::`, `copier::` |
| Git hooks | lefthook (markdown lint, codespell, ruff) |
| CI/CD | GitLab CI **or** GitHub Actions — thin wrappers calling `just cicd::*` |
| Publish | GitLab Pages / GitHub Pages + nginx container image |

## Developing this template

```bash
./dev
just copier::test        # generate gitlab + github sample projects into .copier-test/
```

CI (`.github/workflows/test-template.yml`) generates both variants on every push
and asserts the right files are produced.

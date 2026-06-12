# Template development recipes — generate + verify test projects from this template.
# Run with `uv run` so copier comes from the dev dependency group.
#
# Copier picks the latest git tag by default, so we generate from the *working
# tree* instead: `git stash create` captures the staged/working state as a
# throwaway commit and we point `--vcs-ref` at it (falling back to HEAD).

OUT := ".copier-test"

# Generate a GitLab-CI variant into .copier-test/gitlab
[no-cd]
[group('copier')]
test-gitlab:
    #!/usr/bin/env bash
    set -euo pipefail
    ref=$(git stash create || true); ref=${ref:-HEAD}
    rm -rf {{OUT}}/gitlab
    uv run copier copy . {{OUT}}/gitlab --trust --defaults --vcs-ref "$ref" \
        -d project_name=demo-docs \
        -d ci_platform=gitlab \
        -d gitlab_url=gitlab.example.com \
        -d gitlab_registry=gitlab.example.com:5050/demo-docs \
        -d repo_url=https://gitlab.example.com/demo/demo-docs \
        -d gitlab_runner_tag=docker \
        -d docker_build_strategy=dood

# Generate a GitHub-Actions variant into .copier-test/github
[no-cd]
[group('copier')]
test-github:
    #!/usr/bin/env bash
    set -euo pipefail
    ref=$(git stash create || true); ref=${ref:-HEAD}
    rm -rf {{OUT}}/github
    uv run copier copy . {{OUT}}/github --trust --defaults --vcs-ref "$ref" \
        -d project_name=demo-docs \
        -d ci_platform=github \
        -d github_registry=ghcr.io/acme/demo-docs

# End-to-end: generate both variants, assert files, build the site, then clean up
[no-cd]
[group('copier')]
test: test-gitlab test-github
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Asserting generated files ==="
    test -f {{OUT}}/gitlab/.gitlab-ci.yml                  || { echo "missing root .gitlab-ci.yml"; exit 1; }
    test -f {{OUT}}/gitlab/ci/docs.gitlab-ci.yml           || { echo "missing ci/docs.gitlab-ci.yml"; exit 1; }
    test ! -d {{OUT}}/gitlab/.github                       || { echo ".github should not exist (gitlab)"; exit 1; }
    test -f {{OUT}}/github/.github/workflows/docs.yml         || { echo "missing docs.yml"; exit 1; }
    test -f {{OUT}}/github/.github/workflows/docs-release.yml || { echo "missing docs-release.yml"; exit 1; }
    test ! -f {{OUT}}/github/.gitlab-ci.yml                 || { echo ".gitlab-ci.yml should not exist (github)"; exit 1; }
    grep -q "just docs::build"      {{OUT}}/gitlab/ci/docs.gitlab-ci.yml
    grep -q "docs-release-image"    {{OUT}}/gitlab/ci/docs.gitlab-ci.yml
    grep -q "just docs::build"      {{OUT}}/github/.github/workflows/docs.yml
    echo "=== Asserting theme + new options ==="
    test -f {{OUT}}/gitlab/docs/stylesheets/extra.css      || { echo "missing extra.css (gitlab)"; exit 1; }
    test -f {{OUT}}/github/docs/stylesheets/extra.css      || { echo "missing extra.css (github)"; exit 1; }
    test -f {{OUT}}/gitlab/_includes/cards/example.md      || { echo "missing _includes/cards/example.md"; exit 1; }
    test -f {{OUT}}/gitlab/scripts/relativize_links.py     || { echo "missing relativize_links.py"; exit 1; }
    grep -q 'repo_url = "https://gitlab.example.com/demo/demo-docs"' {{OUT}}/gitlab/zensical.toml || { echo "repo_url not rendered (gitlab)"; exit 1; }
    ! grep -q 'repo_url'            {{OUT}}/github/zensical.toml || { echo "repo_url should be absent (github)"; exit 1; }
    grep -q 'DOCKER_CONFIG'         {{OUT}}/gitlab/ci/docs.gitlab-ci.yml || { echo "dood DOCKER_CONFIG missing"; exit 1; }
    ! grep -q 'docker:dind'         {{OUT}}/gitlab/ci/docs.gitlab-ci.yml || { echo "dind service should be absent (dood)"; exit 1; }
    grep -q -- '--password-stdin'   {{OUT}}/gitlab/ci/docs.gitlab-ci.yml || { echo "login should use --password-stdin"; exit 1; }
    echo "=== Generated justfile parses (both variants) ==="
    just --justfile {{OUT}}/gitlab/justfile --list >/dev/null || { echo "gitlab justfile failed to parse"; exit 1; }
    just --justfile {{OUT}}/github/justfile --list >/dev/null || { echo "github justfile failed to parse"; exit 1; }
    echo "=== Building generated site (github variant) ==="
    cd {{OUT}}/github
    uv sync
    uv run zensical build --strict
    uv run python scripts/relativize_links.py site
    test -f site/index.html || { echo "site/index.html not built"; exit 1; }
    test -f site/stylesheets/extra.css || { echo "extra.css not in built site"; exit 1; }
    echo "=== Template test passed; cleaning up ==="
    cd - >/dev/null
    rm -rf {{OUT}}

# Remove generated test output
[no-cd]
[group('copier')]
clean:
    rm -rf {{OUT}}

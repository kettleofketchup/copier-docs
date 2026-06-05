# Template development recipes — generate + verify test projects from this template.
# Run with `uv run` so copier comes from the dev dependency group.

OUT := ".copier-test"

# Generate a GitLab-CI variant into .copier-test/gitlab
[no-cd]
[group('copier')]
test-gitlab:
    rm -rf {{OUT}}/gitlab
    uv run copier copy . {{OUT}}/gitlab --trust --defaults \
        -d project_name=demo-docs \
        -d ci_platform=gitlab \
        -d gitlab_url=gitlab.example.com \
        -d gitlab_registry=gitlab.example.com:5050/demo-docs

# Generate a GitHub-Actions variant into .copier-test/github
[no-cd]
[group('copier')]
test-github:
    rm -rf {{OUT}}/github
    uv run copier copy . {{OUT}}/github --trust --defaults \
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
    test -f {{OUT}}/gitlab/.gitlab-ci.yml          || { echo "missing .gitlab-ci.yml"; exit 1; }
    test ! -d {{OUT}}/gitlab/.github               || { echo ".github should not exist (gitlab)"; exit 1; }
    test -f {{OUT}}/github/.github/workflows/ci.yml || { echo "missing ci.yml"; exit 1; }
    test ! -f {{OUT}}/github/.gitlab-ci.yml         || { echo ".gitlab-ci.yml should not exist (github)"; exit 1; }
    grep -q "just cicd::build" {{OUT}}/gitlab/.gitlab-ci.yml
    grep -q "just cicd::build" {{OUT}}/github/.github/workflows/ci.yml
    echo "=== Building generated site (github variant) ==="
    cd {{OUT}}/github
    uv sync
    uv run zensical build
    test -f site/index.html || { echo "site/index.html not built"; exit 1; }
    echo "=== Template test passed; cleaning up ==="
    cd - >/dev/null
    rm -rf {{OUT}}

# Remove generated test output
[no-cd]
[group('copier')]
clean:
    rm -rf {{OUT}}

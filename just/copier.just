# Template development recipes — generate test projects from this template.
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

# Generate both variants
[no-cd]
[group('copier')]
test: test-gitlab test-github

# Remove generated test output
[no-cd]
[group('copier')]
clean:
    rm -rf {{OUT}}

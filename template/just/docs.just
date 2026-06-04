# Live-reload preview at http://localhost:8000
[no-cd]
[group('docs')]
live:
    uv run zensical serve

# Build the static site into site/
[no-cd]
[group('docs')]
build:
    uv run zensical build

# Validate: lefthook checks (markdown/spelling/ruff) + a clean build
[no-cd]
[group('docs')]
validate:
    uv run lefthook run pre-commit --all-files
    uv run zensical build

# Remove build output
[no-cd]
[group('docs')]
clean:
    rm -rf site

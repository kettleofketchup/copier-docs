# The docs purpose — everything this template contributes lives under `docs::`
# so it slots into a mixed repo without colliding with other tooling.

# Local image tag for dev builds
local_image := "docs:local"

# Live-reload preview at http://localhost:8000
[no-cd]
[group('docs')]
live:
    uv run zensical serve

# Build the static site into site/ (then make root-absolute links relative so
# the output works under a Pages /<project>/ prefix)
[no-cd]
[group('docs')]
build:
    uv run zensical build --clean --strict
    uv run python scripts/relativize_links.py site

# Lint docs: markdown syntax + spelling (CI calls this too)
[no-cd]
[group('docs')]
lint:
    uv run pymarkdown --set 'extensions.front-matter.enabled=$!True' --disable-rules MD013,MD033,MD041,MD030,MD046 scan docs
    uv run codespell docs includes

# Validate everything: lint, then a clean build
[no-cd]
[group('docs')]
validate: lint build

# Remove build output
[no-cd]
[group('docs')]
clean:
    rm -rf site

# Build the nginx docs image locally (tag docs:local)
[no-cd]
[group('docs')]
image-build:
    docker build -t {{local_image}} -f docker/Dockerfile.docs .

# Build then serve the image at http://localhost:8080
[no-cd]
[group('docs')]
image-run: image-build
    docker run --rm -p 8080:80 {{local_image}}

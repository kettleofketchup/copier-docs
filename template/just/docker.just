# Local image tag for dev builds
image := "docs:local"

# Build the nginx docs image locally
[no-cd]
[group('docker')]
build:
    docker build -t {{image}} -f docker/Dockerfile .

# Build then run the docs image at http://localhost:8080
[no-cd]
[group('docker')]
run: build
    docker run --rm -p 8080:80 {{image}}

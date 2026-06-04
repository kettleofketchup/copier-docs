# Print the current version
[no-cd]
[group('version')]
show:
    cat VERSION

# Bump VERSION (part = major | minor | patch)
[no-cd]
[group('version')]
bump part="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    cur=$(cat VERSION)
    IFS=. read -r major minor patch <<< "$cur"
    case "{{part}}" in
      major) major=$((major+1)); minor=0; patch=0 ;;
      minor) minor=$((minor+1)); patch=0 ;;
      patch) patch=$((patch+1)) ;;
      *) echo "part must be major|minor|patch" >&2; exit 1 ;;
    esac
    new="$major.$minor.$patch"
    echo "$new" > VERSION
    echo "VERSION: $cur -> $new"

# Create an annotated git tag from VERSION
[no-cd]
[group('version')]
tag:
    #!/usr/bin/env bash
    set -euo pipefail
    v=$(cat VERSION)
    git tag -a "v$v" -m "Release v$v"
    echo "Tagged v$v (push with: git push origin v$v)"

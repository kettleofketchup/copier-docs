# Git / release recipes for this template repo.
# Call as: just git::version hotfix

# Bump the version tag and push it (usage: just git::version major|minor|hotfix)
[group('git')]
[no-cd]
version bump:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "{{ bump }}" != "major" && "{{ bump }}" != "minor" && "{{ bump }}" != "hotfix" ]]; then
        echo "Usage: just git::version major|minor|hotfix" >&2
        exit 1
    fi
    LATEST=$(git tag --list 'v*' --sort=-v:refname | head -1)
    [[ -z "$LATEST" ]] && LATEST="v0.0.0"
    echo "Current version: $LATEST"
    VERSION="${LATEST#v}"
    IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
    case "{{ bump }}" in
        major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
        minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
        hotfix) PATCH=$((PATCH + 1)) ;;
    esac
    NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"
    echo "New version: $NEW_TAG"
    git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
    git push origin "$NEW_TAG"
    echo "Tag $NEW_TAG created and pushed."

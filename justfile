set quiet

mod copier 'just/copier.just'    # copier::test-gitlab, copier::test-github, copier::test, copier::clean

# Default: list available recipes
default:
    just --list

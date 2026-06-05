set quiet

mod copier 'just/copier.just'    # copier::test-gitlab, copier::test-github, copier::test, copier::clean
mod git 'just/git.just'          # git::version major|minor|hotfix

# Default: list available recipes
default:
    just --list

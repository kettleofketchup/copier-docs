# Bootstrap the docs toolchain: uv env, deps, and lefthook hooks
[group('dev')]
dev:
    uv sync
    uv run lefthook install
    echo "Ready. Run 'just docs::live' to start the preview server."

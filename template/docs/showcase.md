# Showcase

A tour of the formatting available in this template. Hover any abbreviation like
HTML or CSS to see the tooltip — defined once in `includes/abbreviations.md` and
auto-appended to every page via `pymdownx.snippets`.

## Admonitions

!!! note
    Use admonitions to call out information.

!!! warning "Heads up"
    Warnings draw the eye.

??? tip "Collapsible details"
    This block is collapsed by default.

## Syntax highlighting

Fenced code blocks are highlighted with line numbers and a copy button.

```python title="hello.py" linenums="1"
def greet(name: str) -> str:
    """Return a friendly greeting."""
    return f"Hello, {name}!"


print(greet("world"))
```

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, world!")
}
```

Inline code highlighting also works: `#!python sorted([3, 1, 2])`.

## Content tabs

=== "uv"

    ```bash
    uv run zensical serve
    ```

=== "Docker"

    ```bash
    docker run --rm -p 8000:8000 -v ${PWD}:/docs zensical/zensical serve -a 0.0.0.0:8000
    ```

## Card grid

<div class="grid cards" markdown>

-   :material-language-markdown: **Markdown-first**

    ---

    Write plain Markdown; Zensical handles the rest.

-   :material-source-branch: **Versioned**

    ---

    `just version::bump` and `just version::tag` cut releases.

</div>

## Diagrams

```mermaid
graph LR
  A[Write docs] --> B{CI}
  B -->|build| C[Pages]
  B -->|image| D[Registry]
```

## Math

Inline: $f(x) = x^2$. Block:

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

## Markdown includes

Reuse shared snippets across pages with `pymdownx.snippets`. The glossary in
`includes/abbreviations.md` is appended to every page automatically (see
`zensical.toml`), but you can also pull any file inline:

```text
--8<-- "includes/abbreviations.md"
```

## Reusable cards

Card snippets live in `_includes/cards/` (one file per card) and can be
included into a grid on any page — write internal links inside them
root-absolute (`/page/`); `just docs::build` rewrites them to page-relative so
they resolve at any include depth and under any site prefix:

```text
<div class="grid cards" markdown>
--8<-- "_includes/cards/example.md"
</div>
```

<div class="grid cards" markdown>
--8<-- "_includes/cards/example.md"
</div>

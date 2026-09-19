# Migrating from v2 to v3

Use this reference when upgrading content or code that uses v2 `<!-- name:start -->` / `<!-- name:end -->` markers. The syntax change is mechanical, but several behaviors change.

## Syntax

v3 moves the name into an `id` attribute on a single `comment-mark` comment:

```diff
 ## Last updated
-<!-- lastUpdated:start -->2026-09-07<!-- lastUpdated:end -->
+<!--comment-mark id="lastUpdated"-->2026-09-07<!--/comment-mark-->
```

The closing comment no longer repeats the name.

## API

| v2 | v3 |
| --- | --- |
| `commentMark(input, data)` | Same signature and validation; `data` entries may also be functions that receive `(attributes, content)` and return the replacement |
| `getCommentMarks(input)` | Same signature and object shape; also validates the whole document |
| none | New: `getCommentMarkers(input)` reads every marker, including unnamed ones |

## CLI

- Update mode is unchanged: `--<id>=<value>`.
- Read mode now prints an array of marker objects, not an object keyed by `id`:

```diff
-comment-mark README.md | jq -r '.contributors'
+comment-mark README.md | jq -r '.[] | select(.id == "contributors") | .content'
```

## Runtime

v3 requires Node.js 22.22.2 or newer. v2 supported Node.js 20.

## Behavior changes

| Change | Consequence |
| --- | --- |
| Markers in fenced code and inline code are ignored | A v2 marker shown as a documentation example no longer updates. This is the fix that stops examples from being treated as real markers |
| Nested markers abort parsing | v3 throws `Nested marker ... is not supported`. v2 matched a start with the next same-named end, so same-named nesting silently paired an outer start with an inner end, while differently named markers were independent |
| Unnamed markers are readable | New capability: `getCommentMarkers` returns markers with no `id`; `getCommentMarks` still omits them |
| Attributes must be separated by whitespace | New grammar: v2 marker names were free-form text. `id="a"file="b"` now throws `Expected whitespace between attributes` |
| Updates validate the whole document | A malformed, nested, or unterminated marker anywhere aborts the update, even when it is unrelated to the requested keys |

## Rewriting a tree

There is no bundled codemod. For each file, replace the opening comment `<name>:start` with `comment-mark id="<name>"` and the closing comment `<name>:end` with `/comment-mark`. Then validate:

```sh
npx comment-mark path/to/file.md
```

Read mode validates only `comment-mark` syntax. It ignores v2 markers, so an entirely unmigrated document prints `[]` and still exits 0; it does not confirm that a migration is complete. To check a tree, look for remaining `:start`/`:end` comments (for example, `grep -rE '<!--[^>]*:(start|end)[^>]*-->' path/to/tree`) and confirm read mode lists the markers you expect. Do not rewrite quoted or non-ASCII names with an unescaped shell one-liner; check each result when the names vary.

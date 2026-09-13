# Migrating from v2 to v3

Use this reference when upgrading content or code that uses v2 `<!-- name:start -->` / `<!-- name:end -->` markers. The syntax change is mechanical; two behavior changes are silent.

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
| `commentMark(input, data)` | unchanged |
| `getCommentMarks(input)` | unchanged, still an object keyed by `id` |
| none | `getCommentMarkers(input)` reads every marker, including unnamed ones |

## CLI

- Update mode is unchanged: `--<id>=<value>`.
- Read mode now prints an array of marker objects, not an object keyed by `id`:

```diff
-comment-mark README.md | jq -r '.contributors'
+comment-mark README.md | jq -r '.[] | select(.id == "contributors") | .content'
```

## Silent behavior changes

| Change | Consequence |
| --- | --- |
| Markers in fenced code and inline code are ignored | A v2 marker shown as a documentation example no longer updates. This is the fix that stops examples from being treated as real markers |
| Nested markers abort parsing | v2 paired an outer opening with an inner closing; v3 throws `Nested marker ... is not supported` |
| Unnamed markers are readable | `getCommentMarkers` returns markers with no `id`; `getCommentMarks` still omits them |
| Attributes must be separated by whitespace | `id="a"file="b"` now throws `Expected whitespace between attributes` |

## Rewriting a tree

There is no bundled codemod. For each file, replace the opening comment `<name>:start` with `comment-mark id="<name>"` and the closing comment `<name>:end` with `/comment-mark`. Then validate:

```sh
npx comment-mark path/to/file.md
```

Read mode exits non-zero on a malformed or unterminated marker, so it doubles as a check. Do not rewrite quoted or non-ASCII names with an unescaped shell one-liner; check each result when the names vary.

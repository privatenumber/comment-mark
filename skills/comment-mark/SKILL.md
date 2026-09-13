---
name: comment-mark
description: Editing, updating, or reading comment-mark sections in Markdown or HTML, including the `comment-mark` CLI, the `commentMark` / `getCommentMarks` / `getCommentMarkers` API, or migrating v2 `<!-- name:start -->` markers.
---

# comment-mark

This skill covers comment-mark's marker syntax, JavaScript API, and CLI. Read `references/migration-v2.md` for v2 `<!-- name:start -->` markers and `references/cli.md` for full CLI behavior.

## Marker syntax

```md
<!--comment-mark id="contributors"-->{{ content }}<!--/comment-mark-->
```

- The opening comment declares `id` and any additional attributes. The closing comment is always `<!--/comment-mark-->`.
- Whitespace inside the tags is padding, so `<!-- comment-mark id="contributors" -->` is equivalent.
- Markers without an `id` are valid. `attrs` holds every attribute except `id`.
- Updates replace only the content between the comments. The comments themselves are preserved.
- Markers cannot nest. An opening marker inside another open marker aborts parsing.
- Characters are case-sensitive and matched verbatim, including `id` casing and dashes.

## JavaScript API

| Function | Purpose | Returns |
| --- | --- | --- |
| `commentMark(input, data)` | Replace each marker's content with `data[id]` | Updated `string`; returns the input unchanged when required arguments are invalid |
| `getCommentMarks(input)` | Read content keyed by `id` | `Record<string, string>`, null prototype |
| `getCommentMarkers(input)` | Read every marker, including unnamed ones | `CommentMark[]` |

- `commentMark` skips `null`/`undefined` values, updates every occurrence of an `id`, and silently ignores keys with no marker.
- A multiline value gets a newline added on each side.
- `getCommentMarks` keeps the last occurrence of a duplicate `id`.
- Each `CommentMark` is `{ id?, attrs, content }`.

## CLI

```sh
npx comment-mark <file> [--<id>=<value>...]
```

`--<id>=<value>` sets a marker. The flag name matches the `id` verbatim, with no kebab/camel conversion. Without flags, the CLI prints every marker as JSON. See `references/cli.md` for statuses, exit codes, and exact matching.

## Rules and gotchas

| Situation | Do this |
| --- | --- |
| A file documents the marker syntax | Put examples in a fenced code block or inline code so they are ignored |
| `id` appears more than once | `commentMark` updates all; `getCommentMarks` keeps the last |
| Marker missing during update | The API skips it; the CLI prints `Missing` and exits `1` |
| Value is multiline | Pass it as-is; surrounding newlines are added automatically |
| v2 `<!-- name:start -->` markers | Read `references/migration-v2.md` |

Code regions: fenced code blocks (backtick or tilde, including `>` blockquote prefixes) and single-line inline code are ignored, so documentation examples stay literal. Indented code blocks and code spans that wrap across lines are not detected. Put active markers in prose; put literal examples inside fenced or single-line inline code.

## Resources

- Read `references/migration-v2.md` when migrating v2 `<!-- name:start -->` / `<!-- name:end -->` markers to v3.
- Read `references/cli.md` when scripting the CLI or depending on its output and exit codes.

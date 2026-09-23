---
name: comment-mark
description: Editing, updating, or reading comment-mark sections in Markdown or HTML, including the `comment-mark` CLI, the `commentMark` / `getCommentMark` API, selectors, or migrating v2 `<!-- name:start -->` markers.
---

# comment-mark

This skill covers comment-mark's marker syntax, selectors, JavaScript API, and CLI. Read `references/migration-v2.md` for v2 `<!-- name:start -->` markers and `references/cli.md` for full CLI behavior.

## Marker syntax

```md
<!-- contributors role="maintainer" -->{{ content }}<!-- /contributors -->
```

- A marker is a matching pair of comments. The opening comment names the section with a tag name and optional attributes; the closing comment repeats the tag name after a `/`.
- The pair is what makes it a marker: `<!-- TODO -->` stays an ordinary comment until a matching `<!-- /TODO -->` follows.
- Whitespace inside the comments is padding, so `<!-- contributors -->` and `<!--contributors-->` are equivalent.
- An update replaces the content between the comments; the opening comment's attributes can also change. The tag name and the closing comment stay as written, so later updates still find the section.
- Only the outermost pair is a marker. A pair nested inside another pair stays part of the outer marker's content.
- Tag names and attribute names are case-sensitive and matched verbatim.

## Selectors

A selector is a tag name plus optional attribute predicates:

| Selector | Matches |
| --- | --- |
| `contributors` | Every marker with that tag name |
| `contributors[role]` | Markers that have a `role` attribute |
| `contributors[role='maintainer']` | Markers whose `role` is `maintainer` |
| `contributors[role='maintainer'][lang='en']` | Markers that satisfy every predicate |

- Attribute values compare as parsed values, so `[role='maintainer']` matches `role=maintainer` however the source quoted it.
- Single quotes, double quotes, and unquoted values all work in a selector.
- Combinators, selector lists, pseudo-classes, and operators other than `=` are rejected instead of quietly matching nothing.

## JavaScript API

| Function | Purpose | Returns |
| --- | --- | --- |
| `commentMark(input, replacements)` | Replace marked sections, keyed by selector | `Promise<string>`; resolves to the input unchanged when required arguments are invalid |
| `getCommentMark(input, selector)` | Read the first matching marker | Marker data, or `null` |
| `getCommentMarkAll(input, selector?)` | Read every matching marker in document order | Marker data in document order |

Marker data is a plain object: `{ tagName, attributes, content }`.

`commentMark` is async: it returns a promise, so `await` it. All selectors are validated before any function value runs.

- A string replaces the first matching section. An array replaces matches by position in document order, and matches past the end of the array are left alone. An array holds static values only; a function is the selector's value.
- A `null` or `undefined` entry consumes its position without replacing anything.
- `commentMark` rejects a static value whose selector matches no marker, an array with more values than matches, a function as an array entry, and two selectors that target the same marker. A function runs for every match, so a selector that matches nothing is a no-op. Pass an empty array to request no change explicitly.
- A bare multiline string value gets a newline added on each side.
- A function value runs for every match, in document order. It receives the marker (`{ tagName, attributes, content }`) and its zero-based position among the selector's matches, and its string result is inserted verbatim, with no added newline. The function may be async; its promise is awaited before the next resolver runs. Returning `null`/`undefined` preserves the section.
- An object value (`{ attributes?, content? }`) replaces the parts it sets and preserves the parts it omits, whether passed directly or returned from a function. `attributes` is the marker's complete attribute set, including `id`, so an attribute left out is removed; a function can spread `marker.attributes` to keep the rest. An object's `content` is inserted verbatim.
- In an object value, an omitted or `undefined` field preserves that part, `content: ''` clears the content, and `attributes: {}` removes every attribute. Attribute values must be strings.
- Setting an attribute rewrites only its value, keeping the whitespace around `=`, the indentation, and the line endings. The value reuses the original quoting when it fits and is re-quoted otherwise. Removing one drops the attribute and the whitespace written before it.

## CLI

```sh
npx comment-mark <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]
```

`--<selector>=<value>` sets the first matching marker's content. `--<selector>.<attribute>=<value>` sets one attribute and keeps the others and the content, so `--item.kind="fruit"` updates an attribute without a script. Quote the whole flag when the selector contains brackets: `--"item[kind='fruit']"=pear`. Without flags, the CLI prints every marker as JSON. See `references/cli.md` for statuses, exit codes, and exact matching.

## Rules and gotchas

| Situation | Do this |
| --- | --- |
| A file documents the marker syntax | Put examples in a fenced code block or inline code so they are ignored |
| A tag name appears more than once | A static value replaces the first match; a function runs for every match, and an array reaches matches by position |
| Section content must be computed from its current value | Pass a function in `commentMark`; it receives the marker and its index, runs for every match, and may be async |
| A marker's attributes must be updated | From the CLI, pass `--<selector>.<attribute>=<value>`. From the API, pass an object value or return `{ attributes }` from a function; `attributes` is the complete set, so spread `marker.attributes` to keep the rest |
| A changed value has quotes, spaces, or `-->` | comment-mark re-encodes it, reusing the original quoting when the value fits, and throws for a value it cannot write |
| A selector contains `=` | Quote the whole CLI flag; the first `=` outside brackets and quotes separates the flag from its value |
| An attribute predicate value contains `.` | The first `.` outside brackets and quotes separates the attribute; a dot inside the predicate stays with the selector |
| Marker missing during update | A static API value rejects with `Selector "<selector>" matched no markers`; a function is a no-op. The CLI prints `Missing` and exits `1` |
| Value is multiline | A static string gets surrounding newlines; object content and function return values are inserted verbatim |
| Need every marker, in document order, with attributes | Use `getCommentMarkAll` or CLI read mode |
| A comment must stay ordinary | Leave it unpaired; only a matched opening and closing pair is a marker |
| A marker sits inside another marker | Only the outermost pair is a marker; the inner pair is part of the outer marker's content and no selector matches it |
| v2 `<!-- name:start -->` markers | Read `references/migration-v2.md` |

Code regions: fenced code blocks (backtick or tilde, including `>` blockquote prefixes) and single-line inline code are ignored, so documentation examples stay literal. Indented code blocks and code spans that wrap across lines are not detected. Put active markers in prose; put literal examples inside fenced or single-line inline code.

## Resources

- Read `references/migration-v2.md` when migrating v2 `<!-- name:start -->` / `<!-- name:end -->` markers to v3.
- Read `references/cli.md` when scripting the CLI or depending on its output and exit codes.

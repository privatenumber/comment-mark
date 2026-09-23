# Migrating from v2 to v3

Use this reference when upgrading content or code that uses v2 `<!-- name:start -->` / `<!-- name:end -->` markers. The syntax change is mechanical, but several behaviors change.

## Syntax

v3 moves the name into a tag name on the comment pair:

```diff
 ## Last updated
-<!-- lastUpdated:start -->2026-09-07<!-- lastUpdated:end -->
+<!-- lastUpdated -->2026-09-07<!-- /lastUpdated -->
```

The closing comment repeats the name after a `/`. A comment is a marker only when a later comment closes the same tag name, so unrelated comments such as `<!-- TODO -->` stay ordinary text.

## API

| v2 | v3 |
| --- | --- |
| `commentMark(input, data)` | Now returns a promise, so `await` it. Values are keyed by selector instead of name. A string replaces the first match, an array replaces matches by position, and a function value receives the marker and its index, runs for every match, and returns a string or an `{ attributes?, content? }` update, or a promise of either. Unlike v2, it validates the whole document |
| `getCommentMarks(input)` | Removed. Use `getCommentMark(input, selector)` for the first match, or `getCommentMarkAll(input, selector)` for every marker in document order |
| none | New: `getCommentMark` and `getCommentMarkAll` read markers as plain `{ tagName, attributes, content }` data |

## CLI

- Update mode keys off a selector: `--lastUpdated=...` still works for a marker named `lastUpdated`, and `--"item[kind='fruit']"=pear` selects by attribute.
- Read mode prints an array of marker objects, not an object keyed by name:

```diff
-comment-mark README.md | jq -r '.contributors'
+comment-mark README.md | jq -r '.[] | select(.tagName == "contributors") | .content'
```

## Runtime

v3 requires Node.js 22.22.2 or newer. v2 supported Node.js 20.

## Behavior changes

| Change | Consequence |
| --- | --- |
| Markers in fenced code and inline code are ignored | A v2 marker shown as a documentation example no longer updates. This is the fix that stops examples from being treated as real markers |
| Only a matched comment pair is a marker | An unclosed `<!-- name -->` is left alone instead of throwing, and `<!-- TODO -->` stays ordinary text unless a matching `<!-- /TODO -->` follows. A marker pair nested inside another aborts parsing with `Nested marker ... is not supported` |
| Markers are selected, not looked up by name | `commentMark` keys are selectors. A tag name selects on its own, and attribute predicates narrow it: `contributors[role='maintainer']` |
| A scalar replaces the first match | v2 updated every marker with a matching name. Pass an array to update several matches by position |
| Attribute values have a grammar | v2 marker names were free-form text. Attributes must be separated by whitespace, and `id="a"file="b"` throws `Expected whitespace between attributes` |
| Attributes can be updated | New capability: return `{ attributes }` from a function value to rewrite a marker's attributes |
| Updates validate the whole document | A malformed or nested marker anywhere aborts the update, even when it is unrelated to the requested selectors |

## Rewriting a tree

There is no bundled codemod. For each file, replace the opening comment `<name>:start` with `<name>` and the closing comment `<name>:end` with `/<name>`. Then validate:

```sh
npx comment-mark path/to/file.md
```

Read mode lists the markers it recognizes, so confirm it lists the ones you expect. It does not confirm that a migration is complete, and v2 markers are ordinary comments to it. To check a tree, look for remaining `:start`/`:end` comments (for example, `grep -rE '<!--[^>]*:(start|end)[^>]*-->' path/to/tree`). Do not rewrite quoted or non-ASCII names with an unescaped shell one-liner; check each result when the names vary.

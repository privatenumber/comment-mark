# CLI

[Back to README](../README.md)

Use the CLI to read or update a file without writing a script:

```sh
npx comment-mark <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]
```

`file` is the path to a Markdown or HTML file. Selectors use the syntax described in [Markers and selectors](./markers.md#selectors). The examples below use `npx`; package scripts can call `comment-mark` directly.

## Update sections

Pass each value as `--<selector>=<value>`. A tag name selects on its own, so a `<!-- lastUpdated --><!-- /lastUpdated -->` placeholder updates with:

```sh
npx comment-mark README.md --lastUpdated="2026-09-07"
```

Give each section you update its own tag name. A unique tag name needs no quoting, and the flag reads as the section it updates.

A selector replaces the first matching section. Set several sections in one invocation:

```sh
npx comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07" --benchmarks="result"
```

For a file with a stale `contributors` section, a `lastUpdated` section already containing `2026-09-07`, and no `benchmarks` marker, the command writes the contributor update and reports on stderr:

```text
Updated: contributors
Unchanged: lastUpdated
Missing: benchmarks

Saved README.md. Updated 1 selector; 1 unchanged; 1 missing.
```

| Status | Meaning |
| --- | --- |
| `Updated` | The selector matches and applying the update changes the document |
| `Unchanged` | The update leaves the marker unchanged |
| `Missing` | No marker matches the selector |

When updates are saved alongside missing selectors, the command exits `1`. If every requested selector is missing, it exits `1` without writing. If every requested selector matches and nothing changes, it exits `0` without rewriting the file.

If several sections do share a tag name, a selector can still narrow by attribute. Quote the selector and the value, because the selector contains brackets:

```sh
npx comment-mark README.md --"contributors[role='maintainer']"="Jane Doe"
```

## Update attributes

Pass `--<selector>.<attribute>=<value>` to change one attribute. The other attributes and the section content stay as they are:

```sh
npx comment-mark README.md --item.status="archived"
```

The `.` is the first dot outside brackets and quotes, so an attribute predicate can contain one:

```sh
npx comment-mark README.md --"item[file='package.json'].status"="archived"
```

Set the content and attributes of the same section in one invocation, in any order:

```sh
npx comment-mark README.md --item="pear" --item.kind="fruit"
```

An empty value (`--item.kind=`) sets the attribute to an empty string. Each field can be set once; repeating a flag, or naming an attribute the marker grammar rejects, aborts the run before writing.

A selector is reported once even when a content flag and attribute flags address it together. Selectors resolve against the file as read, so flag order does not change which marker each one updates.

## Read sections

Omit selector flags to print every detected marker as JSON on stdout:

```sh
npx comment-mark README.md
```

For a file whose `lastUpdated` section contains `2026-09-07`:

```json
[
    {
        "tagName": "lastUpdated",
        "attributes": {},
        "content": "\n2026-09-07\n"
    }
]
```

Select a value with `jq`:

```sh
npx comment-mark README.md | jq -r '.[] | select(.tagName == "lastUpdated") | .content'
```

Read mode preserves section whitespace and prints `[]` when no markers exist. It exits non-zero if the file cannot be read or a marker is malformed.

## Arguments and validation

- Flag names are selectors, matched verbatim with no case or dash conversion: `--lastUpdated` and `--last-updated` are different selectors.
- Use `--selector=value`, not `--selector value`. Quote values containing spaces or newlines, and quote the selector when it contains brackets.
- The first `=` outside brackets and quotes separates the flag from its value, so `--"item[kind='fruit']"=pear` passes the selector `item[kind='fruit']`.
- Use `--selector=` to clear a section. Markers on a comment-started line put nonempty content on its own lines; other markers get no added boundary line breaks.
- Attributes must be separated by whitespace and appear at most once: `id="a"file="b"` and `id="a" id="b"` are rejected.
- Only the outermost marker pair is a marker. A pair nested inside another pair is part of the outer marker's content.
- Each selector can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.
- Update mode validates the document before writing. A malformed marker aborts the update.
- Bare `--help`, `-h`, and `--version` work without a file. Markers named `help` or `version` remain settable with `--help=<value>` or `--version=<value>`.

## Example: Git contributors

Add a section to `README.md`:

```md
## Contributors
<!-- contributors --><!-- /contributors -->
```

Fill it with the output of `git shortlog`:

```sh
npx comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"
```

For a repository with two contributors, the result looks like:

```md
## Contributors
<!-- contributors -->
    17  John Doe <john.doe@example.com>
     5  Jane Smith <jane.smith@example.com>
<!-- /contributors -->
```

Shell command substitution removes trailing newlines. Because the marker starts a line, comment-mark adds missing boundary newlines so the content sits between the marker lines.

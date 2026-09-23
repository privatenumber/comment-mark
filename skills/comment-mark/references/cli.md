# CLI

Use this reference when scripting `comment-mark` or depending on its output, statuses, or exit codes.

## Usage

```sh
comment-mark <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]
```

`file` is a Markdown or HTML path. Flags are optional; without them the CLI runs in read mode.

## Update mode

Pass one flag per marker. The flag name is a selector:

```sh
npx comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07"
```

Add attribute predicates to choose one marker out of several:

```sh
npx comment-mark README.md --"contributors[role='maintainer']"="Jane Doe"
```

Add `.attribute` to the flag name to change one attribute instead of the content:

```sh
npx comment-mark README.md --item.status="archived"
```

Set the content and attributes of the same selector in one invocation, in any order:

```sh
npx comment-mark README.md --item="pear" --item.kind="fruit"
```

- A selector replaces the first matching marker. The CLI has no array form.
- Selectors are matched verbatim, with no case or dash conversion: `--lastUpdated` and `--last-updated` are different selectors.
- Selectors resolve against the document as read, so the outcome does not depend on flag order or on which marker an earlier flag changed.
- Use `--selector=value`, not `--selector value`. Quote values with spaces or newlines, and quote the whole flag when the selector contains brackets.
- The first `=` outside brackets and quotes separates the flag from its value, so `--"item[kind='fruit']"=pear` passes the selector `item[kind='fruit']`.
- `--selector=` clears a section. Multiline values get a newline before and after.
- `--<selector>.<attribute>=<value>` sets one attribute and keeps the others and the content. `--selector.attribute=` sets an empty value.
- The first `.` outside brackets and quotes separates the attribute from the selector, so a predicate value can contain one: `--"item[file='package.json'].kind"=metadata`.
- Flags with identical selector text form one update: `--item=pear` and `--item.kind="fruit"` are reported together as `item`. Two different selectors that target the same marker conflict and abort before writing. An attribute update claims every marker its selector matches, so it also conflicts with a selector that matches one of the others.
- Each field can be set once per invocation. Repeated flags, valueless flags, invalid attribute names or values, and extra positional arguments are rejected before writing.
- Bare `--help`, `-h`, and `--version` work without a file. Markers named `help` or `version` remain settable with `--help=<value>` or `--version=<value>`, or attribute-settable with `--help.<attribute>=<value>`.

Status per selector is printed to stderr:

| Status | Meaning |
| --- | --- |
| `Updated` | The selector matches and the update changes the document |
| `Unchanged` | The update leaves the marker unchanged |
| `Missing` | No marker matches the selector |

When some requested selectors are missing, the valid updates are still written and the command exits `1`. When every requested selector is missing, nothing is written and it exits `1`. When every requested selector matches and nothing changes, the file is not rewritten and it exits `0`.

## Read mode

Without selector flags, the CLI prints every detected marker as a JSON array:

```sh
comment-mark README.md | jq -r '.[] | select(.tagName == "lastUpdated") | .content'
```

Each entry is `{ tagName, attributes, content }`. Read mode prints `[]` when there are no markers, preserves section whitespace, and exits non-zero if the file cannot be read or a marker is malformed.

## Validation

Update mode parses and validates the whole document before writing. A malformed marker aborts the run without partial edits. A comment with no matching closing comment is not a marker, so it is left alone and reported as `Missing` when a selector targets it.

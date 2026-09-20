# CLI

Use this reference when scripting `comment-mark` or depending on its output, statuses, or exit codes.

## Usage

```sh
comment-mark <file> [--<selector>=<value>...]
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

- A selector replaces the first matching marker. The CLI has no array form.
- Selectors are matched verbatim, with no case or dash conversion: `--lastUpdated` and `--last-updated` are different selectors.
- Use `--selector=value`, not `--selector value`. Quote values with spaces or newlines, and quote the whole flag when the selector contains brackets.
- The first `=` outside brackets and quotes separates the flag from its value, so `--"item[kind='fruit']"=pear` passes the selector `item[kind='fruit']`.
- `--selector=` clears a section. Multiline values get a newline before and after.
- Each selector can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.
- Bare `--help`, `-h`, and `--version` work without a file. Markers named `help` or `version` remain settable with `--help=<value>` or `--version=<value>`.

Status per selector is printed to stderr:

| Status | Meaning |
| --- | --- |
| `Updated` | The selector matches and the value changes the document |
| `Unchanged` | The value already matches |
| `Missing` | No marker matches the selector |

When some requested selectors are missing, the valid updates are still written and the command exits `1`. When every requested selector is missing, nothing is written and it exits `1`. When all requested values already match, the file is not rewritten and it exits `0`.

## Read mode

Without selector flags, the CLI prints every detected marker as a JSON array:

```sh
comment-mark README.md | jq -r '.[] | select(.tagName == "lastUpdated") | .content'
```

Each entry is `{ tagName, attributes, content }`. Read mode prints `[]` when there are no markers, preserves section whitespace, and exits non-zero if the file cannot be read or a marker is malformed.

## Validation

Update mode parses and validates the whole document before writing. A malformed or nested marker aborts the run without partial edits. A comment with no matching closing comment is not a marker, so it is left alone and reported as `Missing` when a selector targets it.

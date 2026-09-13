# CLI

Use this reference when scripting `comment-mark` or depending on its output, statuses, or exit codes.

## Usage

```sh
comment-mark <file> [--<id>=<value>...]
```

`file` is a Markdown or HTML path. Flags are optional; without them the CLI runs in read mode.

## Update mode

Pass one flag per marker:

```sh
npx comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07"
```

- The flag name matches the marker's `id` verbatim, with no case or dash conversion: `--lastUpdated` and `--last-updated` are different flags.
- Use `--id=value`, not `--id value`. Quote values with spaces or newlines.
- `--id=` clears a section. Multiline values get a newline before and after.
- Each marker can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.

Status per key is printed to stderr:

| Status | Meaning |
| --- | --- |
| `Updated` | The value changes the document |
| `Unchanged` | The value already matches |
| `Missing` | No matching marker exists |

When some requested markers are missing, the valid updates are still written and the command exits `1`. When every requested marker is missing, nothing is written and it exits `1`. When all requested values already match, the file is not rewritten and it exits `0`.

## Read mode

Without marker flags, the CLI prints every detected marker as a JSON array:

```sh
comment-mark README.md | jq -r '.[] | select(.id == "lastUpdated") | .content'
```

Each entry is `{ id?, attributes, content }`. `id` is omitted for unnamed markers. Read mode prints `[]` when there are no markers, preserves section whitespace, and exits non-zero if the file cannot be read or a marker is malformed.

## Validation

Update mode parses and validates the whole document before writing. A malformed, nested, or unterminated marker aborts the run without partial edits.

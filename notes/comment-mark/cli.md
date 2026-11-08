# CLI argument and update boundaries

The CLI treats flag names as marker selectors, not as a fixed set of options. It must preserve their exact spelling and distinguish control flags from markers with the same names. The contracts below were checked against `d41c4a5` on 2026-11-08.

## Control flags and selectors share a namespace

`--help` and `-h` show help, and bare `--version` shows the version. With a value, `--help=docs` and `--version=2.0.0` update markers instead. The [CLI test](../../tests/specs/cli.ts) `allows setting markers named like control flags` covers both names. Automatic cleye help is disabled so it cannot consume marker flags. The positional parameter is declared as `[file]` because cleye would reject a required `<file>` before the manual control handlers run. Usage still says `<file>`, and the CLI enforces it after those handlers ([source](../../src/cli.ts)).

Selectors are matched as written: `lastUpdated` and `last-updated` are distinct names, not normalized aliases. The CLI scans the raw arguments because cleye splits at the first `=`, which can occur inside a selector predicate. It finds the assignment `=` and attribute-update `.` outside predicates and quotes. An unquoted `[` within a predicate value does not create a nested predicate ([separator scan](../../src/cli.ts), [attribute CLI design](https://github.com/privatenumber/comment-mark/pull/22)).

### Reserved object property history

Arbitrary marker names also include `__proto__`. In type-flag 4.5.0, assigning this unknown flag to a plain object invoked the prototype setter rather than creating an own property. The flag disappeared from enumeration; comment-mark could enter read mode and exit successfully without updating the file. [type-flag issue #83](https://github.com/privatenumber/type-flag/issues/83) contains a minimal reproduction, and [4.5.1](https://github.com/privatenumber/type-flag/releases/tag/v4.5.1) fixed it. A lockfile refresh alone could not guarantee the fix to consumers: [cleye 2.6.0](https://github.com/privatenumber/cleye/blob/v2.6.0/package.json) allowed type-flag `^4.1.0`, which includes the affected version. The project moved from cleye `^2.6.0` to `^3.0.0-beta.2` in [PR #14](https://github.com/privatenumber/comment-mark/pull/14); current CLI scanning uses `Map`, and the final replacement map has a null prototype. Tests cover updating and duplicate detection for `__proto__` ([CLI tests](../../tests/specs/cli.ts)). Revisit this boundary when changing argument parsers or their dependency ranges.

## First-match ownership and missing selectors

An attribute flag updates only the first marker matching its selector. It builds a direct static update object from that marker's attributes. This claims exactly one marker: using an index-guarded resolver instead would claim every matching marker before the guard ran. That previously caused false conflicts between an attribute flag targeting the first `item` and a second flag targeting another `item` by ID. [PR #29](https://github.com/privatenumber/comment-mark/pull/29) fixed this, and `updates distinct markers through selectors that share a tag name` protects the case in the [CLI tests](../../tests/specs/cli.ts). See [replacement ownership](./replacements.md) for the library rule. The comment at `src/cli.ts:9-10` is stale: attribute updates no longer need a resolver.

The library rejects a missing static selector, but the CLI classifies selectors first and filters missing ones from the combined update. It reports missing selectors and exits 1 while still saving valid updates. This preserves useful partial CLI updates without weakening the library's typo detection ([CLI implementation](../../src/cli.ts), [missing-selector decision](https://github.com/privatenumber/comment-mark/pull/21), [regression tests](../../tests/specs/cli.ts)). Genuine overlapping claims still fail before writing.

## Known limitations

### Read mode can truncate piped JSON

Read mode writes JSON and immediately calls `process.exit(0)` ([source](../../src/cli.ts)). On macOS with Node `v26.13.0`, a built CLI at `d41c4a5` emitted 65,536 bytes of an expected 300,064-byte JSON response through a pipe, while both pipeline commands exited 0. The output is incomplete JSON. Reproduce from the repository root in zsh. Each example runs in a subshell, so its cleanup trap removes only its own temporary file:

```zsh
(
	fnm exec --using=26.13.0 pnpm build
	f=$(mktemp "${TMPDIR%/}/comment-mark-cli.XXXXXX")
	trap 'rm -f "$f"' EXIT
	fnm exec --using=26.13.0 node -e 'require("node:fs").writeFileSync(process.argv[1], "<!-- a -->" + "x".repeat(300000) + "<!-- /a -->")' "$f"
	fnm exec --using=26.13.0 node -e 'console.log(Buffer.byteLength(JSON.stringify([{tagName:"a",attributes:{},content:"x".repeat(300000)}], null, "\t") + "\n"))'
	fnm exec --using=26.13.0 node dist/cli.mjs "$f" | wc -c
	print -r -- "pipeline statuses: $pipestatus"
)
```

Observed output: `300064`, `65536`, and `pipeline statuses: 0 0`. Pipe buffering varies by environment. A fix needs a subprocess regression test larger than the pipe buffer and must let stdout drain before exit.

### Content with attribute flags bypasses the core padding policy

The CLI pre-pads content containing `\n` when the same selector also has an attribute update ([source](../../src/cli.ts)). On a CRLF document this can insert LF boundaries, even though the core would use CRLF. The following was observed with the built CLI and Node `v26.13.0` at `d41c4a5`:

```zsh
(
	f=$(mktemp "${TMPDIR%/}/comment-mark-padding.XXXXXX")
	trap 'rm -f "$f"' EXIT
	printf '# T\r\n<!-- a --><!-- /a -->\r\n' > "$f"
	fnm exec --using=26.13.0 node dist/cli.mjs "$f" $'--a=x\ny' '--a.k=v'
	fnm exec --using=26.13.0 node --input-type=module -e 'import {readFile} from "node:fs/promises"; import {commentMark} from "./dist/index.mjs"; const input="# T\r\n<!-- a --><!-- /a -->\r\n"; console.log("CLI:",JSON.stringify(await readFile(process.argv[1],"utf8"))); console.log("core:",JSON.stringify(await commentMark(input,{a:{content:"x\ny",attributes:{k:"v"}}})))' "$f"
)
```

The CLI result was `"# T\r\n<!-- a k=\"v\" -->\nx\ny\n<!-- /a -->\r\n"`; the core result was `"# T\r\n<!-- a k=\"v\" -->\r\nx\ny\r\n<!-- /a -->\r\n"`. The input content's own LF is unchanged in both results. See [content padding](./content-padding.md) for the core policy.

### Errors and repeated work

Library errors in the update path pass through `fromLibrary` for a concise message. Read-mode parsing and filesystem failures are outside that wrapper and can expose raw stack traces ([source](../../src/cli.ts)).

For each matched selector the update path calls `getCommentMark` and applies a solo `commentMark` to classify its status, then calls `commentMark` again for the combined result. For `S` matched selectors that is approximately `2S + 1` document parses, before accounting for selector scans ([source](../../src/cli.ts)). A parse-once plan is a possible improvement, not a measured requirement; benchmark representative documents before adding an index or changing the boundary.

Possible CLI extensions include a no-write `--check` mode for generated sections, stdin/stdout support for pipelines, and an explicit all-matches update mode. None is implemented. Revisit these when a concrete workflow needs them; retain the existing partial-update and first-match contracts unless a new mode explicitly changes them.

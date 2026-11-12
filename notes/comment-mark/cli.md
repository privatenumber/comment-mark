# CLI argument and update boundaries

The CLI treats flag names as marker selectors, not as a fixed set of options. It must preserve their exact spelling and distinguish control flags from markers with the same names. The contracts below were checked against `d41c4a5` on 2026-11-08, and the output and update-pass sections against the stack head `5140694` on 2026-11-11.

## Control flags and selectors share a namespace

`--help` and `-h` show help, and bare `--version` shows the version. With a value, `--help=docs` and `--version=2.0.0` update markers instead. The [CLI test](../../tests/specs/cli.ts) `allows setting markers named like control flags` covers both names. Automatic cleye help is disabled so it cannot consume marker flags. The positional parameter is declared as `[file]` because cleye would reject a required `<file>` before the manual control handlers run. Usage still says `<file>`, and the CLI enforces it after those handlers ([source](../../src/cli.ts)).

Selectors are matched as written: `lastUpdated` and `last-updated` are distinct names, not normalized aliases. The CLI scans the raw arguments because cleye splits at the first `=`, which can occur inside a selector predicate. It finds the assignment `=` and attribute-update `.` outside predicates and quotes. An unquoted `[` within a predicate value does not create a nested predicate ([separator scan](../../src/cli.ts), [attribute CLI design](https://github.com/privatenumber/comment-mark/pull/22)).

### Reserved object property history

Arbitrary marker names also include `__proto__`. In type-flag 4.5.0, assigning this unknown flag to a plain object invoked the prototype setter rather than creating an own property. The flag disappeared from enumeration; comment-mark could enter read mode and exit successfully without updating the file. [type-flag issue #83](https://github.com/privatenumber/type-flag/issues/83) contains a minimal reproduction, and [4.5.1](https://github.com/privatenumber/type-flag/releases/tag/v4.5.1) fixed it. A lockfile refresh alone could not guarantee the fix to consumers: [cleye 2.6.0](https://github.com/privatenumber/cleye/blob/v2.6.0/package.json) allowed type-flag `^4.1.0`, which includes the affected version. The project moved from cleye `^2.6.0` to `^3.0.0-beta.2` in [PR #14](https://github.com/privatenumber/comment-mark/pull/14); current CLI scanning uses `Map`, and the final replacement map has a null prototype. Tests cover updating and duplicate detection for `__proto__` ([CLI tests](../../tests/specs/cli.ts)). Revisit this boundary when changing argument parsers or their dependency ranges.

## First-match ownership and missing selectors

An attribute flag updates only the first marker matching its selector. It builds a direct static update object from that marker's attributes. This claims exactly one marker: using an index-guarded resolver instead would claim every matching marker before the guard ran. That previously caused false conflicts between an attribute flag targeting the first `item` and a second flag targeting another `item` by ID. [PR #29](https://github.com/privatenumber/comment-mark/pull/29) fixed this, and `updates distinct markers through selectors that share a tag name` protects the case in the [CLI tests](../../tests/specs/cli.ts). See [replacement ownership](./replacements.md) for the library rule. [PR #40](https://github.com/privatenumber/comment-mark/pull/40) corrected the source comment that still described a resolver.

The library rejects a missing static selector, but the CLI classifies selectors first and filters missing ones from the combined update. It reports missing selectors and exits 1 while still saving valid updates. This preserves useful partial CLI updates without weakening the library's typo detection ([CLI implementation](../../src/cli.ts), [missing-selector decision](https://github.com/privatenumber/comment-mark/pull/21), [regression tests](../../tests/specs/cli.ts)). Genuine overlapping claims still fail before writing.

## Output, errors, and update passes

The gaps below were found at `d41c4a5` and fixed in one stack of pull requests ([#39](https://github.com/privatenumber/comment-mark/pull/39) to [#43](https://github.com/privatenumber/comment-mark/pull/43)). Each fix has a regression test in [`tests/specs/cli.ts`](../../tests/specs/cli.ts).

### Exit without `process.exit`

Read mode used to write JSON and then call `process.exit(0)`. Through a pipe, that dropped output: on macOS with Node `v26.13.0`, the built CLI emitted 65,536 bytes of an expected 300,064-byte response, and both pipeline commands exited 0. A pipe buffer holds only part of the output, and `process.exit` does not wait for the rest to drain.

The CLI now never calls `process.exit`. Code that must stop throws an `exitSignal` sentinel, and the top-level handler in [`src/cli.ts`](../../src/cli.ts) sets `process.exitCode` and lets Node exit once stdout drains ([#39](https://github.com/privatenumber/comment-mark/pull/39), [#42](https://github.com/privatenumber/comment-mark/pull/42)). The test `prints complete JSON for large marker content` reads more than one pipe buffer through a subprocess.

- **Early-closing readers.** In read mode, `EPIPE` and `ENOTCONN` on stdout mean that the reader closed early, as with `| head`, so the CLI exits 0 quietly. `ENOTCONN` occurs when a parent process connects stdio with a socket. Its branch has no deterministic test; `EPIPE` and other write errors are tested.
- **Errors.** The top-level handler prints `Error: <message>` for errors with the `[comment-mark] ` prefix, and the full stack for any other error, in read mode and update mode alike. One path differs: a read-mode stdout write error other than `EPIPE` and `ENOTCONN`, such as `EBADF`, prints only `Error: <message>` (test `reports read-mode stdout write errors other than EPIPE`). Before, read-mode parse errors and filesystem errors could print raw stacks or lose output.

### Content with attribute flags uses the core layout

When a selector had both content and an attribute flag, the CLI used to add LF line breaks around multiline content itself, so a CRLF document got LF boundaries that the core would not write. [#40](https://github.com/privatenumber/comment-mark/pull/40) removed that step: both CLI paths pass the content through, and the core decides the layout and line ending. Taken alone, #40 loses one case that the old step happened to fix (`--a=$'**Bold**\n' --a.k=v` on a marker alone on its line). [#43](https://github.com/privatenumber/comment-mark/pull/43) fixes it in the core, so the stack must merge in order. See [content layout](./content-padding.md).

### One combined update

The update path used to call `getCommentMark` and a solo `commentMark` for each matched selector to find its status, then `commentMark` again for the combined result: `2S + M + 1` document parses for `S` matched and `M` missing selectors. The solo calls also became wrong after #43 added output validation, because a solo update can be rejected when the combined update is valid.

Since #43, the CLI applies the combined update for all matched selectors once, and reports each selector as updated or unchanged by comparing its marker before and after. The comparison uses the marker's source bytes, not the reader's data: normalizing a container prefix changes bytes that must be saved even when the content read back is the same (test `saves container formatting changes even when read content is unchanged`). Validation keeps each marker's continuation, so equal bytes also mean equal reader data. Missing selectors still exit 1 after the other selectors are saved. The parse count no longer grows with the number of selectors: a changing update parses the original in the CLI and again in `commentMark`, parses the output once for validation, and parses it once more in the CLI for status, so four parses; an update that changes nothing skips the validation parse ([`src/cli.ts`](../../src/cli.ts), [`src/index.ts`](../../src/index.ts)).

Possible CLI extensions include a no-write `--check` mode for generated sections, stdin/stdout support for pipelines, and an explicit all-matches update mode. None is implemented. Revisit these when a concrete workflow needs them; retain the existing partial-update and first-match contracts unless a new mode explicitly changes them.

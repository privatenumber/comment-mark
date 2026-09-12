# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

Read and update sections of Markdown using HTML comment placeholders.

Keep generated content, like contributor lists and benchmark results, alongside handwritten documentation. The placeholders stay in the file after each update, so the same Markdown serves as both the template and the output.

## Features

- Reusable placeholders that are hidden when Markdown is rendered
- Update sections from the CLI or JavaScript
- Read marked content as JSON or a JavaScript object, preserving whitespace
- Supports Markdown and HTML files, including multiline content
- TypeScript types, with ESM and CommonJS builds

## Install

```sh
pnpm add comment-mark
```

## Quick start

### 1. Add placeholders

In `README.md`, wrap the content you want to update with matching `:start` and `:end` comments:

```md
## Last updated
<!-- lastUpdated:start --><!-- lastUpdated:end -->
```

### 2. Fill the section

Read the file, pass values keyed by marker name, and save the result:

```js
import fs from 'node:fs/promises'
import { commentMark } from 'comment-mark'

const markdown = await fs.readFile('README.md', 'utf8')
const updated = commentMark(markdown, {
    lastUpdated: '2026-09-07'
})

await fs.writeFile('README.md', updated)
```

### Result

```md
## Last updated
<!-- lastUpdated:start -->2026-09-07<!-- lastUpdated:end -->
```

Run the script again with a new value to replace the section. The surrounding document and marker comments stay intact. For a live timestamp, use `new Date().toISOString()` as the value.

## CLI

Use the CLI to read or update a file without writing a script:

```sh
pnpm exec comment-mark <file> [--<marker>=<value>...]
```

`file` is the path to a Markdown or HTML file. The examples below use the locally installed command through `pnpm exec`; package scripts can call `comment-mark` directly.

### Update sections

Pass each value as `--<marker>=<value>`. For the placeholder in the quick start:

```sh
pnpm exec comment-mark README.md --lastUpdated="2026-09-07"
```

Set multiple markers in one invocation:

```sh
pnpm exec comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07" --benchmarks="result"
```

For a file with a stale `contributors` section, a `lastUpdated` section already containing `2026-09-07`, and no `benchmarks` marker, the command writes the contributor update and reports on stderr:

```text
Updated: contributors
Unchanged: lastUpdated
Missing: benchmarks

Saved README.md. Updated 1 key; 1 unchanged; 1 missing.
```

| Status | Meaning |
| --- | --- |
| `Updated` | The marker exists and applying the value changes the document |
| `Unchanged` | Applying the value leaves the section unchanged |
| `Missing` | No matching marker exists |

When updates are saved alongside missing markers, the command exits `1`. If every requested marker is missing, it exits `1` without writing. If all requested markers exist and their values already match, it exits `0` without rewriting the file.

### Read sections

Omit marker flags to print the detected values as JSON on stdout:

```sh
pnpm exec comment-mark README.md
```

For the quick-start result:

```json
{
    "lastUpdated": "2026-09-07"
}
```

Pipe the result to `jq` to select a value:

```sh
pnpm exec comment-mark README.md | jq -r '.lastUpdated'
```

Read mode preserves section whitespace and prints `{}` when no markers exist. It exits non-zero if the file cannot be read or a start marker has no matching end comment.

### Arguments and validation

- Names are exact: `--last-updated` does not match a `lastUpdated` marker.
- Use `--key=value`, not `--key value`. Quote values containing spaces or newlines.
- Use `--key=` to clear a section. Multiline values get a newline before and after the supplied content.
- Each marker can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.
- Update mode validates the document before writing. An unterminated marker aborts the update.
- Bare `--help`, `-h`, and `--version` work without a file. Markers named `help` or `version` remain settable with `--help=<value>` or `--version=<value>`.

## Example: Git contributors

Add a section to `README.md`:

```md
## Contributors
<!-- contributors:start --><!-- contributors:end -->
```

Fill it with the output of `git shortlog`:

```sh
pnpm exec comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"
```

For a repository with two contributors, the result looks like:

```md
## Contributors
<!-- contributors:start -->
    17  John Doe <john.doe@example.com>
     5  Jane Smith <jane.smith@example.com>
<!-- contributors:end -->
```

Shell command substitution removes trailing newlines. For multiline values, comment-mark adds a newline at each end so the content sits between the marker lines.

### Real-world examples

- [Project index](https://github.com/privatenumber/privatenumber): Updates the README from `projects.json` on each Git commit
- [Minification Benchmarks](https://github.com/privatenumber/minification-benchmarks): Inserts benchmark results into the README

## API

### `commentMark(input, data)`

Replace marked sections with values from `data`. This function transforms content in memory; it does not read or write files.

```js
import { commentMark } from 'comment-mark'

const updated = commentMark('Version: <!-- version:start -->1.0.0<!-- version:end -->', {
    version: '2.0.0'
})

console.log(updated)
// Version: <!-- version:start -->2.0.0<!-- version:end -->
```

- `input` (`string | Buffer`): Markdown or HTML content
- `data` (`Record<string, string | null | undefined>`): Values keyed by marker name

Returns the updated content as a string. Buffer input is decoded as UTF-8.

- Updates every matching occurrence of each supplied key.
- Skips `null` and `undefined` values. An empty string clears the section.
- Silently skips keys with no matching marker. Unlike the CLI, the API does not report missing keys.
- Wraps values containing `\n` in an additional newline on each side.
- Throws if a section being updated has no matching end comment.

### `getCommentMarks(input)`

Read marked sections into an object keyed by marker name:

```js
import { getCommentMarks } from 'comment-mark'

const sections = getCommentMarks('Version: <!-- version:start -->2.0.0<!-- version:end -->')

console.log(sections.version)
// 2.0.0
```

- `input` (`string | Buffer`): Markdown or HTML content
- Returns `Record<string, string>` with no inherited properties. Missing sections have no property.
- Preserves section content exactly, including whitespace and newlines.
- Uses the last occurrence when a marker appears more than once.
- Treats whitespace around the comment contents as formatting: `<!--  version:start  -->` reads as the key `version`.
- Throws when a start marker has no following end comment.

## FAQ

### Why HTML comments?

HTML comments are hidden in rendered Markdown but remain visible in the source. They mark where generated content belongs without adding visible template syntax to the document.

### Why use a pair of comments?

The start and end comments delimit the content to replace. Both stay in the output, so later updates can find the same section without a separate template file.

## Related

- [mdeval](https://github.com/privatenumber/mdeval): Run JavaScript inside Markdown comments, keeping the logic next to the content it produces
- [md-pen](https://github.com/privatenumber/md-pen): Typed utilities for formatting Markdown

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg" alt="Sponsors">
	</a>
</p>

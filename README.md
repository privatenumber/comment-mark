# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

Read and update sections of Markdown using HTML comment placeholders.

Keep generated content, like contributor lists and benchmark results, alongside handwritten documentation. The placeholders stay in the file after each update, so the same Markdown serves as both the template and the output.

## Features

- Reusable placeholders that are hidden when Markdown is rendered
- Update sections from the CLI or JavaScript
- Read marked content as JSON or a JavaScript object, preserving whitespace
- Supports Markdown and HTML files, including multiline content
- Ignores markers inside code blocks, so documentation examples stay literal
- TypeScript types, with ESM and CommonJS builds

## Install

```sh
pnpm add comment-mark
```

## Quick start

### 1. Add placeholders

In `README.md`, wrap the content you want to update with a named marker:

```md
## Last updated
<!--comment-mark id="lastUpdated"--><!--/comment-mark-->
```

The opening comment declares the marker's `id`. The closing comment marks where the content ends.

### 2. Fill the section

Read the file, pass values keyed by marker id, and save the result:

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
<!--comment-mark id="lastUpdated"-->2026-09-07<!--/comment-mark-->
```

Run the script again with a new value to replace the section. The surrounding document and marker comments stay intact. For a live timestamp, use `new Date().toISOString()` as the value.

## CLI

Use the CLI to read or update a file without writing a script:

```sh
npx comment-mark <file> [--<id>=<value>...]
```

`file` is the path to a Markdown or HTML file. The examples below use `npx`; package scripts can call `comment-mark` directly.

### Update sections

Pass each value as `--<id>=<value>`, where `<id>` matches a marker's `id` attribute. For the placeholder in the quick start:

```sh
npx comment-mark README.md --lastUpdated="2026-09-07"
```

Set multiple markers in one invocation:

```sh
npx comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07" --benchmarks="result"
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

Omit marker flags to print the detected markers as JSON on stdout:

```sh
npx comment-mark README.md
```

For the quick-start result:

```json
[
    {
        "id": "lastUpdated",
        "attributes": {},
        "content": "2026-09-07"
    }
]
```

Select a value with `jq`:

```sh
npx comment-mark README.md | jq -r '.[] | select(.id == "lastUpdated") | .content'
```

Read mode preserves section whitespace and prints `[]` when no markers exist. It exits non-zero if the file cannot be read or a marker has no closing comment.

### Arguments and validation

- The flag name is the marker's `id`, matched exactly: `--last-updated` does not match an `id` of `lastUpdated`.
- Use `--id=value`, not `--id value`. Quote values containing spaces or newlines.
- Use `--id=` to clear a section. Multiline values get a newline before and after the supplied content.
- `id` is written as an attribute (`id="lastUpdated"`). Additional attributes are preserved on the marker for future features.
- Each marker can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.
- Update mode validates the document before writing. A marker without a closing comment aborts the update.
- Bare `--help`, `-h`, and `--version` work without a file. Markers with `id="help"` or `id="version"` remain settable with `--help=<value>` or `--version=<value>`.

## API

### `commentMark(input, data)`

Replace marked sections with values from `data`. This function transforms content in memory; it does not read or write files.

```js
import { commentMark } from 'comment-mark'

const updated = commentMark('Version: <!--comment-mark id="version"-->1.0.0<!--/comment-mark-->', {
    version: '2.0.0'
})

console.log(updated)
// Version: <!--comment-mark id="version"-->2.0.0<!--/comment-mark-->
```

- `input` (`string | Buffer`): Markdown or HTML content
- `data` (`Record<string, string | null | undefined>`): Values keyed by marker `id`

Returns the updated content as a string. Buffer input is decoded as UTF-8.

- Updates every matching occurrence of each supplied key.
- Skips `null` and `undefined` values. An empty string clears the section.
- Silently skips keys with no matching marker. Unlike the CLI, the API does not report missing keys.
- Ignores markers inside fenced code blocks and inline code.
- Wraps values containing `\n` in an additional newline on each side.
- Throws when a marker has no closing comment.

### `getCommentMarks(input)`

Read named markers into an object keyed by `id`:

```js
import { getCommentMarks } from 'comment-mark'

const sections = getCommentMarks('Version: <!--comment-mark id="version"-->2.0.0<!--/comment-mark-->')

console.log(sections.version)
// 2.0.0
```

- `input` (`string | Buffer`): Markdown or HTML content
- Returns `Record<string, string>` with no inherited properties. Markers without an `id` have no property.
- Preserves section content exactly, including whitespace and newlines.
- Uses the last occurrence when a marker appears more than once.
- Throws when a marker has no closing comment.

### `getCommentMarkers(input)`

Read every marker, including markers without an `id`, in document order:

```js
import { getCommentMarkers } from 'comment-mark'

const markers = getCommentMarkers('<!--comment-mark file="./LICENSE.md"-->MIT<!--/comment-mark-->')

console.log(markers[0].attributes.file)
// ./LICENSE.md
```

- `input` (`string | Buffer`): Markdown or HTML content
- Returns `CommentMark[]`, where each marker has:
  - `id` (`string | undefined`): the `id` attribute, when present
  - `attributes` (`Record<string, string>`): attributes other than `id`
  - `content` (`string`): raw content between the comments
- Throws when a marker has no closing comment.

## Migrating from v2

v3 replaces the `<id>:start` / `<id>:end` comments with named `comment-mark` comments. Replace the opening and closing comments:

```diff
 ## Last updated
-<!-- lastUpdated:start --><!-- lastUpdated:end -->
+<!--comment-mark id="lastUpdated"--><!--/comment-mark-->
```

To rewrite a tree of Markdown files:

```sh
find . -name '*.md' -not -path './node_modules/*' -exec perl -0pi -e 's/<!--\s*(.+?):start\s*-->/<!--comment-mark id="$1"-->/g; s/<!--\s*.+?:end\s*-->/<!--\/comment-mark-->/g' {} +
```

Other v3 changes:

- The CLI's read mode now prints an array of marker objects instead of an object keyed by id.
- `getCommentMarks` still returns an object keyed by `id`. Use `getCommentMarkers` to read every marker, including ones without an `id`.
- Markers inside fenced code blocks and inline code are ignored.

## Example: Git contributors

Add a section to `README.md`:

```md
## Contributors
<!--comment-mark id="contributors"--><!--/comment-mark-->
```

Fill it with the output of `git shortlog`:

```sh
npx comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"
```

For a repository with two contributors, the result looks like:

```md
## Contributors
<!--comment-mark id="contributors"-->
    17  John Doe <john.doe@example.com>
     5  Jane Smith <jane.smith@example.com>
<!--/comment-mark-->
```

Shell command substitution removes trailing newlines. For multiline values, comment-mark adds a newline at each end so the content sits between the marker lines.

### Real-world examples

- [Project index](https://github.com/privatenumber/privatenumber): Updates the README from `projects.json` on each Git commit
- [Minification Benchmarks](https://github.com/privatenumber/minification-benchmarks): Inserts benchmark results into the README

## FAQ

### Why HTML comments?

HTML comments are hidden in rendered Markdown but remain visible in the source. They mark where generated content belongs without adding visible template syntax to the document.

### Why use a pair of comments?

The opening and closing comments delimit the content to replace. Both stay in the output, so later updates can find the same section without a separate template file.

### Why does the marker use an `id` attribute?

An attribute form leaves room for additional attributes on the same marker. A marker can also omit `id` entirely, which is how `file` markers that inline another file's contents will work.

## Related

- [mdeval](https://github.com/privatenumber/mdeval): Run JavaScript inside Markdown comments, keeping the logic next to the content it produces
- [md-pen](https://github.com/privatenumber/md-pen): Typed utilities for formatting Markdown

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg" alt="Sponsors">
	</a>
</p>

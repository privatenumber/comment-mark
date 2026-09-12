# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

**comment-mark** lets you seamlessly embed dynamic content into your Markdown using persistent HTML comment placeholders—no separate template files required!

## Install

```sh
npm install comment-mark
```

## CLI

Update marked sections in a Markdown file directly from the command line. Each `--<marker>=<value>` flag fills the matching marker:

```sh
comment-mark README.md --lastUpdated="$(date -Iseconds)"
```

```md
## Last updated
<!-- lastUpdated:start -->2026-09-07T00:00:00+09:00<!-- lastUpdated:end -->
```

Multiple markers can be set in one invocation:

```sh
comment-mark README.md \
    --contributors="$(git shortlog -se HEAD -- .)" \
    --lastUpdated="$(date -Iseconds)"
```

Running without marker flags lists every detected marker and its content as JSON, which is handy for scripting:

```sh
comment-mark README.md | jq -r '.contributors'
```

The setter reports each key's outcome (`Updated`, `Unchanged`, or `Missing`) and always uses `--<marker>=<value>` syntax. A marker that doesn't exist doesn't block the other updates, but the command exits non-zero so typos and stale scripts surface:

```text
Updated: contributors
Unchanged: lastUpdated
Missing: benchmarks

Saved README.md. Updated 1 key; 1 unchanged; 1 missing.
```

When every requested value already matches, the file is left untouched and the command exits successfully.

## Quick start

### 1. Add placeholders to your Markdown

```md
## Last updated
<!-- lastUpdated:start --><!-- lastUpdated:end -->
```

### 2. Insert dynamic content

```js
import fs from 'fs'
import { commentMark } from 'comment-mark'

let markdown = fs.readFileSync('README.md', 'utf8')

markdown = commentMark(markdown, {
    lastUpdated: new Date().toISOString()
})

fs.writeFileSync('README.md', markdown)
```

### Result

```md
## Last updated
<!-- lastUpdated:start -->2024-05-20T13:45:00.000Z<!-- lastUpdated:end -->
```

## Why use comment-mark?

Most Markdown templating requires separate template files and a build step. **comment-mark** eliminates this complexity by allowing a single Markdown file to act as both the template and the output.

### Real-world examples

- [Project index](https://github.com/privatenumber/privatenumber): Automatically updates `README.md` from `projects.json` on each Git commit.
- [Minification Benchmarks](https://github.com/privatenumber/minification-benchmarks): Inserts benchmarking results directly into `README.md`.

## Demo: Embed Git contributors

Here's a practical example showing how to auto-update a list of Git contributors in your README:

### Markdown Setup

```md
## Contributors
<!-- contributors:start --><!-- contributors:end -->
```

### Script

```js
import fs from 'fs'
import { execSync } from 'child_process'
import { commentMark } from 'comment-mark'

let markdown = fs.readFileSync('README.md')

markdown = commentMark(markdown, {
    contributors: execSync('git shortlog -se HEAD -- .').toString().trim()
})

fs.writeFileSync('README.md', markdown)
```

### Output

```md
## Contributors
<!-- contributors:start -->
17	John Doe <john.doe@gmail.com>
5	Jane Smith <jane.smith@example.com>
<!-- contributors:end -->
```

## API

### CLI

```sh
comment-mark <file> [--<marker>=<value>...]
```

* `file` `<string>`: Path to the Markdown or HTML file.
* `--<marker>=<value>`: Value for the marker named `<marker>`. Repeat for multiple markers. Multiline values are supported.

**Get mode.** Without marker flags, prints every detected marker and its exact content as JSON to stdout and exits `0`. Exits non-zero if the file can't be read or contains an unterminated marker.

**Set mode.** With one or more marker flags, validates the whole document first (an unterminated marker aborts without writing), then updates the marked sections in place. Status for each key is printed to stderr:

* `Updated`: the marker existed and its content changed.
* `Unchanged`: the marker already held the requested value.
* `Missing`: no matching marker exists in the file.

Valid updates are still saved when other requested markers are missing, but the command exits `1` in that case so automation can detect incomplete runs. When every requested value already matches, the file is not rewritten and the command exits `0`.

Additional rules:

* Each marker can only be set once per invocation; repeated flags are rejected.
* Marker names are exact; `--last-updated` does not match a `lastUpdated` marker.
* Bare `--help`, `-h`, and `--version` are reserved. Set a marker named `help` or `version` with `--help=<value>` or `--version=<value>`.

### `commentMark(contentStr, data)`

* `contentStr` `<string>`: The Markdown or HTML content.
* `data` `<Record<string, string | undefined | null>>`: Key-value pairs representing placeholders and their replacements.

**Returns:** `<string>`: The original string with placeholders replaced by provided values.

### `getCommentMarks(contentStr)`

Returns the contents of every marked section as a key-value object. Contents are preserved exactly, including whitespace.

```js
import { getCommentMarks } from 'comment-mark'

console.log(getCommentMarks(markdown).lastUpdated)
```

* `contentStr` `<string | Buffer>`: The Markdown or HTML content.

Whitespace around the marker key is treated as formatting: `<!--  lastUpdated:start  -->` reads as the key `lastUpdated`.

When the same marker appears multiple times, the last occurrence wins.

**Returns:** `<Record<string, string>>`: The marked section contents, keyed by marker name. Missing sections have no property.

**Throws:** When a start marker has no following end marker.

## FAQ

### Why HTML comments?

Markdown generally supports basic HTML, and HTML comment pairs are a safe, unobtrusive way to mark placeholders.

### Why pairs of HTML comments instead of single placeholders?

Pairs ensure the placeholders remain intact after multiple updates, avoiding the need for separate source and distribution files.

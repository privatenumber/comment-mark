# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

**comment-mark** lets you seamlessly embed dynamic content into your Markdown using persistent HTML comment placeholders—no separate template files required!

## Install

```sh
npm install comment-mark
```

## CLI

Update marked sections in a Markdown file directly from the command line. Each `--<marker>=<value>` flag fills the matching marker:

```sh
comment-mark README.md --last-updated="$(date -Iseconds)"
```

```md
## Last updated
<!-- lastUpdated:start -->2026-09-07T00:00:00+09:00<!-- lastUpdated:end -->
```

Multiple markers can be set in one invocation:

```sh
comment-mark README.md \
    --contributors="$(git shortlog -se HEAD -- .)" \
    --last-updated="$(date -Iseconds)"
```

Running without marker flags prints the file's content to stdout instead of writing.

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

* `file` `<string>`: Path to the Markdown or HTML file to update in place.
* `--<marker>=<value>`: Value for the marker named `<marker>`. Repeatable for multiple markers. Multiline values are supported.

When at least one marker flag is given, the file is rewritten in place with the marked sections updated. Without marker flags, the processed content is printed to stdout and the file is left untouched.

Markers that don't exist in the file are ignored.

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

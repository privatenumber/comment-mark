# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

**comment-mark** lets you seamlessly embed dynamic content into your Markdown using persistent HTML comment placeholders—no separate template files required!

## Install

```sh
npm install comment-mark
```

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

### `commentMark(contentStr, data)`

* `contentStr` `<string>`: The Markdown or HTML content.
* `data` `<Record<string, string | undefined | null>>`: Key-value pairs representing placeholders and their replacements.

**Returns:** `<string>`: The original string with placeholders replaced by provided values.

## FAQ

### Why HTML comments?

Markdown generally supports basic HTML, and HTML comment pairs are a safe, unobtrusive way to mark placeholders.

### Why pairs of HTML comments instead of single placeholders?

Pairs ensure the placeholders remain intact after multiple updates, avoiding the need for separate source and distribution files.

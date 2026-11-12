# comment-mark

Read and update sections of Markdown using HTML comment placeholders.

Keep generated content, like contributor lists and benchmark results, alongside handwritten documentation. The placeholders stay in the file after each update, so the same Markdown serves as both the template and the output.

## Install

```sh
pnpm add comment-mark
```

Requires Node.js 22.22.2 or newer. Includes TypeScript types, and the ESM build also loads with `require()`.

## How it works

Wrap a section in a pair of HTML comments. They are hidden when the Markdown is rendered:

```md
## Contributors
<!-- contributors --><!-- /contributors -->
```

Fill the section from the command line:

```sh
npx comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"
```

The content between the comments is replaced, and the comments stay in place:

```md
## Contributors
<!-- contributors -->
    17  John Doe <john.doe@example.com>
     5  Jane Smith <jane.smith@example.com>
<!-- /contributors -->
```

Run the command again whenever the data changes. It finds the same section and replaces it, and the rest of the document is left alone.

## What you can do

### Update sections from JavaScript

```js
import { commentMark } from 'comment-mark'

const updated = await commentMark('Version: <!-- version -->1.0.0<!-- /version -->', {
    version: '2.0.0'
})
// Version: <!-- version -->2.0.0<!-- /version -->
```

### Compute a section from its current content

```js
const updated = await commentMark('Views: <!-- views -->40<!-- /views -->', {
    views: ({ content }) => String(Number(content) + 1)
})
// Views: <!-- views -->41<!-- /views -->
```

### Select sections by attribute, like a CSS selector

Attributes describe a section, so several sections with the same tag name can be told apart:

```md
<!-- contributors role="maintainer" --><!-- /contributors -->
<!-- contributors role="reviewer" --><!-- /contributors -->
```

```sh
npx comment-mark README.md --"contributors[role='maintainer']"="Jane Doe"
```

### Include other files

The `files` plugin fills each marker with the file named in its `path` attribute, which keeps code examples in sync with real files:

```md
<!-- file path="./examples/hello.js" --><!-- /file -->
```

```js
import { commentMark } from 'comment-mark'
import { files } from 'comment-mark/plugins/files'

const updated = await commentMark(markdown, files({
    baseDirectory: import.meta.dirname
}))
```

### Read sections as JSON

Run the CLI without flags to print every section, then pick values with tools such as `jq`:

```sh
npx comment-mark README.md | jq -r '.[] | select(.tagName == "contributors") | .content'
```

## Safe to run on real documentation

- **Code examples stay literal.** Markers inside fenced code blocks and single-line inline code are ignored, so a document can show markers without updating them. Indented code blocks and a few other cases are not detected as code; see [markers in code examples](./docs/markers.md#markers-in-code-examples).
- **Mistakes fail loudly.** The CLI reports each selector that matches no section and exits with code `1`, after saving the sections that matched. In JavaScript, a static value whose selector matches nothing rejects instead of being skipped.
- **Structure is checked before writing.** A malformed marker, or an update that would move a section's boundaries, stops the update and leaves the file as it was.
- **Works with Markdown and HTML,** including multiline content inside lists and blockquotes.

## Documentation

- [CLI](./docs/cli.md): update sections and attributes, read sections as JSON, and how arguments are validated
- [Node.js API](./docs/node.md): `commentMark`, `getCommentMark`, `getCommentMarkAll`, and the `files` plugin
- [Markers and selectors](./docs/markers.md): the marker syntax, the selector syntax, and how markers in code and nested markers are handled

## Why HTML comments?

HTML comments are hidden in rendered Markdown but remain visible in the source. They mark where generated content belongs without adding visible template syntax to the document.

The opening and closing comments delimit the content to replace. Both stay in the output, so later updates can find the same section without a separate template file.

## Real-world examples

- [Project index](https://github.com/privatenumber/privatenumber): Updates the README from `projects.json` on each Git commit
- [Minification Benchmarks](https://github.com/privatenumber/minification-benchmarks): Inserts benchmark results into the README

## Related

- [mdeval](https://github.com/privatenumber/mdeval): Run JavaScript inside Markdown comments, keeping the logic next to the content it produces
- [md-pen](https://github.com/privatenumber/md-pen): Typed utilities for formatting Markdown

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg" alt="Sponsors">
	</a>
</p>

# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

Read and update sections of Markdown using HTML comment placeholders.

Keep generated content, like contributor lists and benchmark results, alongside handwritten documentation. The placeholders stay in the file after each update, so the same Markdown serves as both the template and the output.

## Features

- Reusable placeholders that are hidden when Markdown is rendered
- Update sections from the CLI or JavaScript
- Select sections by tag name and attributes, like a CSS selector
- Compute section content and attributes from the marker's current values
- Read marked content as JSON or a JavaScript object, preserving whitespace
- Supports Markdown and HTML files, including multiline content
- Ignores markers inside fenced code blocks and single-line inline code, so documentation examples stay literal
- TypeScript types, with one ES module build that works with both `import` and `require`

## Install

```sh
pnpm add comment-mark
```

Requires Node.js 22.22.2 or newer.

comment-mark ships as an ES module. `import` loads it directly, and on Node.js 22.12 or newer `require('comment-mark')` loads it too.

## Quick start

### 1. Add placeholders

In `README.md`, wrap the content you want to update with a matching pair of comments:

```md
## Last updated
<!-- lastUpdated --><!-- /lastUpdated -->
```

The tag name names the section. The closing comment repeats that name, which is what distinguishes a marker from an ordinary comment.

### 2. Fill the section

Read the file, pass values keyed by selector, and save the result:

```js
import fs from 'node:fs/promises'
import { commentMark } from 'comment-mark'

const markdown = await fs.readFile('README.md', 'utf8')
const updated = await commentMark(markdown, {
    lastUpdated: '2026-09-07'
})

await fs.writeFile('README.md', updated)
```

### Result

```md
## Last updated
<!-- lastUpdated -->2026-09-07<!-- /lastUpdated -->
```

Run the script again with a new value to replace the section. The surrounding document and marker comments stay intact. For a live timestamp, use `new Date().toISOString()` as the value.

## CLI

Use the CLI to read or update a file without writing a script:

```sh
npx comment-mark <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]
```

`file` is the path to a Markdown or HTML file. The examples below use `npx`; package scripts can call `comment-mark` directly.

### Update sections

Pass each value as `--<selector>=<value>`. A tag name selects on its own, so the quick-start placeholder updates with:

```sh
npx comment-mark README.md --lastUpdated="2026-09-07"
```

Give each section you update its own tag name. A unique tag name needs no quoting, and the flag reads as the section it updates.

A selector replaces the first matching section. Set several sections in one invocation:

```sh
npx comment-mark README.md --contributors="Jane Doe" --lastUpdated="2026-09-07" --benchmarks="result"
```

For a file with a stale `contributors` section, a `lastUpdated` section already containing `2026-09-07`, and no `benchmarks` marker, the command writes the contributor update and reports on stderr:

```text
Updated: contributors
Unchanged: lastUpdated
Missing: benchmarks

Saved README.md. Updated 1 selector; 1 unchanged; 1 missing.
```

| Status | Meaning |
| --- | --- |
| `Updated` | The selector matches and applying the update changes the document |
| `Unchanged` | The update leaves the marker unchanged |
| `Missing` | No marker matches the selector |

When updates are saved alongside missing selectors, the command exits `1`. If every requested selector is missing, it exits `1` without writing. If every requested selector matches and nothing changes, it exits `0` without rewriting the file.

If several sections do share a tag name, a selector can still narrow by attribute. Quote the selector and the value, because the selector contains brackets:

```sh
npx comment-mark README.md --"contributors[role='maintainer']"="Jane Doe"
```

### Update attributes

Pass `--<selector>.<attribute>=<value>` to change one attribute. The other attributes and the section content stay as they are:

```sh
npx comment-mark README.md --item.status="archived"
```

The `.` is the first dot outside brackets and quotes, so an attribute predicate can contain one:

```sh
npx comment-mark README.md --"item[file='package.json'].status"="archived"
```

Set the content and attributes of the same section in one invocation, in any order:

```sh
npx comment-mark README.md --item="pear" --item.kind="fruit"
```

An empty value (`--item.kind=`) sets the attribute to an empty string. Each field can be set once; repeating a flag, or naming an attribute the marker grammar rejects, aborts the run before writing.

A selector is reported once even when a content flag and attribute flags address it together. Selectors resolve against the file as read, so flag order does not change which marker each one updates.

### Read sections

Omit selector flags to print every detected marker as JSON on stdout:

```sh
npx comment-mark README.md
```

For the quick-start result:

```json
[
    {
        "tagName": "lastUpdated",
        "attributes": {},
        "content": "2026-09-07"
    }
]
```

Select a value with `jq`:

```sh
npx comment-mark README.md | jq -r '.[] | select(.tagName == "lastUpdated") | .content'
```

Read mode preserves section whitespace and prints `[]` when no markers exist. It exits non-zero if the file cannot be read or a marker is malformed.

### Arguments and validation

- Flag names are selectors, matched verbatim with no case or dash conversion: `--lastUpdated` and `--last-updated` are different selectors.
- Use `--selector=value`, not `--selector value`. Quote values containing spaces or newlines, and quote the selector when it contains brackets.
- The first `=` outside brackets and quotes separates the flag from its value, so `--"item[kind='fruit']"=pear` passes the selector `item[kind='fruit']`.
- Use `--selector=` to clear a section. Multiline values get a newline before and after the supplied content.
- Attributes must be separated by whitespace and appear at most once: `id="a"file="b"` and `id="a" id="b"` are rejected.
- A marker pair cannot sit inside another marker pair. Markers cannot nest.
- Each selector can be set once per invocation. Repeated flags, valueless flags, and extra positional arguments are rejected before writing.
- Update mode validates the document before writing. A malformed or nested marker aborts the update.
- Bare `--help`, `-h`, and `--version` work without a file. Markers named `help` or `version` remain settable with `--help=<value>` or `--version=<value>`.

## Markers

A marker is a matching pair of HTML comments. The tag name names the section:

```md
<!-- contributors -->Jane<!-- /contributors -->
```

Attributes are optional and carry metadata for the section. They are written after the tag name:

```md
<!-- contributors role="maintainer" -->Jane<!-- /contributors -->
```

- The closing comment repeats the tag name, so `<!-- TODO -->` stays an ordinary comment until a matching `<!-- /TODO -->` follows.
- Whitespace inside the comments is padding: `<!-- contributors -->` and `<!--contributors-->` are equivalent.
- The content between the comments is replaced; the comment pair stays in the output so later updates can find the section.
- A tag name starts with a letter or `_`, then letters, digits, `_`, or `-`.
- Tag names and attribute names are case-sensitive and matched verbatim.
- Attribute values are literal text: surrounding quotes are removed and HTML entities are not decoded.
- Attributes are caller-defined. comment-mark stores and matches on them; it does not interpret them.

## Selectors

A selector is a tag name followed by optional attribute predicates:

| Selector | Matches |
| --- | --- |
| `contributors` | Every marker with that tag name |
| `contributors[role]` | Markers that have a `role` attribute |
| `contributors[role='maintainer']` | Markers whose `role` is `maintainer` |
| `contributors[role='maintainer'][lang='en']` | Markers that satisfy every predicate |

- A tag name on its own is usually enough. Give each section you update from the CLI its own tag name so the flag needs no quoting.
- When several sections share a tag name, a predicate narrows them. Testing that an attribute exists (`contributors[role]`) is simpler than comparing its value.
- Attribute values compare as literal text, so `[role='maintainer']` matches `role=maintainer` however the source quoted it.
- Single quotes, double quotes, and unquoted values all work in a selector.
- Combinators, selector lists, pseudo-classes, and operators other than `=` are rejected instead of quietly matching nothing.

## API

### `commentMark(input, replacements)`

Replace marked sections. This function transforms content in memory; it does not read or write files. It returns a promise, so a value can be a function that reads a file or does other async work.

```js
import { commentMark } from 'comment-mark'

const updated = await commentMark('Version: <!-- version -->1.0.0<!-- /version -->', {
    version: '2.0.0'
})

console.log(updated)
// Version: <!-- version -->2.0.0<!-- /version -->
```

A value can also be a function that computes the replacement from the marker it targets:

```js
const updated = await commentMark('<!-- views -->40<!-- /views -->', {
    views: ({ content }) => String(Number(content) + 1)
})

console.log(updated)
// <!-- views -->41<!-- /views -->
```

To update the marker's attributes, its content, or both, pass an object. This works when the replacement is already known:

```js
const updated = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
    item: {
        attributes: {
            kind: 'vegetable',
            size: 'small'
        },
        content: 'carrot'
    }
})

console.log(updated)
// <!-- item kind="vegetable" size="small" -->carrot<!-- /item -->
```

`attributes` is the marker's complete attribute set, so that object drops anything the marker had besides `kind` and `size`. When the new value depends on the marker's current attributes, use a function instead and spread what it receives:

```js
const updated = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
    item: ({ attributes }) => ({
        attributes: {
            ...attributes,
            size: 'small'
        }
    })
})

console.log(updated)
// <!-- item kind="fruit" size="small" -->apple<!-- /item -->
```

- `input` (`string | Buffer`): Markdown or HTML content
- `replacements` (object): Values keyed by selector. Each value is a string, an object, a function, `null`, `undefined`, or an array of those.

Returns a promise that resolves to the updated content as a string. Buffer input is decoded as UTF-8.

- A string replaces the first matching section.
- An array replaces matches by position in document order: entry `0` updates the first match, entry `1` the second, and so on. Matches past the end of the array are left alone.
- A `null` or `undefined` entry consumes its position without replacing anything.
- Resolves every selector before applying any replacement, so one replacement cannot change which markers another targets.
- A function value runs for every match, in document order. It receives the marker (`{ tagName, attributes, content }`) and its zero-based position among the selector's matches. Its string result is inserted verbatim, with no added newline. The function may return a promise, which is awaited before the next resolver runs.
- An object value (`{ attributes?, content? }`) replaces the parts it sets and preserves the parts it omits. `attributes` is the marker's complete attribute set, including `id`, so an attribute left out is removed. Its `content` is inserted verbatim, with no added newline.
- In an object value, an omitted or `undefined` field preserves that part, `content: ''` clears the content, and `attributes: {}` removes every attribute. An attribute value must be a string, so `attributes: { hash: undefined }` is invalid.
- A function may return an object with the same rules. It receives the marker, so spread `marker.attributes` to keep the ones you do not change.
- A changed attribute value is written back in place, keeping the whitespace around `=`, the indentation, and the line endings. The value reuses its original quoting when it still fits, and is re-quoted otherwise. A new attribute is appended as `name="value"`.
- A static value whose selector matches no marker rejects, so a typo or a stale selector is not mistaken for a successful no-op. A function runs for every match, so a selector that matches nothing is a no-op. Pass an empty array to request no change explicitly.
- Rejects an array with more values than matches, and two selectors that target the same marker, rather than dropping values or picking a winner.
- Ignores markers inside fenced code blocks and inline code spans.
- Wraps bare string replacements containing `\n` in an additional newline on each side.
- Rejects when a marker is malformed or nested, when a resolver throws or rejects, or when an update cannot be written: an attribute name the grammar rejects, a value containing `-->`, or a value that needs both quote characters.

An array updates matches by position, so one call can set repeated sections:

```js
await commentMark('<!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', {
    item: ['orange', 'grape']
})
// <!-- item -->orange<!-- /item --><!-- item -->grape<!-- /item -->
```

A function runs for every match, so one call can compute each section from its own data:

```js
await commentMark('<!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', {
    item: ({ content }, index) => `${index + 1}. ${content}`
})
// <!-- item -->1. apple<!-- /item --><!-- item -->2. pear<!-- /item -->
```

Indented code blocks and code spans that wrap across lines are not detected as code, so a marker placed there is treated as real. Put active markers in prose, and put literal examples inside fenced code or single-line inline code.

### `getCommentMark(input, selector)`

Return the first matching marker, or `null`:

```js
import { getCommentMark } from 'comment-mark'

const version = getCommentMark('Version: <!-- version -->2.0.0<!-- /version -->', 'version')

console.log(version?.content)
// 2.0.0
```

### `getCommentMarkAll(input, selector?)`

Return every matching marker in document order:

```js
import { getCommentMarkAll } from 'comment-mark'

const markers = getCommentMarkAll('<!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', 'item')

console.log(markers.map(marker => marker.content))
// [ 'apple', 'pear' ]
```

Omitting the selector returns every recognized marker. Each entry is a plain object with `tagName`, `attributes`, and `content`. Every occurrence is kept, so a tag name can appear more than once.

## Example: Git contributors

Add a section to `README.md`:

```md
## Contributors
<!-- contributors --><!-- /contributors -->
```

Fill it with the output of `git shortlog`:

```sh
npx comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"
```

For a repository with two contributors, the result looks like:

```md
## Contributors
<!-- contributors -->
    17  John Doe <john.doe@example.com>
     5  Jane Smith <jane.smith@example.com>
<!-- /contributors -->
```

Shell command substitution removes trailing newlines. For multiline values, comment-mark adds a newline at each end so the content sits between the marker lines.

### Real-world examples

- [Project index](https://github.com/privatenumber/privatenumber): Updates the README from `projects.json` on each Git commit
- [Minification Benchmarks](https://github.com/privatenumber/minification-benchmarks): Inserts benchmark results into the README

## FAQ

### Why HTML comments?

HTML comments are hidden in rendered Markdown but remain visible in the source. They mark where generated content belongs without adding visible template syntax to the document.

### How does comment-mark tell a marker from an ordinary comment?

A comment is a marker only when a later comment closes the same tag name, as `<!-- contributors -->` is closed by `<!-- /contributors -->`. Every other comment stays ordinary text, so `<!-- TODO -->`, `<!-- TODO: fix this -->`, and `<!-- 1 + 1 -->` are left alone.

### Why use a pair of comments?

The opening and closing comments delimit the content to replace. Both stay in the output, so later updates can find the same section without a separate template file.

### How are code examples ignored?

Fenced code blocks (backtick or tilde, including blockquote prefixes) and single-line inline code spans are skipped, so a marker shown as an example is not treated as real. Indented code blocks and code spans that wrap across lines are not detected, so a marker there is treated as real.

### Why are nested markers rejected?

A marker's content runs until its closing comment, so replacing the outer section would delete the inner markers. Nesting aborts parsing instead of silently dropping them.

### Why does a marker have a tag name and attributes?

The tag name names the section, and attributes describe it. Together they form a selector, so a document can hold several sections of the same kind and each one can be addressed by what distinguishes it. A unique tag name per section is usually simplest, especially for CLI updates; attributes are for when sections of the same kind need to be told apart.

## Related

- [mdeval](https://github.com/privatenumber/mdeval): Run JavaScript inside Markdown comments, keeping the logic next to the content it produces
- [md-pen](https://github.com/privatenumber/md-pen): Typed utilities for formatting Markdown

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg" alt="Sponsors">
	</a>
</p>

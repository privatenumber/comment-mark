# Node.js API

[Back to README](../README.md)

Selectors use the syntax described in [Markers and selectors](./markers.md#selectors).

## Update a file

`commentMark` transforms a string, so read the file, pass values keyed by selector, and save the result:

```js
import fs from 'node:fs/promises'
import { commentMark } from 'comment-mark'

const markdown = await fs.readFile('README.md', 'utf8')
const updated = await commentMark(markdown, {
    lastUpdated: '2026-09-07'
})

await fs.writeFile('README.md', updated)
```

For a `README.md` containing:

```md
## Last updated
<!-- lastUpdated --><!-- /lastUpdated -->
```

The script writes:

```md
## Last updated
<!-- lastUpdated -->
2026-09-07
<!-- /lastUpdated -->
```

Run the script again with a new value to replace the section. The surrounding document and marker comments stay intact. For a live timestamp, use `new Date().toISOString()` as the value.

## `commentMark(input, replacements)`

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
const updated = await commentMark('Views: <!-- views -->40<!-- /views -->', {
    views: ({ content }) => String(Number(content) + 1)
})

console.log(updated)
// Views: <!-- views -->41<!-- /views -->
```

To update the marker's attributes, its content, or both, pass an object. This works when the replacement is already known:

```js
const updated = await commentMark('Item: <!-- item kind="fruit" -->apple<!-- /item -->', {
    item: {
        attributes: {
            kind: 'vegetable',
            size: 'small'
        },
        content: 'carrot'
    }
})

console.log(updated)
// Item: <!-- item kind="vegetable" size="small" -->carrot<!-- /item -->
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
- `replacements` (object): Values keyed by selector. Each value is a string, an object, a function, `null`, `undefined`, or an array of static values.

Returns a promise that resolves to the updated content as a string. Buffer input is decoded as UTF-8.

- A string replaces the first matching section.
- An array replaces matches by position in document order: entry `0` updates the first match, entry `1` the second, and so on. Matches past the end of the array are left alone.
- A `null` or `undefined` entry consumes its position without replacing anything.
- Resolves every selector before applying any replacement, so one replacement cannot change which markers another targets.
- A function used as the selector's value runs for every match, in document order. It receives the marker (`{ tagName, attributes, content }`) and its zero-based position among the selector's matches. Its string result is inserted like any other content. The function may return a promise, which is awaited before the next resolver runs.
- A function must be the selector's value, not an array entry: an array holds static values and replaces matches by position, so a computed replacement always runs for every match.
- An object value (`{ attributes?, content? }`) replaces the parts it sets and preserves the parts it omits. `attributes` is the marker's complete attribute set, including `id`, so an attribute left out is removed. Its `content` is inserted like any other content.
- In an object value, an omitted or `undefined` field preserves that part, `content: ''` clears the content, and `attributes: {}` removes every attribute. An attribute value must be a string, so `attributes: { hash: undefined }` is invalid.
- A function may return an object with the same rules. It receives the marker, so spread `marker.attributes` to keep the ones you do not change.
- A changed attribute value is written back in place, keeping the whitespace around `=`, the indentation, and the line endings. The value reuses its original quoting when it still fits, and is re-quoted otherwise. A new attribute is appended as `name="value"`.
- A static value whose selector matches no marker rejects, so a typo or a stale selector is not mistaken for a successful no-op. A function runs for every match, so a selector that matches nothing is a no-op. Pass an empty array to request no change explicitly.
- Rejects an array with more values than matches, a function as an array entry, and two selectors that target the same marker, rather than dropping values or picking a winner.
- Ignores markers inside fenced code blocks and inline code spans.
- When a line starts an HTML comment block after any list or blockquote prefixes and up to three indentation columns, markers on that line put nonempty content on its own lines. Missing boundary breaks use the first line ending outside every marker's opening comment and content (CRLF, LF, or CR), or LF when there is none. Other markers get no added boundary line breaks; inside lists and blockquotes, continuation prefixes are still written after content line breaks. This also applies to HTML, where added breaks may be visible inside `<pre>`.
- Rejects updates that would change marker boundaries, line context, or container continuation, such as an unclosed fence hiding a closing comment.
- Content in a list item or blockquote stays in that container. Reading the content removes its container prefixes.
- Rejects when a marker is malformed, when a resolver throws or rejects, or when an update cannot be written: an attribute name the grammar rejects, a value containing `-->`, or a value that needs both quote characters.

An array updates matches by position, so one call can set repeated sections:

```js
await commentMark('Items: <!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', {
    item: ['orange', 'grape']
})
// Items: <!-- item -->orange<!-- /item --><!-- item -->grape<!-- /item -->
```

A function runs for every match, so one call can compute each section from its own data:

```js
await commentMark('Items: <!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', {
    item: ({ content }, index) => `${index + 1}. ${content}`
})
// Items: <!-- item -->1. apple<!-- /item --><!-- item -->2. pear<!-- /item -->
```

Indented code blocks and code spans that wrap across lines are not detected as code, so a marker placed there is treated as real. A marker inside indented code cannot render as if absent. Put active markers in prose, and put literal examples inside fenced code or single-line inline code.

## `getCommentMark(input, selector)`

Return the first matching marker, or `null`:

```js
import { getCommentMark } from 'comment-mark'

const version = getCommentMark('Version: <!-- version -->2.0.0<!-- /version -->', 'version')

console.log(version?.content)
// 2.0.0
```

## `getCommentMarkAll(input, selector?)`

Return every matching marker in document order:

```js
import { getCommentMarkAll } from 'comment-mark'

const markers = getCommentMarkAll('<!-- item -->apple<!-- /item --><!-- item -->pear<!-- /item -->', 'item')

console.log(markers.map(marker => marker.content))
// [ 'apple', 'pear' ]
```

Omitting the selector returns every recognized marker. Each entry is a plain object with `tagName`, `attributes`, and `content`. Every occurrence is kept, so a tag name can appear more than once.

## `comment-mark/plugins/files`

Fill markers with the contents of other files. The plugin returns replacements keyed by tag name, so pass them straight to `commentMark`:

```js
import { commentMark } from 'comment-mark'
import { files } from 'comment-mark/plugins/files'

const updated = await commentMark(markdown, files({
    baseDirectory: import.meta.dirname
}))

console.log(updated)
```

Each marker names a file in its `path` attribute:

```md
<!-- file path="./examples/hello.js" -->
<!-- /file -->
```

The file is read as UTF-8. Like any other content, it gets missing boundary line breaks when its marker is on a comment-started line. A balanced marker written inside an included file stays part of the section's content.

- `baseDirectory` (`string`, required): every `path` is resolved against this directory. An absolute `path` is used as written.
- `tagName` (`string`): the tag name of the markers to fill. Defaults to `file`.

The returned object composes with other replacements, so one call can fill files and set other sections:

```js
await commentMark(markdown, {
    ...files({ baseDirectory: import.meta.dirname }),
    version: '2.0.0'
})
```

A marker without a `path` attribute, or a file that cannot be read, rejects the call.

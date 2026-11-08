# Content padding

comment-mark decides the layout of replacement content from the content itself. Content that needs block layout gets a line break after the opening comment and before the closing comment, unless it already has one. A single line of inline text is inserted as written. The same rule applies to static strings, object `content`, resolver results, and the files plugin. There is no option to insert block content byte for byte.

- Rule: [`src/padding.ts`](../../src/padding.ts) (`needsBlockPadding`, `padContent`), applied in [`src/document.ts`](../../src/document.ts) where content is set.
- Contract: [`tests/specs/padding.ts`](../../tests/specs/padding.ts) and the first test in [`tests/specs/files-plugin.ts`](../../tests/specs/files-plugin.ts).
- Shipped in [#33](https://github.com/privatenumber/comment-mark/pull/33). The files plugin ([#30](https://github.com/privatenumber/comment-mark/pull/30)) follows the same rule.

## Why content needs padding

A marker is an HTML comment. In CommonMark, a line that starts with `<!--` (after up to three spaces of indentation) opens an HTML block of type 2. The block ends at the first line that contains `-->`, and that whole line belongs to the block ([CommonMark 0.31.2, section 4.6](https://spec.commonmark.org/0.31.2/#html-blocks); [GFM](https://github.github.com/gfm/#html-blocks) has the same type 2 conditions). Markdown on the same line as an opening comment at the start of a line is therefore passed through as raw HTML and not parsed.

Observed with GitHub's renderer (`gh api -X POST /markdown -f mode=gfm -f text=...`, 2026-11-08):

| Input | Output |
| --- | --- |
| `<!-- f --># Title\n\nBody text\n<!-- /f -->` | `# Title` as literal text, then `<p>Body text</p>` |
| `<!-- f -->\n# Title\n\nBody text\n<!-- /f -->` | `<h1>Title</h1><p>Body text</p>` |
| `<!-- f -->MIT License\n\nCopyright **x**\n<!-- /f -->` | `MIT License` as raw text, not a paragraph |
| ``<!-- f -->\n```js\nx()\n```<!-- /f -->\n\n## After`` | The fence never closes. The closing comment and `## After` render as code. |
| `Written by <!-- a -->**Jane**<!-- /a -->.` | `<p>Written by <strong>Jane</strong>.</p>` |

The rows show both sides of the rule:

- **Leading break:** without it, the first line of block content is swallowed by the comment's HTML block.
- **Trailing break:** without it, the closing comment joins the last line. A closing fence with trailing text is not a closing fence, so the rest of the document becomes code.
- **Inline content:** a comment inside a paragraph is inline HTML, so inline content must not be padded there. A line break would change the paragraph.

## What counts as block layout

`needsBlockPadding` returns true when the content has a line break before any trailing line endings, or when its first line opens a block: an ATX heading, thematic break, setext underline, fenced code, blockquote, list item, a table row starting with `|`, or indented code. It reuses the scanner's block matchers from [`src/parser/block-context.ts`](../../src/parser/block-context.ts), so padding and marker scanning agree on what a block is.

`padContent` only adds a line break on a side that lacks one. Running the same update twice produces the same document, which is checked by the idempotency cases below.

## Decision: pad all content, including included files

Before #33, only static strings containing `\n` were padded. Resolver results and object `content` were inserted as written. That rule was introduced in [#16](https://github.com/privatenumber/comment-mark/pull/16) without a recorded rationale, and both value kinds were added after v2.2.0, so changing them did not break a released contract. The files plugin originally promised to insert file contents "verbatim", which conflicted with #33.

The project applies one content-based rule for every value kind:

- **Rendering correctness.** Unpadded block content renders incorrectly, as shown above. Included files are usually multiline, so they hit this case most often.
- **Consistency.** The layout depends on what the content is, not on how the caller passed it.
- **Verification still works.** A section's content reads back as the padded text, so a check that compares the section with the source file byte for byte fails. The supported check is to run the update again and confirm that nothing changes (the CLI reports `Unchanged`). embedme's `--verify` uses the same model: it reports whether a run would change the document ([README](https://github.com/zakhenry/embedme/blob/3cd8692de2c905cf3c9cbc6d87c1b4220f2e6eeb/README.md)).

### Precedent

Every inspected generator that writes block content between paired markers puts the content on its own lines:

| Tool | Placement | Source |
| --- | --- | --- |
| markdown-magic (including its `FILE` transform) | Adds a leading and trailing line break around multiline content | [`block-transformer/src/index.js#L271-L289`](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-transformer/src/index.js#L271-L289) |
| doctoc | Always wraps the TOC on its own lines, using the document's detected line ending | [`lib/transform.js#L392`](https://github.com/thlorenz/doctoc/blob/56ec8e078ddb3de2bf7834e129a2448606c56443/lib/transform.js#L388-L401) |
| all-contributors CLI | Adds line breaks after the opening marker and before the closing marker | [`src/generate/index.js#L55-L64`](https://github.com/all-contributors/all-contributors-cli/blob/e53bf5c427dad9f7a5186e07c85e2f7a69274e55/src/generate/index.js#L45-L65) |
| markdown-toc | Joins the trimmed sections with blank lines | [`lib/insert.js#L22-L53`](https://github.com/jonschlinkert/markdown-toc/blob/386b44747f271bfd56956d3ee7714e190dc7037f/lib/insert.js#L18-L66) |
| cog | Ensures nonempty output ends with a line break, "or it will be joined to the end-output line, ruining cog's idempotency" | [`cogapp/cogapp.py#L97-L101`](https://github.com/nedbat/cog/blob/892f36c9e7189e61c14e57b153509ded4f1f383d/cogapp/cogapp.py#L95-L103) |
| mdsh | Copies the bytes, but writes a line break after the opening marker. Nothing is added before the closing marker. | [`src/executor.rs#L208-L212`](https://github.com/zimbatm/mdsh/blob/eca79da623dab29ed132b6c4d26a26795c2499c2/src/executor.rs#L208-L212) |

No inspected tool starts block content on the opening marker's line. mdsh is the only one that preserves bytes, and its bare trailing side is the case that leaves a fence open in the table above. None of these tools keep single-line inline values unpadded; comment-mark does, so a value can sit inside a sentence.

### Rejected: a byte-exact insertion mode

An option to skip padding was considered. It is not provided:

- No use case needs it. The only precedent for byte-exact insertion (mdsh) still pads the leading side.
- The unpadded trailing side corrupts the rest of the document when content ends with a fence and no line break.
- It would add an API surface whose main effect is to allow broken output.

Reconsider when a concrete case needs exact bytes. One candidate is a multiline value inside an HTML `<pre>` element, where an extra leading line break is visible.

## Line endings

The added line breaks use the document's line ending: the ending of the first line break in the source, or `\n` when the source has none. The content itself is inserted unchanged, so its own line endings are kept. An existing `\n` or `\r\n` at either end of the content counts as a line break. Shipped in [#36](https://github.com/privatenumber/comment-mark/pull/36); see the line-ending tests in [`tests/specs/padding.ts`](../../tests/specs/padding.ts).

```js
await commentMark('# T\r\n<!-- a --><!-- /a -->\r\n', { a: 'x\r\ny' })
// '# T\r\n<!-- a -->\r\nx\r\ny\r\n<!-- /a -->\r\n'
```

doctoc also detects one line ending per document ([`lib/transform.js#L184-L200`](https://github.com/thlorenz/doctoc/blob/56ec8e078ddb3de2bf7834e129a2448606c56443/lib/transform.js#L183-L200)).

Rejected: the line ending of the opening comment's own line. It is more precise only in documents with mixed line endings, which are rare. When the opening comment is on the last line, it needs a fallback to a whole-document scan. To stay linear across many markers, that fallback needed a cache on the parsed document. The per-document rule needs one `indexOf` per `commentMark` call. That lookup runs only when some content needs padding, so updates with only inline values never scan for it.

## Containers

Content keeps the container of its opening comment. The scanner records a continuation prefix for each marker from the containers open on the opening comment's line: `> ` for a blockquote, and spaces up to the content column for a list item. For example, `> - <!-- a -->` gets `>   `. Writing adds the prefix after every line break in the content, so the closing comment stays in the container too. A blank line gets the prefix without trailing spaces. Shipped in [#37](https://github.com/privatenumber/comment-mark/pull/37); see [`tests/specs/containers.ts`](../../tests/specs/containers.ts).

```js
await commentMark('> <!-- a --><!-- /a -->\n', { a: 'foo\nbar' })
// '> <!-- a -->\n> foo\n> bar\n> <!-- /a -->\n'
```

Before #37, the inserted lines had no prefix. GitHub then rendered an empty blockquote followed by a separate `foo bar` paragraph. markdown-magic keeps the opener's indentation for the same reason ([`block-transformer/src/index.js#L257-L289`](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-transformer/src/index.js#L257-L289)).

Reading strips the same prefixes, in resolver `content`, `getCommentMark`, `getCommentMarkAll`, and the CLI's JSON output. Reading and writing must be inverses. Otherwise a resolver that returns its input adds one more prefix on every run. The tests check three reruns for each container form: the same static value, a resolver `({ content }) => content`, and the CLI, which must report `Unchanged`. A continuation line without the prefix, such as lazy blockquote text, is read as written.

Decision: when the closing comment is in a different container than the opening comment, the opening comment's container wins, and a multiline write moves the closing comment into it. comment-mark already replaces everything between the two comments, and the content starts at the opener, so the opener decides how it renders. Rejecting such markers or skipping them would break markers that work today.

## Performance

Padding runs once per updated marker. Rough timing on Node v24.20.0, Apple M2 Max, 2026-11-08, average of 20 calls to `padContent` with `performance.now()` (not a benchmark harness):

| Input | Time per call |
| --- | --- |
| 2.4 MB multiline content | 0.015 ms (returns at the first line break) |
| 5 MB single line | 11.6 ms |
| 4 MB single line of words | 9.1 ms |

The cost is linear in the content length and smaller than building the output string.

## Known limitations

- **Inline markup alone on a line.** `<!-- a -->**Jane**<!-- /a -->` on its own line renders the literal `**Jane**`, because the content is inline and the comment starts the line. Plain text such as a date or a version still renders. Padding based on the marker's position would fix markup but rewrite every existing one-line section, such as the Quick start's `lastUpdated` example. This has not been changed.

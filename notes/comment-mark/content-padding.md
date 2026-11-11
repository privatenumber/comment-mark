# Content layout

The marker's position decides how replacement content is laid out. If the opening comment starts its line, the content goes on its own lines: comment-mark adds a line break after the opening comment and before the closing comment, on each side that lacks one. If the opening comment is inside a line, the content is inserted with no added line breaks. Empty content stays empty. The rule is the same for static strings, object `content`, resolver results, and the files plugin.

```md
<!-- author -->
**Jane**
<!-- /author -->

Written by <!-- author -->Jane<!-- /author -->.
```

- Rule: `setContent` in [`src/document.ts`](../../src/document.ts) reads the `startsLine` flag that the scanner records for each marker in [`src/parser/scan-comments.ts`](../../src/parser/scan-comments.ts).
- Contract: [`tests/specs/padding.ts`](../../tests/specs/padding.ts), and the rejection tests in [`tests/specs/replacement.ts`](../../tests/specs/replacement.ts).
- Shipped in [#43](https://github.com/privatenumber/comment-mark/pull/43) with a `BREAKING CHANGE:` footer. It replaces the content-based rule of [#33](https://github.com/privatenumber/comment-mark/pull/33); see [rejected alternatives](#rejected-alternatives).
- Checked against the #43 head `5140694` on 2026-11-11.

## Goal: markers render as if absent

A marker should not change how its section renders. The test for every layout rule below is: the output must render the same as the content written in the same place without the markers.

The position matters because of how CommonMark parses comments ([CommonMark 0.31.2, section 4.6](https://spec.commonmark.org/0.31.2/#html-blocks); [GFM](https://github.github.com/gfm/#html-blocks) has the same type 2 conditions):

- **A comment that starts a line opens an HTML block.** After container prefixes and at most three spaces of indentation, a line that starts with `<!--` opens a type 2 HTML block. The block ends on the first line that contains `-->`, and that whole line is raw HTML. Markdown on that line is not parsed, so `<!-- a -->**Jane**<!-- /a -->` on its own line shows the literal text `**Jane**`. The content must start on the next line, and the closing comment must not share the content's last line, or a closing fence such as ```` ```<!-- /a --> ```` stops being a closing fence.
- **A comment inside a line is inline HTML.** In `Written by <!-- a --><!-- /a -->.`, the comment renders as nothing, so content inserted as written renders as if the markers were absent. A line break there would split the sentence or the heading.

"Starts its line" is the scanner's existing HTML-block test, `startsBlockComment`, so the layout and the scanner agree on what an HTML block is:

- At most three columns of indentation after container prefixes, with tabs expanded. Four or more spaces at the top level are indented code, and in a paragraph they continue the paragraph, so `Before\n    <!-- a -->` stays inline.
- A line that starts with a comment is raw HTML as a whole, so every marker on it starts its line, including adjacent pairs such as `<!-- a -->x<!-- /a --><!-- b -->y<!-- /b -->` and markers after an ordinary comment.
- On the line where a multiline comment closes, later markers inherit that comment's block context: `<!-- note\n--> <!-- a -->` starts its line.
- A leading byte order mark is not text. Markdown parsers drop it, so `﻿<!-- a -->` starts its line.

## Evidence: the render matrix

The rules were compared on 64 cases: 8 marker positions × 8 kinds of content. Each case renders the output with GitHub's GFM renderer (`POST /markdown`, `mode: gfm`, run 2026-11-10 and 2026-11-11) and compares it with the rendered oracle, the content written in place without markers. Comments and whitespace between tags are removed before the comparison.

| Rule | Exact HTML match |
| --- | --- |
| A: content-only, `develop` at `d41c4a5` (#33) | 26 |
| A2: A plus own-line layout for content with a trailing line break (#40, reverted) | 31 |
| B: keep the section's existing layout, as markdown-magic does | 31 |
| C3: marker position (#43) | 49 |

Three of C3's 15 mismatches are list items that differ only in whitespace inside the tag (`<li> Jane </li>` against `<li>Jane</li>`), which renders the same. Counted as equal, C3 matches 52 cases. No layout rule can fix the other 12:

- **Line start right after a paragraph line** (5 cases). `Intro\n<!-- a -->` interrupts the paragraph, because a type 2 HTML block can interrupt one. The oracle continues the paragraph.
- **Inline content that ends with a line break,** `2.0\n` and `**Bold**\n` mid-sentence and in a table cell (4 cases). The closing comment then starts a line and opens an HTML block, so the text after it renders raw or the row ends.
- **A fence inside a line whose closing fence ends the content** (3 cases, mid-sentence, heading, and table cell). The closing fence shares its line with the closing comment, so it cannot close. Since #43, these updates are rejected. Content such as `\n```js\nx\n```\n`, with the fence on lines of its own, is accepted; see [structure validation](#structure-validation).

To rerun the matrix, save this script outside the repository and pass the path of a comment-mark `src/index.ts` or built `dist/index.mjs`, absolute or relative to the working directory. It uses `gh auth token` and sends only the synthetic cases to the GitHub API. It stops on any HTTP error from the renderer, prints each mismatch and each rejected update with both renderings or the error, then the score. The normalizer collapses all whitespace, including inside code blocks and between inline elements; none of these cases depends on such whitespace.

````js
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { commentMark } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()

const render = async (text) => {
    const response = await fetch('https://api.github.com/markdown', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
            text,
            mode: 'gfm'
        })
    })
    if (!response.ok) {
        throw new Error(`GitHub /markdown returned ${response.status}`)
    }
    const html = await response.text()
    // Drop comments and collapse whitespace. This also collapses whitespace inside
    // code blocks and between inline elements, which none of these cases depend on.
    return html.replaceAll(/<!--[\s\S]*?-->/g, '').replaceAll(/\s+/g, ' ').replaceAll('> <', '><').trim()
}

const marker = '<!-- a --><!-- /a -->'
// [position, document, container prefix]
const positions = [
    ['line start (top)', `${marker}\n`, ''],
    ['line start after blank', `Intro\n\n${marker}\n`, ''],
    ['line start after paragraph', `Intro\n${marker}\n`, ''],
    ['mid paragraph', `Written by ${marker}.\n`, ''],
    ['in heading', `# Version ${marker}\n`, ''],
    ['blockquote line start', `> ${marker}\n`, '> '],
    ['list item', `- ${marker}\n`, '  '],
    ['table cell', `| a |\n| - |\n| ${marker} |\n`, '']
]
const contents = ['Jane', '**Jane**', '2.0\n', 'a\nb', '# H', '- item', '```js\nx\n```', '**Bold**\n']

let matches = 0
for (const [position, document, prefix] of positions) {
    for (const content of contents) {
        const expected = await render(document.replace(marker, content.replaceAll(/\n(?=.)/g, `\n${prefix}`)))
        let output
        try {
            output = await commentMark(document, { a: content })
        } catch (error) {
            console.log(`rejected | ${position} | ${JSON.stringify(content)} | ${error.message}`)
            continue
        }
        const actual = await render(output)
        if (actual === expected) {
            matches += 1
        } else {
            console.log(`mismatch | ${position} | ${JSON.stringify(content)}\n  expected ${expected}\n  actual   ${actual}`)
        }
    }
}
console.log(`${matches}/${positions.length * contents.length} render like the content without markers`)
````

Observed on 2026-11-11 with Node `v26.13.0`: `49/64` for the #43 head, `31/64` for A2 at `2f947b5` (exported with `git archive 2f947b5 src`), and `26/64` for `develop` at `d41c4a5`. One independent rerun during review scored `develop` at `25/64`; a second run of this script reproduced `26/64`, so the difference may come from a renderer response and is not explained. Rule B is not an implementation in any commit: an earlier version of the same cases applied it to `develop`'s output by adding line breaks around any content containing `\n`. Its score is historical and needs that wrapper to reproduce.

## Rejected alternatives

- **A: decide from the content (#33).** Content that looked like block Markdown got its own lines; a single inline line was inserted as written. It cannot be right in both positions: `**Jane**` needs its own lines on a marker line and must stay inline mid-sentence. Score 26.
- **A2: also lay out content with a trailing line break on its own lines (#40).** It fixed `**Bold**\n` on a marker line but split headings such as `# Version <!-- v -->2.0\n<!-- /v -->`. Score 31. Reverted in `479028c` before #40 merged.
- **B: keep the section's existing layout.** markdown-magic adds line breaks only when the original section or the new content is multiline ([source](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-transformer/src/index.js#L271-L289); [details](../markdown-magic/block-replacement.md)). A one-line section stays one line, so inline markup on a marker line stays literal. Score 31.
- **Byte-exact insertion.** See [below](#rejected-a-byte-exact-insertion-mode).

C3 costs one migration. A one-line section whose marker sits alone on its line, such as `<!-- version -->1.2.3<!-- /version -->`, becomes three lines on its next update. After a blank line, plain text renders the same text, now inside a `<p>` instead of a raw HTML block, so styles that target paragraphs can apply to it. Right after a paragraph line, the value also moves out of that paragraph's HTML into its own paragraph; see [the matrix](#evidence-the-render-matrix). The visible text does not change, and the next release is a major version for other reasons (ESM-only). Reconsider the rule only with a case where a line-start marker needs inline content, or where an inline marker needs block content, that the render matrix can show.

### Precedent

Tools whose markers sit on their own lines put content on its own lines. Tools with inline markers insert inline values:

| Tool | Placement | Source |
| --- | --- | --- |
| mdast-zone | Works on block-level comment nodes in the syntax tree, so its zones are block zones between line-start comments | [6.1.0](https://github.com/syntax-tree/mdast-zone/tree/6.1.0) |
| mdeval | Inline value markers mid-line; block output (its `block()` helper) on marker lines | [README](https://github.com/privatenumber/mdeval/blob/v2.0.0/README.md) |
| markdown-magic (including its `FILE` transform) | Adds line breaks around multiline content under the linked conditions | [Block replacement](../markdown-magic/block-replacement.md) |
| doctoc | Always wraps the TOC on its own lines, using the document's detected line ending | [`lib/transform.js#L392`](https://github.com/thlorenz/doctoc/blob/56ec8e078ddb3de2bf7834e129a2448606c56443/lib/transform.js#L388-L401) |
| all-contributors CLI | Adds line breaks after the opening marker and before the closing marker | [`src/generate/index.js#L55-L64`](https://github.com/all-contributors/all-contributors-cli/blob/e53bf5c427dad9f7a5186e07c85e2f7a69274e55/src/generate/index.js#L45-L65) |
| markdown-toc | Joins the trimmed sections with blank lines | [`lib/insert.js#L22-L53`](https://github.com/jonschlinkert/markdown-toc/blob/386b44747f271bfd56956d3ee7714e190dc7037f/lib/insert.js#L18-L66) |
| cog | Ensures nonempty output ends with a line break, "or it will be joined to the end-output line, ruining cog's idempotency" | [`cogapp/cogapp.py#L97-L101`](https://github.com/nedbat/cog/blob/892f36c9e7189e61c14e57b153509ded4f1f383d/cogapp/cogapp.py#L95-L103) |
| mdsh | Copies the bytes, but writes a line break after the opening marker. Nothing is added before the closing marker. | [`src/executor.rs#L208-L212`](https://github.com/zimbatm/mdsh/blob/eca79da623dab29ed132b6c4d26a26795c2499c2/src/executor.rs#L208-L212) |
| terraform-docs | Its default inject-mode template places generated content on its own line between the comments | [Output configuration](https://github.com/terraform-docs/terraform-docs/blob/b17ec1bebe08758be2110de4894742bdae515e17/docs/user-guide/configuration/output.md#L20-L25) and [default template](https://github.com/terraform-docs/terraform-docs/blob/b17ec1bebe08758be2110de4894742bdae515e17/docs/user-guide/configuration/output.md#L39-L64) |

No inspected tool starts multiline content on the line of a line-start opening marker. mdsh is the only one that preserves bytes, and its bare trailing side is the case that leaves a fence open.

Prettier's [range ignore](https://github.com/prettier/prettier/blob/b09dd90022c875f3089f19f37724da6377e52b7f/docs/ignore.md#L130-L148) is not an injector, but it constrains generated sections: its `<!-- prettier-ignore-start -->` and `<!-- prettier-ignore-end -->` markers work only at the top level, with a blank line before each. A generated section that must stay unformatted needs those markers on their own lines around comment-mark's markers.

## Structure validation

An update may change markers' content and attributes. It must never change the document's marker structure. Since #43, `commentMark` parses its output again whenever the output differs from the input. It rejects the update with `[comment-mark] Replacement for "<selector>" would change the document's markers` if any marker differs in tag name, opening or closing position, `startsLine`, or container continuation. The error names every selector whose section changed. The CLI writes nothing on rejection. Source: `commentMark` in [`src/index.ts`](../../src/index.ts).

This is the policy the attribute writer already follows: never write something the reader would parse differently. Without it, inserted content could corrupt the document silently:

- `Example: <!-- a --><!-- /a -->` with a fenced block that ends at the end of the content puts the closing comment on the closing fence's line, so the fence never closes. The next run finds no markers, and updates to unrelated markers fail as missing.
- An unclosed fence, an unmatched same-name opener, or an unfinished `<!-- note` hides or captures a closing comment. See the [scanner gaps](./comment-scanning.md#supported-limits-and-observed-gaps) and [file inclusion](./file-inclusion.md).
- An earlier replacement on the same line can change a later marker's line context or its list context, which would change that marker's layout on the next run.

Rejected: validating only when the content contains a character that can affect the scanner (`<`, a backtick, or `~`). This counterexample has none of them:

```md
x <!-- a --><!-- /a -->
2. ~~~
   <!-- b -->old<!-- /b -->
   ~~~
```

Replacing `a` with `\n` moves the closing comment to its own line. The paragraph then ends, `2.` opens a list, and the fence hides `b`. Removing a line break can expose a hidden marker the same way. The structure depends on the content and the surrounding document together, so no character-based gate is sound.

Also rejected: re-parsing only from the first changed marker. A change can affect the parse of everything after it, and resuming mid-document would need snapshots of the scanner's container and fence state at line boundaries.

Validation uses the same scanner as the update, so it cannot catch what the scanner gets wrong. See [limits](#limits).

## Line endings

Added line breaks use the first line break outside every marker's opening comment and content: CRLF, LF, or a lone CR, matching the scanner's line endings. A document without one gets LF. Replacement content and attribute updates rewrite only those excluded ranges, so a rerun picks the same line ending. A rerun of static content, or of a resolver that returns its input, then leaves the document unchanged. Other updates can still differ on a rerun: a resolver that increments a counter, or a static update that changes an attribute its own selector matches, such as `a[id=old]` setting `id=new`, which finds no marker on the second run. The content's own line endings are kept. An existing `\n`, `\r\n`, or lone `\r` at either end of the content counts as a line break.

```js
await commentMark('# T\r\n<!-- a --><!-- /a -->\r\n', { a: 'x\r\ny' })
// '# T\r\n<!-- a -->\r\nx\r\ny\r\n<!-- /a -->\r\n'
```

History: [#36](https://github.com/privatenumber/comment-mark/pull/36) used the first LF in the whole source, so a CR-only document got LF padding, and in #43 review an inserted CRLF changed the choice on the next run. doctoc also detects one line ending per document ([`lib/transform.js#L184-L200`](https://github.com/thlorenz/doctoc/blob/56ec8e078ddb3de2bf7834e129a2448606c56443/lib/transform.js#L183-L200)).

Rejected: the line ending of the opening comment's own line. It is more precise only in documents with mixed line endings, which are rare, and it needs a fallback when the opening comment is on the last line. The search runs lazily, at most once per `commentMark` call, when the first nonempty line-start replacement is set, even if that content already has both boundary line breaks.

## Containers

Content keeps the container of its opening comment. The scanner records a continuation prefix for each marker from the containers open on the opening comment's line: `> ` for a blockquote, and spaces up to the content column for a list item. For example, `> - <!-- a -->` gets `>   `. Writing adds the prefix after every line break in the content, for line-start and inline markers alike, so the closing comment stays in the container too. A blank line gets the prefix without trailing spaces. Shipped in [#37](https://github.com/privatenumber/comment-mark/pull/37); see [`tests/specs/containers.ts`](../../tests/specs/containers.ts).

```js
await commentMark('> <!-- a --><!-- /a -->\n', { a: 'foo\nbar' })
// '> <!-- a -->\n> foo\n> bar\n> <!-- /a -->\n'
```

Before #37, the inserted lines had no prefix. GitHub then rendered an empty blockquote followed by a separate `foo bar` paragraph. markdown-magic also preserves indentation in block replacement ([details](../markdown-magic/block-replacement.md)).

Reading strips the same prefixes, in resolver `content`, `getCommentMark`, `getCommentMarkAll`, and the CLI's JSON output. Reading and writing must be inverses. Otherwise a resolver that returns its input adds one more prefix on every run. The tests check three reruns for each container form: the same static value, a resolver `({ content }) => content`, and the CLI, which must report `Unchanged`. A continuation line without the prefix, such as lazy blockquote text, is read as written.

Decision: when the closing comment is in a different container than the opening comment, the opening comment's container wins, and a multiline write moves the closing comment into it. comment-mark already replaces everything between the two comments, and the content starts at the opener, so the opener decides how it renders. Rejecting such markers or skipping them would break markers that work today.

## Verification

A section's content reads back with its added line breaks, so a check that compares the section with the source byte for byte fails. The supported check is to run the update again and confirm that nothing changes; the CLI reports `Unchanged`. Structure validation makes sure an update does not change the structure the scanner already recognizes. It cannot tell whether that structure is the one the author intended: in `<!-- a -->outer<!-- a -->\ninner\n<!-- /a -->`, the reader pairs the inner opener, so `{ a: 'inner' }` returns the source unchanged and a rerun reports success. Such a document is already wrong before the update; see [outermost pairs](./markers-and-selectors.md#outermost-pairs). embedme's `--verify` uses the same model: it reports whether a run would change the document ([README](https://github.com/zakhenry/embedme/blob/3cd8692de2c905cf3c9cbc6d87c1b4220f2e6eeb/README.md)).

### Rejected: a byte-exact insertion mode

An option to skip the added line breaks was considered. It is not provided:

- No use case needs it. The only precedent for byte-exact insertion (mdsh) still adds the leading line break.
- Without the trailing line break, content that ends with a fence corrupts the rest of the document. Validation would now reject that update, so the option would mostly add a way to fail.
- An inline marker already inserts content without added boundary line breaks, which covers most needs for exact bytes. It is still not byte-exact: inside a list or blockquote, the container prefix is written after each line break in the content, and validation can reject the update.

Reconsider when a concrete case needs exact bytes in a line-start marker. One candidate is a multiline value inside an HTML `<pre>` element, where the added line breaks are visible.

## Performance

The layout decision is one flag per marker, taken from a check the scanner already runs on each line, so reads cost the same as before. Structure validation adds one parse to every update that changes the document. An update that assigns no marker returns before rendering.

Measured on Node `v26.13.0`, Apple M2 Max, 2026-11-11, comparing #43 at `4ac6f37` with its base `1ae5a7a`. Later #43 commits did not change the scanner's per-line work or the validation parse. Each value is the median of 21 calls; reads had 5 warmup calls first, updates had none. These are local timings, not the benchmark suite. Run as `node bench.mjs <base>/src/index.ts <head>/src/index.ts` with absolute paths:

```js
const [basePath, headPath] = process.argv.slice(2)
const libs = {
    base: await import(basePath),
    head: await import(headPath)
}
const paragraph = `${'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.\n'.repeat(4)}\n`
const median = times => times.sort((a, b) => a - b)[10].toFixed(3)

// Reads: 5 warmup calls, then the median of 21.
const timeRead = (f) => {
    for (let index = 0; index < 5; index += 1) {
        f()
    }
    const times = []
    for (let index = 0; index < 21; index += 1) {
        const start = performance.now()
        f()
        times.push(performance.now() - start)
    }
    return median(times)
}

// Updates: no warmup, the median of 21.
const timeUpdate = async (f) => {
    const times = []
    for (let index = 0; index < 21; index += 1) {
        const start = performance.now()
        await f()
        times.push(performance.now() - start)
    }
    return median(times)
}

for (const count of [380, 3800]) {
    const document = `${paragraph.repeat(count)}<!-- a -->old<!-- /a -->\n`
    const row = { bytes: document.length }
    for (const [name, library] of Object.entries(libs)) {
        row[`${name} read`] = timeRead(() => library.getCommentMarkAll(document))
        row[`${name} update`] = await timeUpdate(() => library.commentMark(document, { a: 'new' }))
    }
    console.log(JSON.stringify(row))
}
```

| Input | Base read | Head read | Base update | Head update |
| --- | --- | --- | --- | --- |
| 111 KB prose | 0.631 ms | 0.555 ms | 0.545 ms | 1.294 ms |
| 1.1 MB prose | 5.310 ms | 5.090 ms | 5.288 ms | 10.059 ms |

## Limits

- **Markers on a line right after a paragraph line** interrupt the paragraph. No layout rule avoids this; see [the matrix](#evidence-the-render-matrix).
- **Inline content that ends with a line break,** mid-sentence or in a table cell, cannot render as if the markers were absent; in a heading it does. Inline content that ends with a closing fence is rejected by validation.
- **Markers in indented code** cannot render as absent. A marker indented four or more spaces gets inline layout.
- **HTML `<pre>`** shows the added line breaks.
- **Scanner gaps that validation shares.** Validation re-runs the same scanner, so it accepts what the scanner misreads. Observed at the #43 head, and equally on its base:

  - **A multiline attribute value inside a list** is written without the list indentation, which ends the list in GFM. The scanner does not check containers while a comment is open.
  - **A marker on a lazy continuation line** of a blockquote or list gets no container prefix, so a heading in the content renders outside the blockquote.
  - **Backticks on a line that starts with a comment** are still scanned as a code span, so the marker is not found, though the line is raw HTML.

  Reproduce from a checkout, with output observed at the #43 head `1e3009d` and identically at its base `1ae5a7a`:

  ```js
  import { commentMark } from './src/index.ts'

  await commentMark('- <!-- a --><!-- /a --><!-- b --><!-- /b -->', { a: { attributes: { note: 'x\ny' } } })
  // '- <!-- a note="x\ny" --><!-- /a --><!-- b --><!-- /b -->'

  await commentMark('> Intro\ntext <!-- a --><!-- /a --> tail', { a: 'first\n# Heading\nlast' })
  // '> Intro\ntext <!-- a -->first\n# Heading\nlast<!-- /a --> tail'

  await commentMark('<!-- note --> `<!-- a --><!-- /a -->`', { a: 'value' })
  // rejects: [comment-mark] Selector "a" matched no markers
  ```

  These came from the fourth review round of #43. They predate #43, so they were recorded rather than fixed there.

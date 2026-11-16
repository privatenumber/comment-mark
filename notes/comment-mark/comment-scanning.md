# Comment scanning

comment-mark finds markers among the HTML comments that GitHub renders, which it gets from [gfm-comments](https://github.com/privatenumber/gfm-comments). gfm-comments ports the parts of GitHub's renderer, [cmark-gfm 0.29.0.gfm.13](https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13), that decide where raw HTML can appear, then reads that HTML as a browser would. Its [scanner notes](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/comment-scanning.md) own the rules, the [known gaps](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/comment-scanning.md#known-gaps), the verification, and the [GitHub oracle](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/github-oracle.md).

## Decision: find comments with gfm-comments

**Decision (2026-11-16): move the scanner to gfm-comments.** The scanner was developed here in `src/parser/scan-comments/` and moved unchanged from `96765d2`. This reverses the 2026-11-13 decision to keep it in comment-mark until a second consumer needed it: [mdeval](https://github.com/privatenumber/mdeval) needs the same comment positions to find its own markers.

comment-mark uses three parts of each comment that `findComments` returns:

- **Offsets.** [parse-document.ts](../../src/parser/parse-document.ts) classifies each comment as an opener, a closer, or other, and pairs the markers. `findComments` returns only comments closed by `-->`, in document order.
- **`startsLine`.** It decides the [content layout](./content-padding.md). It cannot be derived from the returned comments, because an empty `<!-->`, which is not returned, also starts a line.
- **`continuation`.** The container prefix, such as `> `, that a replacement writes on each new line.

gfm-comments is a devDependency. pkgroll bundles devDependencies into `dist/`, so the published package has no runtime dependency on it. The Markdown tests in [tests/specs/markdown.ts](../../tests/specs/markdown.ts) stay as integration tests: they check that markers update as GitHub renders them.

## Behavior changes from the previous scanner

These changes came with the cmark-gfm-based scanner, before it moved to gfm-comments. Each was checked against the [GitHub oracle](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/github-oracle.md):

- **Markers in indented code are skipped,** with four spaces or a tab, like fenced code.
- **Escaped text, link reference definitions, and code spans that wrap lines or sit in table cells** are skipped.
- **A comment that begins a later line of an HTML block starts its line at any indentation,** because the whole line is raw HTML. On the scanner's [corpus](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/comment-scanning.md#corpus-and-performance), 20 of 5,141 files differ only in this flag, such as READMEs with a tab-indented `<!-- prettier-ignore-start -->` inside `<p align="center">`.
- **Comments in link and image destinations and titles, and in image alt text, are skipped,** for inline links and for references to a definition anywhere in the document. `[x](<!-- a -->)` renders as a link to `!--%20a%20--`, and `![<!-- a -->x](u)` renders the comment as alt text. The previous scanner reported both.
- **A label of only `\v` or `\f` is a definition.** cmark-gfm tests a label's blankness with `cmark_isspace`, which excludes `\v` and `\f`, so `[\v]: <!-- a -->` renders nothing and its comment is skipped. The previous scanner treated the label as blank and reported the comment.
- **A marker on a lazy blockquote or list line gets the container prefix.** `commentMark('> text\nmore <!-- a -->old<!-- /a -->', { a: 'x\ny' })` returns `"> text\nmore <!-- a -->x\n> y<!-- /a -->"`.

## Parser alternatives

These alternatives have different parsing and source-position contracts. Re-evaluate against representative documents before replacing gfm-comments. Versions were checked on 2026-11-08.

| Tool | Relevance |
| --- | --- |
| [htmlparser2](../htmlparser2/comment-tokenizing.md) | HTML tokenizer; malformed-comment behavior changed between 10.0.0 and 12.0.0. |
| [parse5](../parse5/comment-tokenizing.md) | HTML tokenizer with explicit comment states; source slices and parser feedback need care. |
| [micromark](../micromark/html-comments.md) | Markdown-aware, but an HTML flow token can extend past the comment closer. |
| [fast-xml-parser](../fast-xml-parser/comment-scanning.md) | XML comment scanning throws on an absent `-->` and scans normalized input. |
| [@lezer/markdown 1.8.1](https://unpkg.com/@lezer/markdown@1.8.1/dist/index.js) | Candidate if full code protection is needed: its default parser emits positioned `FencedCode`, `CodeBlock` for indented code, `CodeText`, and `InlineCode` nodes. Integration and precedence still need validation. |
| [marked 18.1.3](https://unpkg.com/marked@18.1.3/lib/marked.esm.js) | The experiment below emits `raw` without positions. Summing top-level raw lengths works for the tested LF-only input, not necessarily original-source offsets: the lexer normalizes CR and CRLF and nested tokens can use transformed text. |
| [gfm-code-blocks 1.0.0](https://unpkg.com/gfm-code-blocks@1.0.0/index.js) | Its [regex dependency](https://unpkg.com/gfm-code-block-regex@1.0.0/index.js) recognizes backtick openers with three or four backticks, not tilde fences. The final package version was published 2017-03-16. |
| [markdown-magic](../markdown-magic/block-parser.md) | Regex-based comment-block parser that treats paired examples inside fences as real blocks. |

### Marked token experiment

On Node 26.13.0, install `marked@18.1.3` in an empty directory, then run:

```sh
fnm exec --using=26.13.0 npm install --no-save --no-package-lock marked@18.1.3
fnm exec --using=26.13.0 node --input-type=module -e 'import {marked} from "marked"; const text="```js\na\n```\n\nx `y` z\n"; console.log(JSON.stringify(marked.lexer(text),null,2))'
```

The observed tokens included these fields, with no position fields on the printed tokens:

```text
{"type":"code","raw":"```js\na\n```","lang":"js","text":"a"}
{"type":"codespan","raw":"`y`","text":"y"}
```

## Historical evaluation from PR #13

These measurements were taken while [PR #13](https://github.com/privatenumber/comment-mark/pull/13) was developed, on an Apple M2 Max with Node 24.14.1 using `mitata`. They are historical means, not measurements of the current scanner, and they are recorded only here: the PR's description and benchmark table do not include them. The original experimental inputs and harness are not available in this repository, so the figures cannot be independently reproduced from these tables alone. The [current benchmark suite](../../bench/) provides a starting point for a new comparison, not the original harness.

The evaluation compared a lazy comment regex, an `indexOf` scanner, `html-comment-regex@1.1.2`, and `parse5@8.0.1`'s tokenizer. `htmlparser2@12.0.0` was also considered for its low-level tokenizer, but no comparable measurement was recorded. `htmljs-parser@5.15.0` was reported to miss fixed comment cases, and `strip-comments@2.0.1` was excluded on complexity grounds without a performance measurement. The original fixed inputs and source audit are unavailable, so these reports are not independent proof of those alternatives' current behavior.

### Comment scanners on valid documents

| Input | Lazy regex | `indexOf` scan | `html-comment-regex` | `parse5` tokenizer |
| --- | ---: | ---: | ---: | ---: |
| Prose only, 1.1 MB | 152.9 µs | 25.8 µs | 152.7 µs | 45.1 ms |
| Few markers, 750 KB | 83.4 µs | 14.0 µs | 82.8 µs | 23.1 ms |
| Many markers, 580 KB | 958.8 µs | 913.2 µs | 849.4 µs | 21.3 ms |
| Many comments, 280 KB | 943.4 µs | 825.8 µs | 848.1 µs | 10.4 ms |

The recorded `parse5` measurements do not establish the performance of `htmlparser2` or a Markdown parser. Both HTML tokenizers impose a different parsing model from the marker scanner, so compare semantics as well as speed before changing the implementation.

### Malformed comment scaling

The input repeated an unterminated marker opener. The measured regex time grew approximately fourfold per doubling, while the `indexOf` candidate grew approximately twofold for these inputs.

| Openers | Lazy regex | `indexOf` scan |
| ---: | ---: | ---: |
| 2,000 | 8.03 ms | 108 µs |
| 4,000 | 31.9 ms | 215 µs |
| 8,000 | 127 ms | 432 µs |
| 16,000 | 510 ms | 872 µs |

### Attribute parser comparison

| Input | Regex | Character scanner |
| --- | ---: | ---: |
| Single `id` | 264 ns | 590 ns |
| Three attributes | 425 ns | 635 ns |
| 2,000 attributes | 345 µs | 575 µs |
| One 200 KB quoted value | 62.1 µs | 4.7 µs |

The character scanner cost more for short metadata in this experiment but handled the long quoted value faster. An additional malformed bare-token comparison was reported as 651 µs to 40.7 ms for regex and 10.7 µs to 39.4 µs for the scanner; the input sizes for those endpoints were not recorded, so the result cannot establish a scaling rate.

### Earlier implementation versus the PR #13 final scanner

| Input | Earlier regex implementation | PR #13 scanner |
| --- | ---: | ---: |
| Prose only, 1.1 MB | 2.45 ms | 25.6 µs |
| Few markers, 750 KB | 1.31 ms | 55.6 µs |
| Many markers, 580 KB | 8.57 ms | 6.29 ms |
| README-like with fences, 200 KB | 3.23 ms | 1.20 ms |
| Unterminated, 16,000 openers | 510 ms | 449 µs |
| Bare attribute token, 8,000 characters | 40.7 ms | 29.2 µs |

These cases favored the final scanner in that experiment. The implementation has since changed, so neither the numbers nor the earlier optimization strategy should be assumed to describe today's code.

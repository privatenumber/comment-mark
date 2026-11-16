# Comment scanning

comment-mark finds markers among the HTML comments that GitHub renders, which it gets from [gfm-comments](https://github.com/privatenumber/gfm-comments). gfm-comments ports the parts of GitHub's renderer, [cmark-gfm 0.29.0.gfm.13](https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13), that decide where raw HTML can appear, then reads that HTML as a browser would. Its [scanner notes](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/comment-scanning.md) own the rules, the [known gaps](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/comment-scanning.md#known-gaps), the verification, and the [GitHub oracle](https://github.com/privatenumber/gfm-comments/blob/6c37c80/notes/gfm-comments/github-oracle.md).

## Decision: find comments with gfm-comments

**Decision (2026-11-16): move the scanner to gfm-comments.** The scanner was developed here in `src/parser/scan-comments/` and moved unchanged from `96765d2`. This reverses the 2026-11-13 decision to keep it in comment-mark until a second consumer needed it: [mdeval](https://github.com/privatenumber/mdeval) needs the same comment positions to find its own markers.

comment-mark uses three parts of each comment that `findComments` returns:

- **Offsets.** [parse-document.ts](../../src/parser/parse-document.ts) classifies each comment as an opener, a closer, or other, and pairs the markers. `findComments` returns every comment GitHub renders, in document order, including comments that end at a parse error. comment-mark keeps only comments whose closer, read from `contentEnd` through `end`, is `-->`.
- **`startsLine`.** It decides the [content layout](./content-padding.md). comment-mark cannot derive it from the comments it keeps. An empty `<!-->` is returned with the closer `>` and `startsLine: true`, so comment-mark drops it, but it still makes the next comment on its line start that line. The same `>` or `-` can also be a container marker on one line and HTML block text on another.
- **`continuation`.** The container prefix, such as `> `, that a replacement writes on each new line.

gfm-comments is a devDependency. pkgroll bundles devDependencies into `dist/`, so the published package has no runtime dependency on it. gfm-comments' own tests cover the rendering rules; most of them came from this repository's `tests/specs/markdown.ts` at `96765d2`. comment-mark keeps only tests of its own contract:

- [tests/specs/markdown.ts](../../tests/specs/markdown.ts): comments that end at a parse error, and empty comments, never open or close markers.
- [tests/specs/scaling.ts](../../tests/specs/scaling.ts): unmatched closers do not make marker pairing quadratic.
- [tests/specs/reference-parser.ts](../../tests/specs/reference-parser.ts): the micromark differential check.
- [tests/specs/padding.ts](../../tests/specs/padding.ts) and [tests/specs/containers.ts](../../tests/specs/containers.ts): `startsLine` and `continuation` reach the output layout.

## Behavior changes from the previous scanner

The cmark-gfm-based scanner changed which comments render and which start their line, before it moved to gfm-comments. See [design: three phases](https://github.com/privatenumber/gfm-comments/blob/develop/notes/gfm-comments/comment-scanning.md#design-three-phases), [link, image, and cell markup](https://github.com/privatenumber/gfm-comments/blob/develop/notes/gfm-comments/comment-scanning.md#link-image-and-cell-markup), and [corpus and performance](https://github.com/privatenumber/gfm-comments/blob/develop/notes/gfm-comments/comment-scanning.md#corpus-and-performance). One change is in comment-mark's output: a marker on a lazy blockquote or list line gets the container prefix. `commentMark('> text\nmore <!-- a -->old<!-- /a -->', { a: 'x\ny' })` returns `"> text\nmore <!-- a -->x\n> y<!-- /a -->"`.

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

The scanner benchmarks from [PR #13](https://github.com/privatenumber/comment-mark/pull/13) moved with the scanner. See [historical evaluation from PR #13](https://github.com/privatenumber/gfm-comments/blob/develop/notes/gfm-comments/comment-scanning.md#historical-evaluation-from-pr-13) in gfm-comments.

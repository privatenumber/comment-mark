# Related tools

comment-mark is a small library and CLI that replaces the content between paired HTML comments. Several established tools solve neighboring problems: generating Markdown sections, inserting files, or finding comments in Markdown and HTML. This note maps what each one does, how comment-mark differs, and what comment-mark took from it or decided against. Detailed upstream behavior lives in each tool's own note, and the comment-mark decisions link back to the evidence.

Sources were checked on 2026-11-08 at the versions or commits named in the linked notes.

## Where comment-mark sits

comment-mark combines four properties. No inspected tool has all of them:

- **Content between paired markers.** The section is cached between an opening and a closing comment, so the same file is both the template and the output. See [markers and selectors](./markers-and-selectors.md).
- **Code examples stay literal.** Markers inside fenced code and single-line inline code spans are ignored. Indented code, inline spans that wrap across lines, and some code spans in GFM table cells are not protected; see the [scanner gaps](./comment-scanning.md#supported-limits-and-observed-gaps). See [comment scanning](./comment-scanning.md).
- **Selection by tag name and attributes.** A selector can target one of several markers with the same tag name. See [markers and selectors](./markers-and-selectors.md).
- **Content-based layout.** Block content gets line breaks and container prefixes, so it renders inside the section. See [content padding](./content-padding.md).

## Section generators

These tools write generated content between paired comment markers, which is comment-mark's core job.

| Tool | What it does | Relation to comment-mark |
| --- | --- | --- |
| [markdown-magic](../markdown-magic/README.md) | General transform runner over paired comment blocks, with `FILE`, `CODE`, `REMOTE`, and TOC transforms | Closest analogue. Its block parser is regex-based and not fence-aware, so a syntax example inside a code fence is treated as a real block; comment-mark's scanner exists to avoid that. comment-mark follows its multiline padding and indentation behavior. |
| [markdown-autodocs](https://github.com/dineshsonachalam/markdown-autodocs/blob/068d9d071aa4ac245d5fbe1a7b8a39df65637c99/README.md) | GitHub Action that generates and updates Markdown content from local or remote files | Delegates to markdown-magic, but depends on `markdown-magic` `^2.6.0` ([package.json](https://github.com/dineshsonachalam/markdown-autodocs/blob/068d9d071aa4ac245d5fbe1a7b8a39df65637c99/package.json#L35)). The [markdown-magic notes](../markdown-magic/README.md) audit a later version with a different parser, so their findings do not carry over. |
| doctoc, markdown-toc | Generate a table of contents between markers | Always put the TOC on its own lines. doctoc's per-document line-ending detection is the precedent for [padding line endings](./content-padding.md#line-endings). |
| all-contributors CLI | Writes a contributor table between markers | Always uses its own fixed layout. Precedent for [content padding](./content-padding.md#precedent). |
| cog | Runs Python generators between marker lines in any text file | Line-oriented, so no inline values. Its final-newline rule exists for idempotency, the same reason comment-mark pads block content. |
| mdsh | Runs shell commands and inserts their output | Copies bytes without a trailing line break before the closing marker, the case that can leave a fence open. See [content padding](./content-padding.md#rejected-a-byte-exact-insertion-mode). |
| [mdeval](https://github.com/privatenumber/mdeval) | Evaluates JavaScript or TypeScript in Markdown comments and inserts the results | Sibling project by the same author. It finds code ranges with micromark events, including indented code ([`src/parse-markdown.ts#L37-L60`](https://github.com/privatenumber/mdeval/blob/v1.6.0/src/parse-markdown.ts#L37-L60) at v1.6.0). comment-mark uses a smaller scanner that does not protect indented code; see [comment scanning](./comment-scanning.md#supported-limits-and-observed-gaps). |

## File inclusion

comment-mark's [files plugin](./file-inclusion.md) fills a marker from another file. These tools informed its design:

| Tool | Relation to comment-mark |
| --- | --- |
| [VitePress `@include`](../vitepress/include.md) | The most complete reference: line ranges, named regions, frontmatter stripping, and cycle detection. comment-mark ships whole-file inclusion without recursion; the other features are recorded as options not adopted. |
| [markdown-magic `FILE`](../markdown-magic/README.md) | Resolves paths relative to the referencing file and names the file and attribute on errors. comment-mark takes an explicit `baseDirectory` instead, because the API receives a string, not a file path. |
| embedme, embedmd, mdembed | Insert files into code fences or after a directive, not between paired markers. Their line-range and region syntaxes are recorded in [file inclusion](./file-inclusion.md#prior-art). |

## Comment and code parsers

comment-mark scans comments with its own code instead of a dependency. These parsers were evaluated, and their semantics shaped the scanner's rules:

| Parser | Relation to comment-mark |
| --- | --- |
| [htmlparser2](../htmlparser2/README.md) | Fast HTML tokenizer with numeric comment offsets. Rejected because it imposes HTML context rules comment-mark does not want. |
| [parse5](../parse5/README.md) | Spec-compliant HTML tokenizer and the strongest reference for malformed comments, including `--!>`. Rejected because it tokenizes the whole HTML grammar: in [measurements taken while developing #13](./comment-scanning.md#historical-evaluation-from-pr-13) it was about 12 to 1,700 times slower than the `indexOf` scan, depending on the input. Those figures are not published in the PR and cannot be reproduced from the repository. |
| [micromark](../micromark/README.md) | A CommonMark-compliant parser that follows the behavior of the reference parsers `cmark` and `cmark-gfm` ([README](https://github.com/micromark/micromark/blob/4.0.2/packages/micromark/readme.md)). Its comment rules differ between inline and block HTML, so "follow micromark" needs a choice of which semantics to match. mdeval uses it for code ranges. |
| [fast-xml-parser](../fast-xml-parser/README.md) | Finds the comment terminator with a literal `indexOf("-->")`, the precedent for comment-mark's `indexOf` scan. |

Other Markdown parsers and small fence extractors are compared in [comment scanning](./comment-scanning.md).

## Not injectors

[Prettier's range ignore](./content-padding.md#precedent) keeps a region between two comments untouched by formatting. It does not generate content, but it constrains generated sections: its markers must be at the top level with a blank line before each. A section that should stay unformatted needs those markers around comment-mark's markers.

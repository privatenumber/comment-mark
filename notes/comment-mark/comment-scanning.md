# Comment scanning

comment-mark finds markers with an in-house scanner that reports the HTML comments GitHub renders as comments, apart from the [known gaps](#known-gaps). It ports the parts of GitHub's renderer, [cmark-gfm 0.29.0.gfm.13](https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13), that decide where raw HTML can appear, then reads that HTML as a browser would. It builds no syntax tree.

Checked on branch `refactor/two-phase-scanner` (base `develop` at `5723ed5`) with Node 26.13.0 on 2026-11-13.

## Target: GitHub, not CommonMark

**Decision: match GitHub's rendering.** comment-mark documents are mostly READMEs on GitHub, so a marker must be a comment there. The target is cmark-gfm 0.29.0.gfm.13, the latest release on 2026-11-13, with the extensions GitHub enables: table, strikethrough, autolink, tagfilter, and tasklist. A browser's HTML tokenizer then reads the output. A comment is whatever that tokenizer reads as a comment that ends with `-->`.

GitHub differs from CommonMark 0.31.2 (and so from micromark) in ways that change which comments render. The HTML block tag lists differ: cmark-gfm has `source` and not `search` ([`scanners.re`](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/scanners.re#L40)). Type 4 blocks (`<!X`) need an uppercase letter, while `<![cdata[` is case-insensitive. The tagfilter extension escapes the `<` of `<title>`, `<script>`, and seven other tags, so their contents are ordinary HTML instead of raw text ([`tagfilter.c`](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/tagfilter.c)).

## Design: three phases

[scan-comments/](../../src/parser/scan-comments/index.ts) runs three phases. The block phase reads the source once, and the inline and browser phases read the blocks it reports, in source order. Each phase is a module in that folder, and nothing outside it imports them:

1. **Block phase,** [block/](../../src/parser/scan-comments/block/index.ts). A port of `check_open_blocks`, `open_new_blocks`, and `add_text_to_container` in [`blocks.c`](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/blocks.c#L1044-L1518), plus the table extension. It keeps only the stack of open containers and the open leaf block, and reports the text of each paragraph, heading, and table cell, and each line of each HTML block. Code blocks report nothing, so they hold no markers. `index.ts` holds the parser state and the line loop. The scanners whose result depends only on the current line take the source, a position, and the line end, and live beside it: [block starts](../../src/parser/scan-comments/block/block-starts.ts), [HTML block starts and ends](../../src/parser/scan-comments/block/html-block.ts), and [table rows](../../src/parser/scan-comments/block/table.ts).
2. **Inline phase,** [inline-lexer.ts](../../src/parser/scan-comments/inline-lexer.ts). Within each text block, it finds raw HTML spans as `handle_pointy_brace` does. It lexes only what decides where raw HTML can start or whether it renders: backslash escapes, code spans, `<…>` autolinks, and links and images, as `handle_close_bracket` does. A comment in a link destination or title becomes part of the URL or title, and an image's alt text renders as an attribute value, so neither holds a comment. All other text renders escaped and cannot open or close a comment.
3. **Browser phase,** [html-tokenizer.ts](../../src/parser/scan-comments/html-tokenizer.ts). It feeds HTML block lines and raw HTML spans through the states of the [HTML tokenizer](https://html.spec.whatwg.org/multipage/parsing.html#tokenization) that decide where a comment starts and ends: data, tags, attribute values, bogus comments, comments, and raw text.

[reference-definition.ts](../../src/parser/scan-comments/block/reference-definition.ts) ports `cmark_parse_reference_inline`. The block phase drops link reference definitions from the start of a paragraph when it closes, and before a setext underline turns it into a heading, as `resolve_reference_link_definitions` does. A definition renders nothing, so a comment inside one is not a comment.

**Reference links need every definition first.** `[x][r]`, `[r][]`, and `[r]` are links only when the document defines `r`, and the definition can come after the use. The block phase collects the normalized label of each definition it drops. Block events go straight to the inline and browser phases until the first text block that holds `<`, `[`, and `]`, because only such a block can need a label lookup that changes a comment. From that block on, the events are buffered in parallel arrays, three numbers and a container prefix per event, and replayed after the block pass with every label known. Labels compare as `normalize_reference` normalizes them: whitespace is trimmed and collapsed with `cmark_isspace`, NUL and lone surrogates become U+FFFD, and case is folded with [the exceptions](./github-oracle.md#reference-label-case-folding) that make JavaScript's case mapping match cmark-gfm's.

**Why three phases.** The previous scanner mixed block and inline rules line by line. Every rule that spans lines needed its own state: paragraph extent, code spans that wrap lines, HTML blocks, table cells. Each fix added a case, and each case was a new place to disagree with GitHub. Following the renderer's own structure makes each rule a port of a cited function, so a disagreement points to one function.

**Why no tree.** Comments need only the open containers and the current leaf. A tree costs memory per node and a second walk, and the scanner must stay linear on adversarial input. The phases call each other through callbacks. Most of what they keep is bounded by the current leaf block: the line ranges of the open paragraph, its joined text, its backtick runs, and its brackets. Two things grow with the document: the set of reference labels, and, once a lookup can need labels, the buffered block events.

### Where a comment ends

A comment ends at the first `-->` that the browser sees. What the browser sees between two raw HTML pieces decides whether an open comment, tag, or attribute value carries across:

- **Within an HTML block,** lines are separated by a line feed only.
- **Between two raw HTML spans in one text block,** the text between them renders escaped, so it holds no `<` or `-->`.
- **Where the renderer writes markup,** such as `<p>`, `</li>`, or `<hr />`, that markup ends with `>`. It ends an open tag or bogus comment, but an open comment, an open quoted attribute value, and raw text carry past it. The block phase sets a `markup` flag when a block opens or a container closes, and the browser phase resets tag states only when it is set. Two adjacent HTML blocks have no markup between them, so every state carries.

`<!-->` and `<!--->` end a comment at once, as both CommonMark and the HTML standard specify. They are empty, cannot hold a marker, and are not reported. Comments that end at `--!>` or at the end of the input are not reported either.

### Scanner invariants

- **Tabs.** A tab advances to the next multiple of four columns but is one source character. The block phase tracks a partially consumed tab, as cmark-gfm does, so list padding and indented code read the same columns GitHub reads.
- **Limits and NUL.** cmark-gfm's limits apply as it counts them: 80 backticks per code span, 255 for a stored fence length, and 1,000 UTF-8 bytes per reference label. cmark-gfm reads NUL as U+FFFD, so NUL does not end an autolink, counts as 3 bytes in a label, and matches U+FFFD in another label. A lone surrogate reads as U+FFFD too, as UTF-8 encoding writes it.
- **Escapes.** A backslash escape stops `\<` from opening raw HTML and stops a backtick from opening a code span. Inside a code span, backslashes are literal.
- **Linearity.** Each phase reads the source in order. A code span closer is found with one forward cursor per run length, and cmark-gfm's limit of 80 backticks per code span bounds the number of lengths. Searches that could rescan, such as the next `-->` or the next closing quote, use [forward-search.ts](../../src/parser/scan-comments/utils/forward-search.ts), which reuses a result until the scan moves past it. The scaling check below doubles each adversarial input and the time at most doubles.
- **Local state.** Scan state lives in each call, so a resolver's nested parse cannot disturb an outer scan. The `resolver reentrancy` group in the [resolver tests](../../tests/specs/resolvers.ts) checks this. [eslint.config.ts](../../eslint.config.ts) bans regular expressions in `src/` so scans stay index-based. It also turns off `unicorn/prefer-code-point` in `src/parser/`, because the lexers compare UTF-16 code units with ASCII codes and rely on `charCodeAt` returning `NaN` past the end.

## Behavior changes from the previous scanner

Each was checked against the oracle below:

- **Markers in indented code are skipped,** with four spaces or a tab, like fenced code.
- **Escaped text, link reference definitions, and code spans that wrap lines or sit in table cells** are skipped.
- **A comment that begins a later line of an HTML block starts its line at any indentation,** because the whole line is raw HTML. On the corpus below, 20 of 5,141 files differ only in this flag, such as READMEs with a tab-indented `<!-- prettier-ignore-start -->` inside `<p align="center">`.
- **Comments in link and image destinations and titles, and in image alt text, are skipped,** for inline links and for references to a definition anywhere in the document. `[x](<!-- a -->)` renders as a link to `!--%20a%20--`, and `![<!-- a -->x](u)` renders the comment as alt text. The previous scanner reported both.
- **A label of only `\v` or `\f` is a definition.** cmark-gfm tests a label's blankness with `cmark_isspace`, which excludes `\v` and `\f`, so `[\v]: <!-- a -->` renders nothing and its comment is skipped. The previous scanner treated the label as blank and reported the comment.
- **A marker on a lazy blockquote or list line gets the container prefix.** `commentMark('> text\nmore <!-- a -->old<!-- /a -->', { a: 'x\ny' })` returns `"> text\nmore <!-- a -->x\n> y<!-- /a -->"`.

## Known gaps

These forms are still read differently than GitHub reads them. A gap can hide a rendered comment or expose an unrendered one:

- **Reference expansion budget.** cmark-gfm limits the bytes that resolved references copy in, counting each definition's destination and title once per use, to the document's size or 100,000 bytes, whichever is larger ([setup](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/blocks.c#L652-L659), [lookup](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/map.c#L95-L100)). Each lookup is checked on its own: a reference whose definition does not fit in the remaining budget renders as plain text and consumes nothing, and a later reference to a smaller definition can still resolve. A reference that fails this way renders a comment in its image alt text, and its brackets no longer pair as a link. The scanner resolves every defined reference. Reaching the budget takes many references to long destinations, and references in blocks without `<` count toward it too, so modeling it would mean lexing every text block.
- **Bare-URL autolinks.** The autolink extension links bare `http://` and `www.` URLs in `url_match` and `www_match`, and email addresses in `postprocess_text` ([`autolink.c`](https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/autolink.c#L168-L460)). A backtick or backslash inside such a URL is link text, not a code span opener or escape, so it shifts code span pairing. `\<http://x>`aaa x <!-- a -->+`` renders the comment, but the scanner pairs the backticks and hides it.
- **Rendered text and markup inside an open tag.** When raw HTML leaves a tag or attribute value open, the browser reads the rendered output that follows as part of it, until a character ends it. The browser phase models only that generated markup ends with `>`. It ignores that rendered text can hold a `'`, which closes a single-quoted value, and that generated markup can hold quotes, such as `<ol start="2">`, `<td align="left">`, `<pre lang="js">`, and the tasklist `<input>`. In `<div>\n<a b='\n\n'\n\n<!-- a -->old<!-- /a -->`, the lone `'` paragraph closes the value, so GitHub renders the marker, but the scanner keeps the value open and misses it.
- **Tight lists.** A paragraph in a tight list renders without `<p>`, but the block phase assumes generated markup before every text block. When nothing else is generated there, an open tag or bogus comment from earlier raw HTML carries into the paragraph in the browser, while the scanner resets it. In `- <!-- n --><?x\n  text <!-- a -->old<!-- /a -->`, the `<?x` bogus comment hides `<!-- a -->` on GitHub, but the scanner reports it.
- **Browser context.** The browser phase has no tree, so it does not know the insertion mode. It reads `<noscript>` content as raw text everywhere, but inside `<select>` the browser ignores `<noscript>`, so `<select><noscript><!-- a -->old<!-- /a --></noscript></select>` renders the marker that the scanner skips. CDATA in SVG and MathML content is also not modeled: `<svg><text><![CDATA[ > <!-- a -->old<!-- /a --> ]]></text></svg>` holds no comment, but the scanner reports one.
- **Footnotes** are not recognized.

### Observations

Run from the repository root:

```sh
node --input-type=module-typescript -e 'import { getCommentMarkAll } from "./src/index.ts"; const cases = { escaped: "\\<!-- a -->old<!-- /a -->", script: "<script>\n<!-- a -->old<!-- /a -->\n</script>", blockquote: "> <!-- a\n> -->q<!-- /a -->", sameName: "<!-- a -->outer <!-- a -->inner<!-- /a --> tail", fence: "<!-- a -->\n```\n<!-- /a -->", table: "| a | b |\n| - | - |\n| `literal | `<!-- a -->old<!-- /a -->` |" }; for (const [name, input] of Object.entries(cases)) { try { console.log(name, JSON.stringify(getCommentMarkAll(input))); } catch (error) { console.log(name, error.message); } }'
```

Observed output:

```text
escaped []
script [{"tagName":"a","attributes":{},"content":"old"}]
blockquote [comment-mark] Invalid marker attribute: ">"
sameName [{"tagName":"a","attributes":{},"content":"inner"}]
fence []
table []
```

- **Escaped opener** and **table cell code span:** skipped, as GitHub renders them as text. Both were reported as markers before.
- **`<script>`:** the marker is found. This matches GitHub, because tagfilter escapes `<script>`, so its content is ordinary HTML.
- **Multiline opening comment in a blockquote:** the scanner finds the comment, but [parse-attributes.ts](../../src/parser/parse-attributes.ts) reads the `>` on the second line as attribute text and throws. [PR #37](https://github.com/privatenumber/comment-mark/pull/37) fixed continuation of marker content, not of a multiline opening comment.
- **Unbalanced same-name opener** and **unclosed fence:** the closer pairs with the later opener, and a fence inside the section hides the closer. See [marker pairing](./markers-and-selectors.md). Since #43, an update that would produce either one is rejected; see [structure validation](./content-padding.md#structure-validation).

[parse-document.ts](../../src/parser/parse-document.ts) pairs the scanned comments into markers and exposes only outermost pairs; [PR #32](https://github.com/privatenumber/comment-mark/pull/32) introduced that rule. [parse-attributes.ts](../../src/parser/parse-attributes.ts) parses each opening comment's attributes.

## Verification

### GitHub oracle

The primary check compares the scanner with a local stand-in for GitHub: cmark-gfm 0.29.0.gfm.13 built from source with GitHub's extensions, followed by parse5 8.1.1 as the browser. [github-oracle.md](./github-oracle.md) has the build recipe and scripts.

**Oracle validation.** The oracle's visible text matched GitHub's `/markdown` API (`mode=gfm`) on all 180 generated documents tried on 2026-11-13. GitHub's API output has no comment nodes to compare, so the check compares visible text: text that one side hides in a comment and the other shows is a difference. It cannot tell apart two comments that hide the same text with different boundaries.

**Comparison.** `compare.mjs` generates documents from fragments with a seeded random generator, and compares the comments each side finds. Each generated `<!--` gets a unique number, such as `<!-- a12 -->` or `<!--o12q`. A comment is identified by the number it starts with and the last marker number in it, so a match means the same opening and closing on both sides. Where a comment has no number, its first or last 3 characters are compared after both sides are normalized the same way, because a comment that spans chunks also holds generated markup in the oracle's output. Results on 20,000 documents per seed, at the head of this branch on 2026-11-14, each mismatch checked with `show.mjs`:

| Fragment set | Seed | Mismatches | Cause |
| --- | --- | --- | --- |
| `rich` | 1 | 2 | 1 normalization artifact (`<hr />`), 1 quote in generated markup (`<ol start="2">`) |
| `rich` | 2 | 0 | |
| `rich` | 99 | 5 | normalization artifacts |
| `rich` | 12345 | 3 | artifacts |
| `autolink` | 1 | 2 | bare-URL autolinks |
| `autolink` | 2 | 2 | bare-URL autolinks |
| `autolink` | 3 | 0 | |
| `links` | 1, 2, 99 | 0 | |
| `refs` | 1, 2, 99 | 0 | |

A mutant with `<…>` autolinks disabled gives 590 to 650 mismatches per `autolink` seed, so the fuzz detects autolink bugs. The `GitHub rendering` group in the [Markdown tests](../../tests/specs/markdown.ts) locks one case per rule, each checked against the oracle.

### micromark differential spec

The [reference parser spec](../../tests/specs/reference-parser.ts) compares `getCommentMarkAll` with markers built from micromark 4.0.3 with GFM tables on 5,000 seeded documents in `pnpm test`. It needs no C build, so it runs in CI. Its fragments avoid the forms where CommonMark and GitHub differ, so it guards only CommonMark-equivalent behavior. It passes on this branch.

### Corpus and performance

The corpus is 5,141 unique `.md` files (39.6 MB, 2,769 comments) from a local `node_modules` tree. Against `develop` at `5723ed5`, every comment start, inner range, and container prefix is the same, and the 20 files listed in [behavior changes](#behavior-changes-from-the-previous-scanner) differ only in the `startsLine` flag.

Scanning the whole corpus as one string with `mitata` on an Apple M2 Max: this scanner 227 ms per iteration, `develop` 392 ms. Both find 2,769 comments.

**Links and references (2026-11-14).** On a 758-file sample of the corpus (5.5 million characters, 309 comments), link and reference handling costs 2 to 8% against `develop` at `afdc279`, for example 32.8 ms against 30.3 ms. A first version ran a second block pass to collect labels and took 59 ms; buffering only text blocks that hold `<` brought it within 10%. Peak RSS with `/usr/bin/time -l` is unchanged from `afdc279`, about 96 MB, for 500,000 HTML block lines after one marker, and about 94 MB for a 1 MB unclosed link destination. Those inputs measured 174 MB and 126 MB before events were streamed and the destination index was built lazily.

Scaling: each adversarial input below was scanned at 20,000 and 40,000 repetitions, and the time ratio stayed at or below 2: repeated definitions and failing definitions, long labels and escaped titles, open comments, backtick runs, open attribute values, table rows, HTML blocks, nested lists, `< ` and `<!` runs. The [scaling tests](../../tests/specs/scaling.ts) also cover unclosed link destinations and brackets, many references and definitions, and long labels; those compare CPU time, not wall time.

## Scanner extraction

**Decision (2026-11-13): do not publish the scanner as its own package yet.** It now follows GitHub closely, but it has no confirmed consumer. [mdeval](https://github.com/privatenumber/mdeval) was the candidate. It parses with micromark and GFM tables to find code ranges, and separately with `mdast-util-from-markdown` to find rendered leaks, so a switch would speed up only one of its two parses. Revisit when a consumer needs GitHub-faithful comment or raw HTML positions without a tree, or when mdeval's parse cost is measured to matter. An earlier measurement of the previous scanner, about 270 times faster than micromark on a 10.7 MB input, was not repeated for this one.

**Decision (2026-11-14): keep the scanner in TypeScript, not WebAssembly** as in [es-module-lexer](https://github.com/guybedford/es-module-lexer). The scan is not a measured bottleneck: [corpus and performance](#corpus-and-performance) gives 227 ms for 39.6 MB, about 44 µs per file. A typical run reads a few files, so Node startup and file I/O take more time than the scan. WebAssembly would also add costs. The module would read the JavaScript string either through a copy in linear memory or through a call into JavaScript, and neither has been measured against the TypeScript scan. The build would need a second language or toolchain, such as C or AssemblyScript, and the oracle scripts would load a compiled artifact. es-module-lexer runs on every module load in bundlers and loaders, where per-call cost matters. Revisit when a profile of a real workload shows the scan as the main cost.

**Decision (2026-11-14): split the block phase only where state is not shared.** The parser state, the line loop, `openBlock`, and the container stack stay in one closure in [block/index.ts](../../src/parser/scan-comments/block/index.ts), as in `blocks.c`, because they share mutable line state: `offset`, `column`, `containers`, `leaf`, and `markup`. Splitting them would pass that state between modules. The scanners whose result depends only on the current line moved out. On Node 26.13.0, Apple M2 Max, with `mitata`, scanning 753 unique `.md` files from this repository's `node_modules` (5.0M characters, 310 comments) took 28.2 ms per iteration after the split and 28.1 ms before, at `b0709a2`.

## Parser alternatives

These alternatives have different parsing and source-position contracts. Re-evaluate against representative documents before replacing the scanner. Versions were checked on 2026-11-08.

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

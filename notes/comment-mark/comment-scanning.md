# Comment scanning

comment-mark uses an in-house scanner rather than a third-party HTML or Markdown parser. The decision favors marker offsets and the project's Markdown-aware exclusions without imposing a full HTML grammar. The scanner was compared with regex and parser alternatives while [PR #13](https://github.com/privatenumber/comment-mark/pull/13) was developed. The historical measurements below support the performance tradeoff, not a claim about current timings.

Project behavior was checked against develop commit `d41c4a5` on 2026-11-08.

## Current implementation and boundaries

- [parse-document.ts](../../src/parser/parse-document.ts) returns early when no comment opener exists, classifies comments, pairs matching tag names, and exposes only outermost matched pairs. Nested pairs remain content rather than raising an error; [marker tests](../../tests/specs/markers.ts) cover same-name and different-name nesting. [PR #32](https://github.com/privatenumber/comment-mark/pull/32) introduced this rule. PR #13 rejected nested markers with an error, which made any replacement that contained markers fail on the next parse.
- [scan-comments.ts](../../src/parser/scan-comments.ts) scans lines, comments, and inline code together. [block-context.ts](../../src/parser/block-context.ts) tracks fenced blocks and their list and blockquote containers. A closer inside a fence does not close a marker, and a closing fence cannot have trailing text. See the [Markdown tests](../../tests/specs/markdown.ts).
- [parse-attributes.ts](../../src/parser/parse-attributes.ts) scans names and values and rejects adjacent quoted attributes without whitespace. See the [marker tests](../../tests/specs/markers.ts).

The previously reported quadratic search for distinct unmatched backtick runs has been addressed. [scan-comments.ts](../../src/parser/scan-comments.ts) links each run to the next run of equal length instead of searching the rest of the line for each opener. The [scaling test](../../tests/specs/scaling.ts) exercises 2,048 distinct run lengths. This resolves that specific reported search pattern, not a proof that every scanner path is linear.

## Scanner invariants

**Decision: scan comments and Markdown code in one context-aware pass.** Independent comment and code scans allowed a literal `<!--` inside a code example to consume a later real marker. They also let backticks inside an HTML comment hide a real closing marker. [PR #13](https://github.com/privatenumber/comment-mark/pull/13) records the fix, and the `comment and code boundaries` group in the [Markdown tests](../../tests/specs/markdown.ts) locks both directions.

**Block precedence determines whether a fence is active.** Thematic breaks take precedence over list items. Headings and standalone HTML comments end paragraph state, while a comment inside paragraph text does not. Otherwise a following ordered list can be mistaken for paragraph text, exposing its fenced example to updates. The `fenced code blocks`, `heading context`, and `block comments` groups in the [Markdown tests](../../tests/specs/markdown.ts) cover these transitions.

**Keep partially consumed tab columns across containers.** A tab spans up to four rendered columns but has one source index. The [block cursor](../../src/parser/block-context.ts) retains the remaining columns so nested lists can consume them and over-indented fence closers stay inside code. The `fenced code blocks` tests cover nested-list tabs, mixed space and tab padding, and quote-prefixed blank lines.

**Treat inline opening and closing escapes differently.** An odd number of backslashes can prevent a backtick from opening a span, but backslash escapes do not apply inside a [CommonMark code span](https://spec.commonmark.org/0.31.2/#code-spans). A synthetic suffix of an escaped multi-backtick run may open a span but must not close one; otherwise an example marker is exposed. The `inline code` group in the [Markdown tests](../../tests/specs/markdown.ts) covers both escape directions and synthetic runs.

**Keep scan state local to each invocation.** A shared global regex's mutable scan position allowed a resolver's nested parse to restart the outer scan and apply a replacement more than once. The scanner now keeps positions local, and the `resolver reentrancy` group in the [resolver tests](../../tests/specs/resolvers.ts) checks nested reads and updates. The project enforces index-based scanning without regular expressions in `src/` through [eslint.config.ts](../../eslint.config.ts); lint, rather than a duplicate test, owns that restriction.

## Supported limits and observed gaps

Fenced code blocks, including fences in list and blockquote contexts, and single-line inline code spans are protected, except some code spans in GFM table cells (see below). Ordinary indented code blocks and inline code spans that wrap across lines are not detected as code. Markers there can be treated as active. The [markers doc](../../docs/markers.md#how-are-code-examples-ignored) documents this boundary. Revisit the scanner or a parser dependency if full CommonMark protection becomes a requirement or further block-context bugs make the bounded scanner too costly to maintain. Re-measure alternatives against current offset and throughput requirements before changing the implementation.

The following observations are not claims of full Markdown or HTML parsing. They were re-established against `d41c4a5` with Node 26.13.0 on 2026-11-08. Run this command from the repository root:

```sh
fnm exec --using=26.13.0 node --input-type=module-typescript -e 'import { getCommentMarkAll } from "./src/index.ts"; const cases = { escaped: "\\<!-- a -->old<!-- /a -->", script: "<script>\n<!-- a -->old<!-- /a -->\n</script>", blockquote: "> <!-- a\n> -->q<!-- /a -->", sameName: "<!-- a -->outer <!-- a -->inner<!-- /a --> tail", fence: "<!-- a -->\n```\n<!-- /a -->" }; for (const [name, input] of Object.entries(cases)) { try { console.log(name, JSON.stringify(getCommentMarkAll(input))); } catch (error) { console.log(name, error.message); } }'
```

Observed output:

```text
escaped [{"tagName":"a","attributes":{},"content":"old"}]
script [{"tagName":"a","attributes":{},"content":"old"}]
blockquote [comment-mark] Invalid marker attribute: "> -->q<!-- /a --"
sameName [{"tagName":"a","attributes":{},"content":"inner"}]
fence []
```

- **Escaped opener:** the scanner recognizes `\<!-- a -->` as a marker opener. Under [CommonMark backslash escapes](https://spec.commonmark.org/0.31.2/#backslash-escapes), `<` is escapable ASCII punctuation, so this example is not an HTML comment opener in rendered Markdown.
- **HTML context:** the scanner recognizes a marker-looking string inside `<script>`. The scanner is Markdown-oriented; its HTML context support is limited. This observation does not decide a fix.
- **Multiline opening comment in a blockquote:** the continuation prefix is read as marker attribute text and throws. [PR #37](https://github.com/privatenumber/comment-mark/pull/37) fixed continuation of marker content, not parsing of a multiline opening comment.
- **Unbalanced same-name opener:** the only closer pairs with the later opener, so `inner` becomes the recognized content instead of `outer`. **Unclosed fence:** a fence inside the section hides the later closer, so the reader returns no marker. See [marker pairing](./markers-and-selectors.md) for the pairing rule. These describe reading a document that already has such content. Since #43, an update that would produce either one is rejected; see [structure validation](./content-padding.md#structure-validation).
- **Code spans in GFM table cells:** the scanner matches backticks across a whole line, but GFM splits a table row into cells first. In the table below, GitHub renders the second cell as inline code, while the scanner pairs the first cell's unmatched backtick with the second cell's opening backtick. `getCommentMarkAll` then returns the marker, and `commentMark(s, { a: "new" })` changes `old` to `new`. Observed with Node 26.13.0 at `d41c4a5` and GitHub's `/markdown` API (`mode=gfm`) on 2026-11-08.

  ```md
  | a | b |
  | - | - |
  | `literal | `<!-- a -->old<!-- /a -->` |
  ```

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

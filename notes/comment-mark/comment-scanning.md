# Comment scanning

comment-mark uses an in-house scanner rather than a third-party HTML or Markdown parser. The decision favors marker offsets and the project's Markdown-aware exclusions without imposing a full HTML grammar. [PR #13](https://github.com/privatenumber/comment-mark/pull/13) compared the scanner with regex and parser alternatives; its historical measurements below support the performance tradeoff, not a claim about current timings.

Project behavior was checked against commit `0b06496` on 2026-11-08.

## Current implementation and boundaries

- [parse-document.ts](../../src/parser/parse-document.ts) returns early when no comment opener exists, classifies comments, pairs matching tag names, and exposes only outermost matched pairs. Nested pairs remain content rather than raising an error; [marker tests](../../tests/specs/markers.ts) cover same-name and different-name nesting. [PR #32](https://github.com/privatenumber/comment-mark/pull/32) introduced this rule. PR #13 rejected nested markers with an error, which made any replacement that contained markers fail on the next parse.
- [scan-comments.ts](../../src/parser/scan-comments.ts) scans lines, comments, and inline code together. [block-context.ts](../../src/parser/block-context.ts) tracks fenced blocks and their list and blockquote containers. A closer inside a fence does not close a marker, a closing fence cannot have trailing text, and escaped backticks do not open inline spans. See the [Markdown tests](../../tests/specs/markdown.ts).
- [parse-attributes.ts](../../src/parser/parse-attributes.ts) scans names and values and rejects adjacent quoted attributes without whitespace. See the [marker tests](../../tests/specs/markers.ts).
- Indented code blocks are not excluded by the comment scanner: its indentation handling recognizes containers and fences, but it ultimately scans other lines for comments. Inline code spans are matched within a single line, so spans wrapping across lines are not excluded. These are scanner boundaries, not a claim of full CommonMark parsing.

The previously reported quadratic search for distinct unmatched backtick runs has been addressed. [scan-comments.ts](../../src/parser/scan-comments.ts) links each run to the next run of equal length instead of searching the rest of the line for each opener. The [scaling test](../../tests/specs/scaling.ts) exercises 2,048 distinct run lengths. This resolves that specific reported search pattern, not a proof that every scanner path is linear.

Re-evaluate a parser dependency if full Markdown or HTML semantics become a requirement, or if representative current benchmarks show that an alternative meets the offset and throughput requirements with acceptable complexity. Re-measure on the current implementation before making a performance decision.

## Historical evaluation from PR #13

These measurements were recorded during [PR #13](https://github.com/privatenumber/comment-mark/pull/13) on an Apple M2 Max with Node 24.14.1 using `mitata`. They are historical means, not measurements of the current scanner. The original experimental inputs and harness are not available in this repository, so the figures cannot be independently reproduced from these tables alone. The [current benchmark suite](../../bench/) provides a starting point for a new comparison, not the original harness.

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

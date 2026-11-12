# comment-mark

Design decisions for comment-mark, with the evidence behind them and the known gaps.

Start with [related tools](./related-tools.md) for how comment-mark compares with markdown-magic, doctoc, mdeval, and the parsers it was measured against.

## Document model

- [Markers and selectors](./markers-and-selectors.md): why a marker is a matched comment pair, outermost-pair parsing, the selector grammar, attribute rewriting, and the v2 migration hazard.
- [Comment scanning](./comment-scanning.md): the in-house scanner, the Markdown rules it must follow to keep code examples literal, its supported limits and known gaps, and the parsers it was measured against.

## Updates

- [Replacements](./replacements.md): which markers each value kind claims, why claims are validated before any resolver runs, sequential async resolvers, and update objects.
- [Content layout](./content-padding.md): how the marker's position decides the layout, the render matrix behind that rule, structure validation, the line ending, list and blockquote continuation, and the rejected alternatives.
- [File inclusion](./file-inclusion.md): the design of the files plugin and how other file-inclusion tools compare.

## Interfaces and tooling

- [CLI](./cli.md): marker names that collide with CLI controls, selector flag parsing, missing-selector exits, and open CLI issues.
- [Packaging and runtime](./packaging-and-runtime.md): the ESM-only build and `require(esm)`, the supported Node floor versus the development runtime, agent skills, and releases.
- [Testing and benchmarks](./testing-and-benchmarks.md): how the suite is organized, what scaling tests can and cannot show, and how to read benchmark results.

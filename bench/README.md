# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times `getCommentMarkAll` and `commentMark` against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping them per fixture. `commentMark` is timed with a static value and with a function value, so the resolver path is measured separately. Each fixture's replacement uses that fixture's own selector, so the replacement benchmarks match a marker instead of exercising the unmatched-selector path. A separate group compares a first-match update with a positional-array update, both parsing fresh and reusing a parsed document. It also sweeps marker count, unterminated comments, unmatched closers, and distinct backtick runs to show scaling.

Before timing, the harness counts each fixture's markers with `getCommentMarkAll`, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!-- results -->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-20.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkAll - prose only` | 29.49 µs | 28.49 µs | 33.28 µs |
| `commentMark - prose only` | 28.90 µs | 28.94 µs | 29.33 µs |
| `commentMark resolver - prose only` | 28.97 µs | 28.96 µs | 29.60 µs |
| `getCommentMarkAll - sparse markers` | 6.60 ms | 6.65 ms | 7.09 ms |
| `commentMark - sparse markers` | 6.59 ms | 6.66 ms | 6.82 ms |
| `commentMark resolver - sparse markers` | 6.62 ms | 6.66 ms | 8.16 ms |
| `getCommentMarkAll - dense markers` | 29.13 ms | 31.06 ms | 40.65 ms |
| `commentMark - dense markers` | 4.33 ms | 4.20 ms | 8.10 ms |
| `commentMark resolver - dense markers` | 4.32 ms | 4.29 ms | 8.07 ms |
| `getCommentMarkAll - ordinary comments` | 28.57 ms | 28.85 ms | 29.12 ms |
| `commentMark - ordinary comments` | 28.47 ms | 28.66 ms | 29.08 ms |
| `commentMark resolver - ordinary comments` | 28.41 ms | 28.55 ms | 28.78 ms |
| `getCommentMarkAll - code fences` | 2.85 ms | 2.50 ms | 8.41 ms |
| `commentMark - code fences` | 825.64 µs | 775.04 µs | 3.99 ms |
| `commentMark resolver - code fences` | 769.77 µs | 729.46 µs | 4.08 ms |
| `getCommentMarkAll - long attribute` | 10.47 µs | 10.96 µs | 11.16 µs |
| `commentMark - long attribute` | 19.70 µs | 20.42 µs | 33.93 µs |
| `commentMark resolver - long attribute` | 10.83 µs | 10.90 µs | 11.07 µs |
| `update first match, fresh parse` | 4.42 ms | 4.44 ms | 10.92 ms |
| `update first match, reused document` | 128.21 µs | 120.71 µs | 360.54 µs |
| `update every match, fresh parse` | 6.42 ms | 7.54 ms | 10.62 ms |
| `update every match, reused document` | 2.26 ms | 2.33 ms | 3.86 ms |
| `getCommentMarkAll - markers by count 100` | 238.06 µs | 205.50 µs | 478.92 µs |
| `getCommentMarkAll - markers by count 1000` | 2.41 ms | 2.03 ms | 8.42 ms |
| `getCommentMarkAll - markers by count 10000` | 25.38 ms | 26.29 ms | 29.99 ms |
| `getCommentMarkAll - unterminated comments by count 16` | 2.03 µs | 2.03 µs | 2.95 µs |
| `getCommentMarkAll - unterminated comments by count 256` | 9.47 µs | 9.54 µs | 9.80 µs |
| `getCommentMarkAll - unterminated comments by count 4096` | 128.24 µs | 124.46 µs | 247.71 µs |
| `getCommentMarkAll - unterminated comments by count 65536` | 1.99 ms | 2.03 ms | 2.24 ms |
| `getCommentMarkAll - unmatched closers by count 1000` | 192.85 µs | 159.21 µs | 1.20 ms |
| `getCommentMarkAll - unmatched closers by count 10000` | 1.62 ms | 1.54 ms | 5.30 ms |
| `getCommentMarkAll - distinct backtick runs 16` | 5.78 µs | 6.04 µs | 6.20 µs |
| `getCommentMarkAll - distinct backtick runs 64` | 15.32 µs | 15.46 µs | 15.65 µs |
| `getCommentMarkAll - distinct backtick runs 256` | 112.03 µs | 108.50 µs | 234.00 µs |
<!-- /results -->

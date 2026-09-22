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
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-22.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkAll - prose only` | 26.31 µs | 26.36 µs | 26.40 µs |
| `commentMark - prose only` | 26.40 µs | 26.70 µs | 26.92 µs |
| `commentMark resolver - prose only` | 26.31 µs | 26.31 µs | 26.58 µs |
| `getCommentMarkAll - sparse markers` | 6.34 ms | 6.42 ms | 6.82 ms |
| `commentMark - sparse markers` | 6.27 ms | 6.37 ms | 6.56 ms |
| `commentMark resolver - sparse markers` | 6.29 ms | 6.40 ms | 6.65 ms |
| `getCommentMarkAll - dense markers` | 4.00 ms | 3.62 ms | 7.26 ms |
| `commentMark - dense markers` | 3.83 ms | 3.47 ms | 6.95 ms |
| `commentMark resolver - dense markers` | 6.30 ms | 6.78 ms | 27.23 ms |
| `getCommentMarkAll - ordinary comments` | 28.70 ms | 28.42 ms | 30.07 ms |
| `commentMark - ordinary comments` | 27.49 ms | 27.77 ms | 27.97 ms |
| `commentMark resolver - ordinary comments` | 27.04 ms | 27.26 ms | 27.51 ms |
| `getCommentMarkAll - code fences` | 769.07 µs | 747.83 µs | 3.30 ms |
| `commentMark - code fences` | 766.58 µs | 747.96 µs | 3.54 ms |
| `commentMark resolver - code fences` | 776.43 µs | 762.00 µs | 3.51 ms |
| `getCommentMarkAll - long attribute` | 7.04 µs | 7.24 µs | 7.50 µs |
| `commentMark - long attribute` | 8.95 µs | 9.07 µs | 9.25 µs |
| `commentMark resolver - long attribute` | 9.21 µs | 9.26 µs | 9.38 µs |
| `update first match` | 3.93 ms | 3.48 ms | 7.62 ms |
| `update every match` | 6.07 ms | 7.45 ms | 8.97 ms |
| `getCommentMarkAll - markers by count 100` | 41.37 µs | 42.16 µs | 42.41 µs |
| `getCommentMarkAll - markers by count 1000` | 409.44 µs | 355.63 µs | 3.56 ms |
| `getCommentMarkAll - markers by count 10000` | 4.17 ms | 3.80 ms | 7.17 ms |
| `getCommentMarkAll - unterminated comments by count 16` | 932.29 ns | 945.01 ns | 1.07 µs |
| `getCommentMarkAll - unterminated comments by count 256` | 7.82 µs | 7.87 µs | 7.97 µs |
| `getCommentMarkAll - unterminated comments by count 4096` | 118.71 µs | 117.50 µs | 214.96 µs |
| `getCommentMarkAll - unterminated comments by count 65536` | 1.91 ms | 1.96 ms | 2.15 ms |
| `getCommentMarkAll - unmatched closers by count 1000` | 142.82 µs | 139.08 µs | 320.88 µs |
| `getCommentMarkAll - unmatched closers by count 10000` | 1.36 ms | 1.41 ms | 1.74 ms |
| `getCommentMarkAll - distinct backtick runs 16` | 2.54 µs | 2.66 µs | 2.81 µs |
| `getCommentMarkAll - distinct backtick runs 64` | 11.43 µs | 11.55 µs | 11.61 µs |
| `getCommentMarkAll - distinct backtick runs 256` | 99.48 µs | 97.17 µs | 206.21 µs |
<!-- /results -->

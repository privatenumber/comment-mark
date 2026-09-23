# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times `getCommentMarkAll` against every fixture and `commentMark` against the fixtures that contain markers, grouping the rows per fixture. `commentMark` runs with a static value and with a function value, so the resolver path is measured separately. A separate group compares a first-match update with a positional-array update on the same input, so the rows differ only in the replacement work. It also sweeps marker count, unterminated comments, unmatched closers, and distinct backtick runs to show scaling.

Before timing, the harness counts each fixture's markers with `getCommentMarkAll`, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

`pnpm bench` runs the suite and writes the table between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!-- results -->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-23.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkAll - prose only` | 29.58 µs | 30.48 µs | 30.74 µs |
| `getCommentMarkAll - sparse markers` | 6.97 ms | 7.02 ms | 8.38 ms |
| `commentMark - sparse markers` | 7.15 ms | 7.15 ms | 9.14 ms |
| `commentMark resolver - sparse markers` | 7.51 ms | 7.66 ms | 10.27 ms |
| `getCommentMarkAll - dense markers` | 4.09 ms | 4.27 ms | 7.17 ms |
| `commentMark - dense markers` | 4.35 ms | 4.59 ms | 7.42 ms |
| `commentMark resolver - dense markers` | 4.33 ms | 4.47 ms | 7.95 ms |
| `getCommentMarkAll - ordinary comments` | 32.33 ms | 32.80 ms | 34.04 ms |
| `getCommentMarkAll - code fences` | 1.04 ms | 1.09 ms | 3.39 ms |
| `commentMark - code fences` | 874.86 µs | 898.46 µs | 1.99 ms |
| `commentMark resolver - code fences` | 1.08 ms | 989.42 µs | 5.69 ms |
| `getCommentMarkAll - long attribute` | 17.97 µs | 22.10 µs | 27.50 µs |
| `commentMark - long attribute` | 10.32 µs | 10.64 µs | 10.97 µs |
| `commentMark resolver - long attribute` | 10.76 µs | 11.23 µs | 11.40 µs |
| `update first match` | 4.03 ms | 4.23 ms | 7.36 ms |
| `update every match` | 6.45 ms | 6.84 ms | 10.44 ms |
| `getCommentMarkAll - markers by count 100` | 39.69 µs | 40.18 µs | 42.59 µs |
| `getCommentMarkAll - markers by count 1000` | 399.90 µs | 424.54 µs | 887.13 µs |
| `getCommentMarkAll - markers by count 10000` | 3.93 ms | 3.98 ms | 5.80 ms |
| `getCommentMarkAll - unterminated comments by count 16` | 674.57 ns | 681.67 ns | 998.58 ns |
| `getCommentMarkAll - unterminated comments by count 256` | 8.89 µs | 9.02 µs | 9.76 µs |
| `getCommentMarkAll - unterminated comments by count 4096` | 132.52 µs | 129.83 µs | 272.83 µs |
| `getCommentMarkAll - unterminated comments by count 65536` | 2.14 ms | 2.17 ms | 3.36 ms |
| `getCommentMarkAll - unmatched closers by count 1000` | 159.83 µs | 155.04 µs | 452.50 µs |
| `getCommentMarkAll - unmatched closers by count 10000` | 1.56 ms | 1.57 ms | 2.59 ms |
| `getCommentMarkAll - distinct backtick runs 16` | 2.86 µs | 2.98 µs | 4.76 µs |
| `getCommentMarkAll - distinct backtick runs 64` | 13.29 µs | 14.35 µs | 15.42 µs |
| `getCommentMarkAll - distinct backtick runs 256` | 120.32 µs | 113.63 µs | 379.58 µs |
<!-- /results -->

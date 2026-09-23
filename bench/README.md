# Benchmarks

Micro-benchmarks for the parser.

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times `getCommentMarkAll` against every fixture and `commentMark` against the fixtures that contain markers, grouping the rows per fixture. `commentMark` runs with a static value and with a function value, so the resolver path is measured separately. A separate group compares a first-match update with a positional-array update on the same input, so the rows differ only in the replacement work. It also sweeps marker count, unterminated comments, unmatched closers, and distinct backtick runs to show scaling.

Before timing, the harness counts each fixture's markers with `getCommentMarkAll`, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, and the script runs Node with `--expose-gc` so garbage is collected between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

`pnpm bench` runs the suite and writes the table between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!-- results -->
Measured with `node 24.20.0` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-23.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkAll - prose only` | 30.17 µs | 31.18 µs | 32.12 µs |
| `getCommentMarkAll - sparse markers` | 7.52 ms | 7.48 ms | 12.35 ms |
| `commentMark - sparse markers` | 7.19 ms | 7.36 ms | 8.25 ms |
| `commentMark resolver - sparse markers` | 7.17 ms | 7.27 ms | 10.16 ms |
| `getCommentMarkAll - dense markers` | 8.28 ms | 9.55 ms | 58.19 ms |
| `commentMark - dense markers` | 4.53 ms | 4.81 ms | 6.86 ms |
| `commentMark resolver - dense markers` | 7.13 ms | 7.27 ms | 14.59 ms |
| `getCommentMarkAll - ordinary comments` | 30.20 ms | 30.63 ms | 31.31 ms |
| `getCommentMarkAll - code fences` | 786.95 µs | 803.50 µs | 1.48 ms |
| `commentMark - code fences` | 786.70 µs | 808.88 µs | 1.33 ms |
| `commentMark resolver - code fences` | 979.91 µs | 958.04 µs | 3.18 ms |
| `getCommentMarkAll - long attribute` | 7.48 µs | 7.64 µs | 7.96 µs |
| `commentMark - long attribute` | 9.73 µs | 9.79 µs | 10.26 µs |
| `commentMark resolver - long attribute` | 10.02 µs | 10.04 µs | 10.62 µs |
| `update first match` | 3.88 ms | 4.08 ms | 6.63 ms |
| `update every match` | 7.27 ms | 8.09 ms | 11.92 ms |
| `getCommentMarkAll - markers by count 100` | 40.45 µs | 42.23 µs | 43.03 µs |
| `getCommentMarkAll - markers by count 1000` | 387.13 µs | 410.04 µs | 790.21 µs |
| `getCommentMarkAll - markers by count 10000` | 3.88 ms | 3.99 ms | 5.28 ms |
| `getCommentMarkAll - unterminated comments by count 16` | 652.52 ns | 674.09 ns | 825.76 ns |
| `getCommentMarkAll - unterminated comments by count 256` | 8.35 µs | 8.41 µs | 8.76 µs |
| `getCommentMarkAll - unterminated comments by count 4096` | 134.64 µs | 132.04 µs | 276.50 µs |
| `getCommentMarkAll - unterminated comments by count 65536` | 2.09 ms | 2.13 ms | 2.80 ms |
| `getCommentMarkAll - unmatched closers by count 1000` | 154.98 µs | 152.67 µs | 331.54 µs |
| `getCommentMarkAll - unmatched closers by count 10000` | 4.03 ms | 4.80 ms | 14.83 ms |
| `getCommentMarkAll - distinct backtick runs 16` | 3.90 µs | 4.41 µs | 7.25 µs |
| `getCommentMarkAll - distinct backtick runs 64` | 12.32 µs | 12.40 µs | 12.66 µs |
| `getCommentMarkAll - distinct backtick runs 256` | 109.87 µs | 104.71 µs | 238.08 µs |
<!-- /results -->

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
| `getCommentMarkAll - prose only` | 28.92 µs | 29.54 µs | 29.73 µs |
| `getCommentMarkAll - sparse markers` | 6.84 ms | 6.94 ms | 8.17 ms |
| `commentMark - sparse markers` | 6.97 ms | 6.91 ms | 9.88 ms |
| `commentMark resolver - sparse markers` | 6.69 ms | 6.78 ms | 7.07 ms |
| `getCommentMarkAll - dense markers` | 4.32 ms | 4.15 ms | 7.93 ms |
| `commentMark - dense markers` | 4.05 ms | 3.85 ms | 7.58 ms |
| `commentMark resolver - dense markers` | 4.08 ms | 3.81 ms | 8.38 ms |
| `getCommentMarkAll - ordinary comments` | 28.85 ms | 29.04 ms | 29.54 ms |
| `getCommentMarkAll - code fences` | 848.98 µs | 824.71 µs | 2.92 ms |
| `commentMark - code fences` | 810.53 µs | 804.08 µs | 2.70 ms |
| `commentMark resolver - code fences` | 842.07 µs | 819.42 µs | 2.76 ms |
| `getCommentMarkAll - long attribute` | 7.39 µs | 7.78 µs | 7.95 µs |
| `commentMark - long attribute` | 9.47 µs | 9.50 µs | 9.81 µs |
| `commentMark resolver - long attribute` | 10.43 µs | 10.66 µs | 11.04 µs |
| `update first match` | 3.98 ms | 3.94 ms | 7.94 ms |
| `update every match` | 6.69 ms | 7.77 ms | 11.67 ms |
| `getCommentMarkAll - markers by count 100` | 43.32 µs | 42.72 µs | 44.37 µs |
| `getCommentMarkAll - markers by count 1000` | 408.28 µs | 399.75 µs | 2.49 ms |
| `getCommentMarkAll - markers by count 10000` | 4.19 ms | 4.11 ms | 7.03 ms |
| `getCommentMarkAll - unterminated comments by count 16` | 665.72 ns | 666.06 ns | 1.17 µs |
| `getCommentMarkAll - unterminated comments by count 256` | 8.18 µs | 8.18 µs | 8.31 µs |
| `getCommentMarkAll - unterminated comments by count 4096` | 127.77 µs | 126.04 µs | 234.46 µs |
| `getCommentMarkAll - unterminated comments by count 65536` | 2.04 ms | 2.09 ms | 2.31 ms |
| `getCommentMarkAll - unmatched closers by count 1000` | 148.65 µs | 146.54 µs | 281.71 µs |
| `getCommentMarkAll - unmatched closers by count 10000` | 1.54 ms | 1.58 ms | 2.27 ms |
| `getCommentMarkAll - distinct backtick runs 16` | 2.36 µs | 2.41 µs | 3.58 µs |
| `getCommentMarkAll - distinct backtick runs 64` | 11.67 µs | 11.74 µs | 11.85 µs |
| `getCommentMarkAll - distinct backtick runs 256` | 119.50 µs | 108.17 µs | 423.29 µs |
<!-- /results -->

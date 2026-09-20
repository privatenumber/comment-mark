# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times `getCommentMarks` and `commentMark` against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping them per fixture. `commentMark` is timed with a static value and with a function value, so the resolver path is measured separately. Each fixture's replacement uses that fixture's own selector, so the replacement benchmarks match a marker instead of exercising the unmatched-selector path. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness counts each fixture's markers by running `commentMark` with a resolver that increments a counter and returns `null`, which leaves the fixture unchanged. A fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!-- results -->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-20.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarks - prose only` | 26.92 µs | 26.58 µs | 26.79 µs |
| `commentMark - prose only` | 27.17 µs | 27.37 µs | 27.84 µs |
| `commentMark resolver - prose only` | 27.03 µs | 27.32 µs | 27.41 µs |
| `getCommentMarks - sparse markers` | 6.83 ms | 6.92 ms | 9.69 ms |
| `commentMark - sparse markers` | 6.20 ms | 6.25 ms | 6.39 ms |
| `commentMark resolver - sparse markers` | 6.21 ms | 6.26 ms | 6.45 ms |
| `getCommentMarks - dense markers` | 26.30 ms | 28.74 ms | 31.38 ms |
| `commentMark - dense markers` | 4.09 ms | 4.16 ms | 6.51 ms |
| `commentMark resolver - dense markers` | 4.08 ms | 4.20 ms | 6.63 ms |
| `getCommentMarks - ordinary comments` | 26.68 ms | 26.70 ms | 27.10 ms |
| `commentMark - ordinary comments` | 26.64 ms | 26.74 ms | 26.86 ms |
| `commentMark resolver - ordinary comments` | 26.49 ms | 26.52 ms | 26.70 ms |
| `getCommentMarks - code fences` | 2.55 ms | 2.22 ms | 6.71 ms |
| `commentMark - code fences` | 738.25 µs | 681.21 µs | 3.17 ms |
| `commentMark resolver - code fences` | 739.81 µs | 682.46 µs | 3.18 ms |
| `getCommentMarks - long attribute` | 9.71 µs | 9.86 µs | 10.27 µs |
| `commentMark - long attribute` | 9.60 µs | 9.61 µs | 9.97 µs |
| `commentMark resolver - long attribute` | 9.68 µs | 9.72 µs | 9.78 µs |
| `getCommentMarks - markers by count 100` | 217.48 µs | 183.54 µs | 351.46 µs |
| `getCommentMarks - markers by count 1000` | 2.23 ms | 1.92 ms | 6.93 ms |
| `getCommentMarks - markers by count 10000` | 23.40 ms | 23.42 ms | 25.51 ms |
| `getCommentMarks - unterminated comments by count 16` | 1.71 µs | 1.76 µs | 2.26 µs |
| `getCommentMarks - unterminated comments by count 256` | 8.81 µs | 8.88 µs | 9.16 µs |
| `getCommentMarks - unterminated comments by count 4096` | 118.58 µs | 119.04 µs | 159.58 µs |
| `getCommentMarks - unterminated comments by count 65536` | 1.86 ms | 1.88 ms | 1.98 ms |
| `getCommentMarks - distinct backtick runs 16` | 5.22 µs | 5.34 µs | 5.71 µs |
| `getCommentMarks - distinct backtick runs 64` | 13.88 µs | 13.92 µs | 13.97 µs |
| `getCommentMarks - distinct backtick runs 256` | 100.60 µs | 101.13 µs | 125.29 µs |
<!-- /results -->

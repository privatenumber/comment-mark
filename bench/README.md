# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times the three public APIs against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping the APIs per fixture. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness asserts each fixture's expected marker result, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, each benchmark returns its result so it is not optimized away, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmarks vary by 10-30% between runs, so only investigate a change well beyond that.

<!--comment-mark id="results"-->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-19.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkers - prose only` | 28.00 µs | 28.34 µs | 30.20 µs |
| `getCommentMarks - prose only` | 27.30 µs | 27.43 µs | 29.17 µs |
| `commentMark - prose only` | 28.22 µs | 27.37 µs | 34.48 µs |
| `getCommentMarkers - sparse markers` | 6.78 ms | 6.72 ms | 10.99 ms |
| `getCommentMarks - sparse markers` | 6.55 ms | 6.60 ms | 7.69 ms |
| `commentMark - sparse markers` | 6.43 ms | 6.53 ms | 6.88 ms |
| `getCommentMarkers - dense markers` | 9.91 ms | 10.14 ms | 12.42 ms |
| `getCommentMarks - dense markers` | 11.07 ms | 11.69 ms | 15.07 ms |
| `commentMark - dense markers` | 10.36 ms | 10.53 ms | 12.82 ms |
| `getCommentMarkers - ordinary comments` | 28.25 ms | 29.13 ms | 30.04 ms |
| `getCommentMarks - ordinary comments` | 27.73 ms | 28.59 ms | 29.01 ms |
| `commentMark - ordinary comments` | 28.36 ms | 28.63 ms | 30.92 ms |
| `getCommentMarkers - code fences` | 1.99 ms | 2.09 ms | 5.06 ms |
| `getCommentMarks - code fences` | 1.61 ms | 1.63 ms | 2.99 ms |
| `commentMark - code fences` | 1.74 ms | 1.68 ms | 5.18 ms |
| `getCommentMarkers - long attribute` | 6.26 µs | 6.39 µs | 6.53 µs |
| `getCommentMarks - long attribute` | 8.08 µs | 8.16 µs | 8.38 µs |
| `commentMark - long attribute` | 6.44 µs | 6.56 µs | 7.19 µs |
| `getCommentMarkers - markers by count 100` | 111.46 µs | 105.25 µs | 306.42 µs |
| `getCommentMarkers - markers by count 1000` | 1.05 ms | 1.05 ms | 1.92 ms |
| `getCommentMarkers - markers by count 10000` | 10.09 ms | 10.16 ms | 10.97 ms |
| `getCommentMarkers - unterminated comments by count 16` | 953.95 ns | 965.67 ns | 1.09 µs |
| `getCommentMarkers - unterminated comments by count 256` | 7.98 µs | 8.03 µs | 8.28 µs |
| `getCommentMarkers - unterminated comments by count 4096` | 124.86 µs | 120.38 µs | 261.79 µs |
| `getCommentMarkers - unterminated comments by count 65536` | 2.10 ms | 2.14 ms | 3.20 ms |
| `getCommentMarkers - distinct backtick runs 16` | 3.39 µs | 3.28 µs | 6.34 µs |
| `getCommentMarkers - distinct backtick runs 64` | 11.85 µs | 12.41 µs | 12.67 µs |
| `getCommentMarkers - distinct backtick runs 256` | 96.21 µs | 86.67 µs | 320.63 µs |
<!--/comment-mark-->

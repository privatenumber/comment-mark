# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times the four public APIs (`getCommentMarkers`, `getCommentMarks`, `commentMark`, and `updateCommentMarks`) against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping the APIs per fixture. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness asserts each fixture's expected marker result, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, each benchmark returns its result so it is not optimized away, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmarks vary by 10-30% between runs, so only investigate a change well beyond that.

<!--comment-mark id="results"-->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-19.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkers - prose only` | 26.33 µs | 26.28 µs | 28.00 µs |
| `getCommentMarks - prose only` | 27.81 µs | 29.12 µs | 30.54 µs |
| `commentMark - prose only` | 25.98 µs | 26.03 µs | 26.47 µs |
| `updateCommentMarks - prose only` | 26.19 µs | 25.87 µs | 27.09 µs |
| `getCommentMarkers - sparse markers` | 6.32 ms | 6.36 ms | 6.83 ms |
| `getCommentMarks - sparse markers` | 6.36 ms | 6.37 ms | 7.48 ms |
| `commentMark - sparse markers` | 6.24 ms | 6.30 ms | 6.56 ms |
| `updateCommentMarks - sparse markers` | 6.41 ms | 6.44 ms | 8.40 ms |
| `getCommentMarkers - dense markers` | 9.59 ms | 9.67 ms | 10.95 ms |
| `getCommentMarks - dense markers` | 9.49 ms | 9.58 ms | 10.69 ms |
| `commentMark - dense markers` | 10.24 ms | 10.25 ms | 14.14 ms |
| `updateCommentMarks - dense markers` | 9.72 ms | 9.84 ms | 10.90 ms |
| `getCommentMarkers - ordinary comments` | 26.96 ms | 27.31 ms | 27.79 ms |
| `getCommentMarks - ordinary comments` | 26.84 ms | 26.88 ms | 27.57 ms |
| `commentMark - ordinary comments` | 26.75 ms | 26.80 ms | 27.03 ms |
| `updateCommentMarks - ordinary comments` | 26.98 ms | 27.11 ms | 27.75 ms |
| `getCommentMarkers - code fences` | 1.48 ms | 1.46 ms | 3.15 ms |
| `getCommentMarks - code fences` | 1.40 ms | 1.42 ms | 1.64 ms |
| `commentMark - code fences` | 1.43 ms | 1.44 ms | 1.83 ms |
| `updateCommentMarks - code fences` | 1.47 ms | 1.46 ms | 3.20 ms |
| `getCommentMarkers - long attribute` | 5.90 µs | 5.91 µs | 6.04 µs |
| `getCommentMarks - long attribute` | 7.80 µs | 7.92 µs | 8.04 µs |
| `commentMark - long attribute` | 6.13 µs | 6.23 µs | 6.37 µs |
| `updateCommentMarks - long attribute` | 6.12 µs | 6.20 µs | 6.43 µs |
| `getCommentMarkers - markers by count 100` | 100.31 µs | 100.75 µs | 154.00 µs |
| `getCommentMarkers - markers by count 1000` | 1.00 ms | 1.01 ms | 1.58 ms |
| `getCommentMarkers - markers by count 10000` | 23.02 ms | 21.83 ms | 71.52 ms |
| `getCommentMarkers - unterminated comments by count 16` | 1.24 µs | 1.17 µs | 3.15 µs |
| `getCommentMarkers - unterminated comments by count 256` | 8.18 µs | 8.24 µs | 8.36 µs |
| `getCommentMarkers - unterminated comments by count 4096` | 116.42 µs | 117.46 µs | 141.46 µs |
| `getCommentMarkers - unterminated comments by count 65536` | 1.86 ms | 1.89 ms | 2.04 ms |
| `getCommentMarkers - distinct backtick runs 16` | 2.92 µs | 2.95 µs | 3.07 µs |
| `getCommentMarkers - distinct backtick runs 64` | 10.20 µs | 10.25 µs | 10.31 µs |
| `getCommentMarkers - distinct backtick runs 256` | 79.54 µs | 79.42 µs | 134.96 µs |
<!--/comment-mark-->

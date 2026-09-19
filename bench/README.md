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
Measured with node 24.14.1 on Apple M2 Max (arm64-darwin), 2026-09-19.

| Benchmark | avg | p75 | p99 |
| --- | ---: | ---: | ---: |
| `getCommentMarkers - prose only` | 28.89 µs | 28.14 µs | 30.58 µs |
| `getCommentMarks - prose only` | 27.08 µs | 27.36 µs | 28.43 µs |
| `commentMark - prose only` | 27.61 µs | 28.07 µs | 29.85 µs |
| `getCommentMarkers - sparse markers` | 6.63 ms | 6.68 ms | 8.41 ms |
| `getCommentMarks - sparse markers` | 6.33 ms | 6.44 ms | 6.92 ms |
| `commentMark - sparse markers` | 6.95 ms | 6.95 ms | 10.17 ms |
| `getCommentMarkers - dense markers` | 10.00 ms | 10.14 ms | 11.84 ms |
| `getCommentMarks - dense markers` | 9.86 ms | 10.08 ms | 11.22 ms |
| `commentMark - dense markers` | 9.99 ms | 10.07 ms | 11.34 ms |
| `getCommentMarkers - ordinary comments` | 27.44 ms | 27.78 ms | 28.53 ms |
| `getCommentMarks - ordinary comments` | 28.24 ms | 29.39 ms | 31.02 ms |
| `commentMark - ordinary comments` | 28.72 ms | 29.25 ms | 29.83 ms |
| `getCommentMarkers - code fences` | 1.44 ms | 1.46 ms | 1.88 ms |
| `getCommentMarks - code fences` | 1.87 ms | 1.63 ms | 7.73 ms |
| `commentMark - code fences` | 1.50 ms | 1.53 ms | 2.42 ms |
| `getCommentMarkers - long attribute` | 6.62 µs | 6.67 µs | 7.50 µs |
| `getCommentMarks - long attribute` | 8.08 µs | 8.25 µs | 8.43 µs |
| `commentMark - long attribute` | 6.28 µs | 6.47 µs | 6.70 µs |
| `getCommentMarkers - markers by count 100` | 104.49 µs | 102.88 µs | 217.42 µs |
| `getCommentMarkers - markers by count 1000` | 1.08 ms | 1.10 ms | 1.96 ms |
| `getCommentMarkers - markers by count 10000` | 9.94 ms | 10.08 ms | 11.14 ms |
| `getCommentMarkers - unterminated comments by count 16` | 1.09 µs | 1.06 µs | 2.01 µs |
| `getCommentMarkers - unterminated comments by count 256` | 7.98 µs | 7.98 µs | 8.15 µs |
| `getCommentMarkers - unterminated comments by count 4096` | 117.22 µs | 117.75 µs | 170.88 µs |
| `getCommentMarkers - unterminated comments by count 65536` | 1.97 ms | 2.00 ms | 2.84 ms |
| `getCommentMarkers - distinct backtick runs 16` | 3.22 µs | 3.32 µs | 3.72 µs |
| `getCommentMarkers - distinct backtick runs 64` | 11.09 µs | 11.28 µs | 12.32 µs |
| `getCommentMarkers - distinct backtick runs 256` | 79.44 µs | 79.75 µs | 136.17 µs |
<!--/comment-mark-->

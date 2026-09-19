# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times the three public APIs (`getCommentMarkers`, `getCommentMarks`, and `commentMark`) against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping the APIs per fixture. `commentMark` is timed with a static value and with a function value, so the resolver path is measured separately. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness asserts each fixture's expected marker result, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, each benchmark returns its result so it is not optimized away, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!--comment-mark id="results"-->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-19.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarkers - prose only` | 26.31 µs | 25.80 µs | 29.37 µs |
| `getCommentMarks - prose only` | 26.10 µs | 25.87 µs | 28.17 µs |
| `commentMark - prose only` | 25.52 µs | 25.67 µs | 25.75 µs |
| `commentMark resolver - prose only` | 26.18 µs | 25.72 µs | 29.33 µs |
| `getCommentMarkers - sparse markers` | 6.32 ms | 6.35 ms | 8.28 ms |
| `getCommentMarks - sparse markers` | 6.22 ms | 6.26 ms | 6.88 ms |
| `commentMark - sparse markers` | 6.17 ms | 6.22 ms | 6.47 ms |
| `commentMark resolver - sparse markers` | 6.39 ms | 6.43 ms | 7.91 ms |
| `getCommentMarkers - dense markers` | 9.60 ms | 9.77 ms | 11.48 ms |
| `getCommentMarks - dense markers` | 9.50 ms | 9.63 ms | 10.65 ms |
| `commentMark - dense markers` | 10.24 ms | 10.03 ms | 12.91 ms |
| `commentMark resolver - dense markers` | 9.88 ms | 10.02 ms | 11.48 ms |
| `getCommentMarkers - ordinary comments` | 27.20 ms | 27.31 ms | 28.43 ms |
| `getCommentMarks - ordinary comments` | 26.53 ms | 26.54 ms | 27.43 ms |
| `commentMark - ordinary comments` | 26.70 ms | 26.88 ms | 27.45 ms |
| `commentMark resolver - ordinary comments` | 26.59 ms | 26.73 ms | 27.16 ms |
| `getCommentMarkers - code fences` | 1.43 ms | 1.45 ms | 1.73 ms |
| `getCommentMarks - code fences` | 1.42 ms | 1.44 ms | 1.67 ms |
| `commentMark - code fences` | 1.50 ms | 1.48 ms | 2.95 ms |
| `commentMark resolver - code fences` | 1.49 ms | 1.48 ms | 2.55 ms |
| `getCommentMarkers - long attribute` | 6.00 µs | 6.03 µs | 6.44 µs |
| `getCommentMarks - long attribute` | 7.78 µs | 7.81 µs | 8.04 µs |
| `commentMark - long attribute` | 5.97 µs | 5.99 µs | 6.12 µs |
| `commentMark resolver - long attribute` | 5.98 µs | 6.04 µs | 6.22 µs |
| `getCommentMarkers - markers by count 100` | 100.52 µs | 100.29 µs | 199.75 µs |
| `getCommentMarkers - markers by count 1000` | 988.93 µs | 1.01 ms | 1.26 ms |
| `getCommentMarkers - markers by count 10000` | 10.01 ms | 10.12 ms | 12.42 ms |
| `getCommentMarkers - unterminated comments by count 16` | 931.21 ns | 942.80 ns | 1.03 µs |
| `getCommentMarkers - unterminated comments by count 256` | 7.69 µs | 7.73 µs | 7.84 µs |
| `getCommentMarkers - unterminated comments by count 4096` | 115.50 µs | 116.58 µs | 160.25 µs |
| `getCommentMarkers - unterminated comments by count 65536` | 1.87 ms | 1.88 ms | 2.62 ms |
| `getCommentMarkers - distinct backtick runs 16` | 2.91 µs | 2.94 µs | 3.08 µs |
| `getCommentMarkers - distinct backtick runs 64` | 10.26 µs | 10.36 µs | 10.47 µs |
| `getCommentMarkers - distinct backtick runs 256` | 79.93 µs | 79.04 µs | 177.00 µs |
<!--/comment-mark-->

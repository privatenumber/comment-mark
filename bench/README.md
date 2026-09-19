# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times `getCommentMarks` and `commentMark` against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping them per fixture. `commentMark` is timed with a static value and with a function value, so the resolver path is measured separately. Each fixture's replacement uses that fixture's own marker `id`, so the replacement benchmarks match a key instead of exercising the unmatched-key path. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness counts each fixture's markers by running `commentMark` with a resolver that increments a counter and returns `null`, which leaves the fixture unchanged. A fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

## Recorded results

Refresh the table with `pnpm bench:results`, which runs the same suite and updates the block between the markers. Treat the numbers as a same-machine reference: micro-benchmark results vary between runs, so compare repeated runs in the same environment instead of a single pair.

<!--comment-mark id="results"-->
Measured with `node 24.14.1` on __Apple M2 Max__ (`arm64-darwin`), 2026-09-19.

| Benchmark | avg | p75 | p99 |
| :- | -: | -: | -: |
| `getCommentMarks - prose only` | 26.51 µs | 26.17 µs | 27.49 µs |
| `commentMark - prose only` | 26.58 µs | 26.11 µs | 27.17 µs |
| `commentMark resolver - prose only` | 26.73 µs | 27.22 µs | 28.58 µs |
| `getCommentMarks - sparse markers` | 10.35 ms | 10.52 ms | 10.92 ms |
| `commentMark - sparse markers` | 10.39 ms | 10.53 ms | 11.46 ms |
| `commentMark resolver - sparse markers` | 10.33 ms | 10.52 ms | 11.04 ms |
| `getCommentMarks - dense markers` | 11.15 ms | 11.39 ms | 12.07 ms |
| `commentMark - dense markers` | 11.02 ms | 11.16 ms | 11.90 ms |
| `commentMark resolver - dense markers` | 11.07 ms | 11.11 ms | 13.08 ms |
| `getCommentMarks - ordinary comments` | 44.14 ms | 44.44 ms | 45.98 ms |
| `commentMark - ordinary comments` | 43.93 ms | 44.07 ms | 45.21 ms |
| `commentMark resolver - ordinary comments` | 43.71 ms | 44.21 ms | 44.38 ms |
| `getCommentMarks - code fences` | 1.55 ms | 1.59 ms | 1.94 ms |
| `commentMark - code fences` | 1.52 ms | 1.54 ms | 1.90 ms |
| `commentMark resolver - code fences` | 1.54 ms | 1.56 ms | 2.35 ms |
| `getCommentMarks - long attribute` | 138.99 µs | 140.79 µs | 177.21 µs |
| `commentMark - long attribute` | 141.80 µs | 140.21 µs | 288.25 µs |
| `commentMark resolver - long attribute` | 137.70 µs | 139.54 µs | 171.21 µs |
| `getCommentMarks - markers by count 100` | 112.35 µs | 110.50 µs | 271.79 µs |
| `getCommentMarks - markers by count 1000` | 1.13 ms | 1.15 ms | 1.62 ms |
| `getCommentMarks - markers by count 10000` | 11.52 ms | 11.72 ms | 13.40 ms |
| `getCommentMarks - unterminated comments by count 16` | 1.58 µs | 1.61 µs | 1.78 µs |
| `getCommentMarks - unterminated comments by count 256` | 18.55 µs | 18.48 µs | 18.81 µs |
| `getCommentMarks - unterminated comments by count 4096` | 318.70 µs | 291.79 µs | 952.38 µs |
| `getCommentMarks - unterminated comments by count 65536` | 4.55 ms | 4.60 ms | 4.85 ms |
| `getCommentMarks - distinct backtick runs 16` | 3.65 µs | 3.67 µs | 4.25 µs |
| `getCommentMarks - distinct backtick runs 64` | 18.11 µs | 18.09 µs | 19.58 µs |
| `getCommentMarks - distinct backtick runs 256` | 184.43 µs | 186.33 µs | 281.63 µs |
<!--/comment-mark-->

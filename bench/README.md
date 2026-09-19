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
| `getCommentMarks - prose only` | 28.35 µs | 28.18 µs | 28.85 µs |
| `commentMark - prose only` | 27.50 µs | 26.48 µs | 30.06 µs |
| `commentMark resolver - prose only` | 27.06 µs | 27.56 µs | 27.83 µs |
| `getCommentMarks - sparse markers` | 6.76 ms | 6.84 ms | 9.20 ms |
| `commentMark - sparse markers` | 7.06 ms | 6.92 ms | 9.33 ms |
| `commentMark resolver - sparse markers` | 6.63 ms | 6.66 ms | 9.50 ms |
| `getCommentMarks - dense markers` | 9.40 ms | 9.43 ms | 13.35 ms |
| `commentMark - dense markers` | 10.00 ms | 10.00 ms | 11.83 ms |
| `commentMark resolver - dense markers` | 9.55 ms | 9.78 ms | 10.71 ms |
| `getCommentMarks - ordinary comments` | 27.58 ms | 28.00 ms | 28.66 ms |
| `commentMark - ordinary comments` | 28.13 ms | 28.54 ms | 29.39 ms |
| `commentMark resolver - ordinary comments` | 27.98 ms | 28.36 ms | 28.93 ms |
| `getCommentMarks - code fences` | 1.29 ms | 1.31 ms | 1.80 ms |
| `commentMark - code fences` | 1.30 ms | 1.34 ms | 1.66 ms |
| `commentMark resolver - code fences` | 1.37 ms | 1.41 ms | 1.85 ms |
| `getCommentMarks - long attribute` | 9.38 µs | 9.57 µs | 9.66 µs |
| `commentMark - long attribute` | 9.78 µs | 9.84 µs | 10.11 µs |
| `commentMark resolver - long attribute` | 9.64 µs | 9.69 µs | 10.05 µs |
| `getCommentMarks - markers by count 100` | 105.91 µs | 101.17 µs | 271.46 µs |
| `getCommentMarks - markers by count 1000` | 1.04 ms | 1.05 ms | 1.76 ms |
| `getCommentMarks - markers by count 10000` | 9.72 ms | 9.83 ms | 10.83 ms |
| `getCommentMarks - unterminated comments by count 16` | 981.51 ns | 1.00 µs | 1.23 µs |
| `getCommentMarks - unterminated comments by count 256` | 8.63 µs | 8.74 µs | 8.81 µs |
| `getCommentMarks - unterminated comments by count 4096` | 139.82 µs | 138.33 µs | 376.42 µs |
| `getCommentMarks - unterminated comments by count 65536` | 2.05 ms | 2.11 ms | 2.47 ms |
| `getCommentMarks - distinct backtick runs 16` | 3.33 µs | 3.35 µs | 4.11 µs |
| `getCommentMarks - distinct backtick runs 64` | 12.99 µs | 13.07 µs | 13.25 µs |
| `getCommentMarks - distinct backtick runs 256` | 110.01 µs | 107.67 µs | 226.63 µs |
<!--/comment-mark-->

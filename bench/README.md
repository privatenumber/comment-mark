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
| `getCommentMarks - prose only` | 26.51 µs | 26.93 µs | 27.84 µs |
| `commentMark - prose only` | 26.71 µs | 27.08 µs | 28.78 µs |
| `commentMark resolver - prose only` | 25.91 µs | 26.05 µs | 26.15 µs |
| `getCommentMarks - sparse markers` | 6.76 ms | 6.81 ms | 10.08 ms |
| `commentMark - sparse markers` | 8.93 ms | 6.68 ms | 36.42 ms |
| `commentMark resolver - sparse markers` | 7.67 ms | 8.26 ms | 10.49 ms |
| `getCommentMarks - dense markers` | 10.04 ms | 10.26 ms | 11.99 ms |
| `commentMark - dense markers` | 10.22 ms | 10.41 ms | 12.62 ms |
| `commentMark resolver - dense markers` | 9.96 ms | 9.99 ms | 11.38 ms |
| `getCommentMarks - ordinary comments` | 27.48 ms | 27.25 ms | 29.34 ms |
| `commentMark - ordinary comments` | 27.12 ms | 27.22 ms | 28.11 ms |
| `commentMark resolver - ordinary comments` | 28.85 ms | 29.06 ms | 31.01 ms |
| `getCommentMarks - code fences` | 1.53 ms | 1.55 ms | 2.10 ms |
| `commentMark - code fences` | 1.58 ms | 1.56 ms | 3.25 ms |
| `commentMark resolver - code fences` | 1.56 ms | 1.59 ms | 1.98 ms |
| `getCommentMarks - long attribute` | 8.56 µs | 8.62 µs | 8.77 µs |
| `commentMark - long attribute` | 9.16 µs | 9.31 µs | 9.81 µs |
| `commentMark resolver - long attribute` | 8.69 µs | 8.86 µs | 8.96 µs |
| `getCommentMarks - markers by count 100` | 106.89 µs | 106.21 µs | 245.96 µs |
| `getCommentMarks - markers by count 1000` | 1.02 ms | 1.05 ms | 1.51 ms |
| `getCommentMarks - markers by count 10000` | 10.08 ms | 10.21 ms | 10.80 ms |
| `getCommentMarks - unterminated comments by count 16` | 905.77 ns | 917.39 ns | 971.16 ns |
| `getCommentMarks - unterminated comments by count 256` | 7.82 µs | 7.88 µs | 7.94 µs |
| `getCommentMarks - unterminated comments by count 4096` | 119.43 µs | 119.08 µs | 179.04 µs |
| `getCommentMarks - unterminated comments by count 65536` | 1.87 ms | 1.90 ms | 2.01 ms |
| `getCommentMarks - distinct backtick runs 16` | 3.05 µs | 3.12 µs | 3.23 µs |
| `getCommentMarks - distinct backtick runs 64` | 11.92 µs | 12.05 µs | 12.10 µs |
| `getCommentMarks - distinct backtick runs 256` | 101.59 µs | 101.21 µs | 195.58 µs |
<!--/comment-mark-->

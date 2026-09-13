# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script times all three public APIs against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Fixtures are built outside the timed loops, each benchmark returns its result so it is not optimized away, and the `pnpm bench` script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Each row is a different input; only compare rows that share one.

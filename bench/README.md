# Benchmarks

Micro-benchmarks for the parser, run with [mitata](https://github.com/evanwashere/mitata).

```sh
pnpm bench
```

The script imports the built package, and `pnpm bench` builds first so timings reflect the published output. It times the three public APIs against prose-only, sparse-marker, dense-marker, ordinary-comment, code-fence, and long-attribute documents, grouping the APIs per fixture. It also sweeps marker count, unterminated comments, and distinct backtick runs to show scaling.

Before timing, the harness asserts each fixture's expected marker result, so a fixture that stops exercising the intended path fails instead of producing misleading numbers. Fixtures are built outside the timed loops, each benchmark returns its result so it is not optimized away, and the script runs Node with `--expose-gc` so mitata can collect garbage between iterations.

Compare runs made on the same machine with the same Node version. Only compare rows within the same summary group, which share one input.

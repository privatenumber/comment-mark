# Tests and benchmarks

Tests are grouped by behavior, while benchmark rows compare specific operations on shared inputs. Timing checks are regression alarms, not proofs of asymptotic complexity. This note describes `d41c4a5`, checked on 2026-11-08.

## Test organization

[PR #23](https://github.com/privatenumber/comment-mark/pull/23) split the large suite into behavior-oriented specs. [tests/index.ts](../../tests/index.ts) uses a synchronous root `describe` callback with unawaited dynamic imports. The installed `manten` version is 2.0.2. Its [versioned README](https://github.com/privatenumber/manten/blob/v2.0.2/README.md#splitting-tests-across-files) documents importing spec files inside `describe` for nested groups and running each file independently; its example uses unawaited imports in an async callback. It also says awaiting a group waits for children, but does not establish that an awaited root group is a completion boundary for imports that have not registered their tests yet. Verify that lifecycle before adding root cleanup or relying on group completion.

The split exposed three test-quality issues. A claimed CRLF-preservation test did not actually leave any CRLF in its expected result; the corrected case keeps lines around the replacement. A duplicate attribute-update scenario was removed. A resolver-order test was added with keys supplied in reverse document order, so it discriminates document order from object-key order. [PR #23](https://github.com/privatenumber/comment-mark/pull/23) records these changes; the current order contract is in [resolvers.ts](../../tests/specs/resolvers.ts).

## Scaling checks

[tests/specs/scaling.ts](../../tests/specs/scaling.ts) builds adversarial fixtures before timing, checks exact parsed results, and places elapsed-time budgets on the backtick and unmatched-closer cases. These finite, machine-dependent thresholds catch large regressions; a passing time at one input size does not prove linear complexity. Synchronous CPU work also cannot be preempted by a JavaScript test timeout while it blocks the event loop. The scanner's backtick history and its evidence belong in [comment scanning](./comment-scanning.md).

## Benchmark interpretation

`pnpm bench` builds first and benchmarks the built package. Before timing, [the harness](../../bench/index.ts) asserts fixture marker counts and selected content. It runs mitata with `throw: true` and writes results only after the benchmark run succeeds. [The result writer](../../bench/results.ts) rejects rows without statistics before updating the table. Fixtures are constructed outside timed loops, and the command runs Node with `--expose-gc` ([benchmark README](../../bench/README.md)). This is a local reference and diff aid, not a CI gate ([PR #17](https://github.com/privatenumber/comment-mark/pull/17)).

Compare rows only within the same summary group, where the input is shared, and compare runs on the same machine and Node version. A static update and an index-guarded resolver both change the first match, but the resolver is invoked for every match, so the rows compare the full mechanisms rather than identical callback counts. Repeated runs are more useful than a single pair.

The checked-in [benchmark table](../../bench/README.md) is a historical snapshot from 2026-09-23 on Node `24.20.0`, Apple M2 Max, `arm64-darwin`. It is not a measurement of the current implementation or a performance guarantee. Re-run the suite in the target environment when evaluating a change.

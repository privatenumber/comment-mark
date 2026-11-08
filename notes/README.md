# Engineering research notes

Tracked maintainer references for the decisions and contracts that shape comment-mark. These notes are not published: the package ships only `dist` and `skills` (`files` in [`package.json`](../package.json)).

## Ownership

The comment-mark folder owns project policy, design decisions, and their evidence. Upstream behavior that a decision depends on, such as the CommonMark HTML block rules or another tool's source, is cited inline beside the decision.

## Index

| Folder | Owns |
| --- | --- |
| [comment-mark/](./comment-mark/README.md) | Design decisions, measured comparisons, and known limitations |

## Evidence

Cite upstream facts beside the claim using primary sources, preferably pinned releases or commits. Ground project behavior in repository source or tests, and label decisions with their rationale. Distinguish documented and observed behavior from inference. Keep executable contracts in the test suite.

## Maintenance

When upstream evidence or project behavior changes, update the affected note and the tests it links to.

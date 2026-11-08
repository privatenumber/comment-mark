# Engineering research notes

Tracked maintainer references for the decisions and contracts that shape comment-mark. These notes are not published: the `files` allowlist in [`package.json`](../package.json) includes only `dist` and `skills`, and npm adds only the manifest, README, and license on top of it.

## Ownership

Each upstream folder owns that tool's behavior at the audited version: its implementation, semantics, and limits. The comment-mark folder owns project policy, design decisions, and cross-tool comparison, and links to the upstream notes for evidence. Notes link to each other instead of repeating a claim.

## Index

| Folder | Owns |
| --- | --- |
| [comment-mark/](./comment-mark/README.md) | Design decisions, known gaps, and the [related tools](./comment-mark/related-tools.md) overview |
| [markdown-magic/](./markdown-magic/README.md) | The `FILE` transform, block replacement layout, and the comment block parser |
| [vitepress/](./vitepress/README.md) | The `@include` directive |
| [htmlparser2/](./htmlparser2/README.md) | Comment tokenizing |
| [parse5/](./parse5/README.md) | Comment tokenizing and its HTML-spec semantics |
| [micromark/](./micromark/README.md) | Inline and block HTML comment rules in CommonMark |
| [fast-xml-parser/](./fast-xml-parser/README.md) | Literal comment-terminator search |

## Evidence

Cite upstream facts beside the claim using primary sources, pinned to a release or commit with line anchors. Ground project behavior in repository source or tests, and label decisions with their rationale. Distinguish documented, observed, and inferred behavior. Keep executable contracts in the test suite.

## Maintenance

When upstream evidence or project behavior changes, update the affected note and the tests it links to. Re-verify an upstream note against a newer version before reusing its claims.

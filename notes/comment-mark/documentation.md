# Documentation layout

Decision: the [README](../../README.md) is a short showcase for people who find the project, and the reference documentation lives in [`docs/`](../../docs). Before this split the README was 462 lines. Its opening paragraphs and feature list explained the tool, but they were followed by every CLI flag rule, every replacement rule, and the marker grammar, so the README read as reference documentation rather than an introduction.

## What goes where

- **README:** the problem, one before-and-after example, one short example per capability, the safety guarantees, install, and links to the docs. Each example must produce the output it shows when run against the built package.
- **[`docs/cli.md`](../../docs/cli.md):** CLI usage, update and read modes, exit codes, and argument validation.
- **[`docs/node.md`](../../docs/node.md):** `commentMark`, `getCommentMark`, `getCommentMarkAll`, and the files plugin.
- **[`docs/markers.md`](../../docs/markers.md):** the marker syntax, which comments count as markers, nesting, content layout, markers in code examples, a comparison with HTML and XML, and the selector syntax. The CLI and the API both use selectors, so this file owns the grammar and the other two link to it instead of repeating it.

The split follows the maintainer's convention for their packages: the README explains the tool briefly with short runnable examples and links to the details, and has no badges or license section. No sibling package had plain `docs/*.md` files to copy when this was decided (Thu Nov 12): cleye, manten, fs-fixture, pkgroll, and get-tsconfig have no `docs/` directory on their default branches, and tsx uses a VitePress site.

## Links and publishing

The README links to the docs with relative paths, such as `./docs/cli.md`. The [package manifest](../../package.json) `files` list publishes only `dist` and `skills`, so `docs/` is not in the npm tarball. The README links assume that npm readers can follow them to GitHub; see the evidence gap below.

Rejected: absolute links to the `master` branch, which is the release branch. The repository's default branch is `develop` (`gh api repos/privatenumber/comment-mark --jq .default_branch`), and `docs/` reaches `master` only with the next release, so absolute `master` links would return 404 on GitHub until then.

Evidence gap: how npmjs.com resolves relative README links was not observed. A `curl` of the cleye package page, whose README links to `./docs/arguments.md`, returned a 5.6 KB bot-challenge page without README content. If npmjs.com resolves relative links against the default branch, npm readers see the `develop` docs, which can describe unreleased changes. Check the published package page after the next release. If the links are broken or misleading there, switch the README to absolute links pinned to a release tag.

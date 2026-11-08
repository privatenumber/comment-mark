# micromark HTML comments

Markdown context changes comment recognition. The inline HTML tokenizer in [2.0.3](https://unpkg.com/micromark-core-commonmark@2.0.3/lib/html-text.js) and [2.0.4](https://unpkg.com/micromark-core-commonmark@2.0.4/lib/html-text.js) uses `comment`, `commentClose`, and `commentEnd` states. It accepts `<!-->` and `<!--->`, does not close on `--!>`, and rejects an unfinished inline comment at EOF. The audited states have the same behavior in both versions.

The flow HTML tokenizer in [2.0.3](https://unpkg.com/micromark-core-commonmark@2.0.3/lib/html-flow.js) and [2.0.4](https://unpkg.com/micromark-core-commonmark@2.0.4/lib/html-flow.js) can continue an unclosed comment to EOF. After a closer, `continuationClose` consumes the remainder of the line, so the HTML flow token's end is not necessarily the comment's end. Container boundaries can also stop continuation. The continuation helper was extracted in 2.0.4, so the cited behavior should not be taken as a claim that every container edge case is unchanged.

## Relevance to comment-mark

The [scanner decision](../comment-mark/comment-scanning.md) requires both code awareness and exact marker boundaries. A Markdown parser can provide context, but flow-token boundaries alone do not locate the closer. Its `--!>` treatment differs from [comment-mark's writer](../comment-mark/markers-and-selectors.md).

As a related integration example, [mdeval 2.0.0](https://github.com/privatenumber/mdeval/blob/v2.0.0/src/parse-markdown.ts#L1-L110) collects micromark code ranges and separately scans original source for markers.

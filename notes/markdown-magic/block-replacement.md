# Block replacement

At the audited revision, the block transformer chooses indentation from existing content when available, otherwise from the matched block. It disables indentation for a single-line replacement of an originally single-line block. For multiline blocks it adds missing leading and trailing line breaks under the conditions shown in the source. If a single-line block receives multiline content, it wraps that content in line breaks. The transformer then applies `indentString` before joining the opening and closing tags. [Source](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-transformer/src/index.js#L257-L289).

At a separate revision, markdown-autodocs imports markdown-magic and invokes it for code-block and JSON table categories using its configured marker word. [Import](https://github.com/dineshsonachalam/markdown-autodocs/blob/068d9d071aa4ac245d5fbe1a7b8a39df65637c99/utils/app.js#L1-L4), [calls](https://github.com/dineshsonachalam/markdown-autodocs/blob/068d9d071aa4ac245d5fbe1a7b8a39df65637c99/utils/app.js#L71-L87). This establishes delegation, not that the two projects use the same markdown-magic revision.

**Relevance to comment-mark:** [Content padding](../comment-mark/content-padding.md) compares line placement and container handling with this transformer.

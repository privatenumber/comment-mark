# htmlparser2 comment tokenization

The HTML tokenizer's malformed-comment behavior changed between 10.0.0 and 12.0.0. The latter is the version considered in PR #13. Both versions accept the short empty forms `<!-->` and `<!--->`. In [10.0.0](https://unpkg.com/htmlparser2@10.0.0/dist/esm/Tokenizer.js), the comment and CDATA paths share a three-character sequence matcher. It accepts `-->` but not `--!>`. At EOF it emits a nonempty unfinished comment with trailing offset zero, but emits nothing for the exact input `<!--`.

In [12.0.0](https://github.com/fb55/htmlparser2/blob/v12.0.0/src/Tokenizer.ts), the matcher also accepts `--!>` in HTML mode. EOF handling emits a comment even for `<!--`, and may use a nonzero trailing offset. Both versions use a `charCodeAt` loop in `fastForwardTo`, not `String#indexOf`. The tokenizer reports positions and a trailing delimiter offset to its callback; check the parser's interpretation before using them as source ranges.

Version 10.0.0 recognizes `script`, `style`, `title`, `textarea`, and `xmp` as special tags. Version 12.0.0 additionally handles `iframe`, `noembed`, `noframes`, and `plaintext`, subject to HTML mode and foreign-context handling. See the sequence tables and special-tag states in the linked tokenizer sources. These are HTML contexts, not Markdown code contexts.

## Relevance to comment-mark

[comment-mark's scanner decision](../comment-mark/comment-scanning.md) requires Markdown-aware code exclusions. HTML tokenization alone does not supply them. The version change also matters to [marker delimiter handling](../comment-mark/markers-and-selectors.md), which accepts `--!>`.

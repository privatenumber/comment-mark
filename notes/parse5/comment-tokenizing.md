# parse5 comment tokenization

The [7.3.0](https://unpkg.com/parse5@7.3.0/dist/tokenizer/index.js) and [8.1.1](https://unpkg.com/parse5@8.1.1/dist/tokenizer/index.js) tokenizers have explicit comment states. The comment-start states accept `<!-->` and `<!--->`; the comment-end-bang state closes `--!>`; EOF in a comment emits the comment. No change to those behaviors was found in the audited versions. PR #13 measured 8.0.1, between these versions.

Comment data is not necessarily a literal source slice. The tokenizer replaces NUL with U+FFFD, and the [8.1.1 preprocessor](https://unpkg.com/parse5@8.1.1/dist/tokenizer/preprocessor.js) converts CR and CRLF to LF, as does [7.3.0](https://unpkg.com/parse5@7.3.0/dist/tokenizer/preprocessor.js). Use source locations and the original input when exact bytes or offsets matter.

The bare tokenizer starts in DATA and invokes its start-tag handler without automatically selecting a raw-text mode. The SAX parser's [8.1.1 feedback simulator](https://github.com/inikulin/parse5/blob/v8.1.1/packages/parse5-sax-parser/lib/parser-feedback-simulator.ts) changes modes for tags such as `script`, `style`, and `textarea`; [7.3.0](https://github.com/inikulin/parse5/blob/v7.3.0/packages/parse5-sax-parser/lib/parser-feedback-simulator.ts) also performs this adjustment. A caller using the bare tokenizer must provide appropriate feedback rather than assuming HTML tree-construction behavior.

## Relevance to comment-mark

The [scanner comparison](../comment-mark/comment-scanning.md) records the historical tokenizer measurement. Decoded data and parser feedback are integration concerns, and HTML modes do not replace Markdown code protection. See also [marker delimiters](../comment-mark/markers-and-selectors.md) for `--!>`.

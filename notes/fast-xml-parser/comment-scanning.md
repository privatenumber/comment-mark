# fast-xml-parser comment scanning

At [commit 976470f](https://github.com/NaturalIntelligence/fast-xml-parser/blob/976470f6100eac10304d80507bbd76fb739ba7f5/src/xmlparser/OrderedObjParser.js#L386-L400), the comment branch searches for `-->` with `findClosingIndex`. The [helper](https://github.com/NaturalIntelligence/fast-xml-parser/blob/976470f6100eac10304d80507bbd76fb739ba7f5/src/xmlparser/OrderedObjParser.js#L743-L750) uses `indexOf` and throws if no closer exists. This is XML-oriented behavior, not HTML's malformed-comment recovery.

The parser [normalizes CR and CRLF before scanning](https://github.com/NaturalIntelligence/fast-xml-parser/blob/976470f6100eac10304d80507bbd76fb739ba7f5/src/xmlparser/OrderedObjParser.js#L311-L320). Its internal scan indexes therefore refer to normalized input. With `captureMetaData`, the parser tracks CRLF positions and converts some element indexes back to original input; the comment branch does not attach such indexes to comment nodes. Do not assume all exposed metadata is normalized.

## Relevance to comment-mark

The [scanner decision](../comment-mark/comment-scanning.md) needs source boundaries and Markdown-aware exclusions. A strict XML comment search and normalized internal indexes do not directly supply those boundaries. See [marker delimiters](../comment-mark/markers-and-selectors.md) for the project's `--!>` handling.

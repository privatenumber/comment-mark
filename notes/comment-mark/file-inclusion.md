# File inclusion

The `files` plugin fills paired `file` markers from local UTF-8 files. It shipped in [PR #30](https://github.com/privatenumber/comment-mark/pull/30). The caller must supply `baseDirectory`, and each marker names a file with its `path` attribute. A caller can also configure the tag name. See the [implementation](../../src/plugins/files.ts) and [plugin tests](../../tests/specs/files-plugin.ts).

```md
<!-- file path="./example.txt" -->cached content<!-- /file -->
```

The plugin resolves paths against the supplied directory, not the document containing the marker. It reads the whole file without selecting lines or regions or stripping frontmatter. It does not recursively process included text, so recursive include cycle detection is not needed for this design. A balanced marker pair in the included file remains content of the outer marker on later parses, under the [outermost-pair rule](./markers-and-selectors.md#outermost-pairs). An unmatched opener with the same tag name, such as `<!-- file path="..." -->`, would take the outer marker's closer, because closers pair by tag name. An unmatched opener with another name, such as a complete `<!-- note -->` comment, is ordinary text and changes nothing. Other syntax that hides the closer, such as an unfinished `<!-- note` or an unclosed code fence, would make the next run find no marker. Since [#43](https://github.com/privatenumber/comment-mark/pull/43), such an update is rejected with `[comment-mark] Replacement for "..." would change the document's markers`, and nothing is written; see [structure validation](./content-padding.md#structure-validation). Included files must still close every comment and fence they open, or the update fails. Missing `path` attributes and file read failures reject with an error naming the marker; read failures retain the original error as their cause. See the [nested content and error tests](../../tests/specs/files-plugin.ts) and the [outermost marker policy](../../src/parser/parse-document.ts).

This design keeps the source location explicit for API callers and avoids recursive expansion. Content layout is covered separately in [content layout](./content-padding.md).

## Prior art

The following comparisons describe the cited revisions, not necessarily current releases. Sources were checked on 2026-11-08.

| Tool | Directive and selection | Path and expansion |
| --- | --- | --- |
| [VitePress](../vitepress/include.md) | A recursive include system with selection and Markdown-specific processing. | See the linked audit. |
| [markdown-magic `FILE`](../markdown-magic/file-transform.md) | A file transform with optional Markdown formatting. | See the linked audit. |
| [embedme](https://github.com/zakhenry/embedme/blob/3cd8692de2c905cf3c9cbc6d87c1b4220f2e6eeb/src/embedme.lib.ts#L5-L28) | Embeds files in code fences; its accepted range syntax is `#L10-L20`. | [Uses a configured source root or the input file's directory.](https://github.com/zakhenry/embedme/blob/3cd8692de2c905cf3c9cbc6d87c1b4220f2e6eeb/src/embedme.lib.ts#L289-L310) |
| [embedmd](https://github.com/campoy/embedmd/blob/d497bcd9818fee20b6bdf07d9a863382a7059ae9/README.md#L21-L57) | Uses a Markdown reference directive and optional regular expressions to select content. | Supports local paths and HTTP URLs. |
| [mdembed](https://github.com/croaky/mdembed/blob/3b2e2056dc2ee0f3a0e217fa3d0d518fba6528a1/README.md#L21-L67) | Uses `embed` fences and supports named blocks and globs. | Its example includes Markdown recursively. |

## Options not adopted

- **Line ranges and named regions:** Consider them if users need stable excerpts rather than whole files. Line ranges require a rule for out-of-bounds ranges and edits that move lines; named regions require a marker grammar and missing-region behavior. The comparison above provides examples of both.
- **Frontmatter stripping:** Consider an explicit option if included Markdown commonly needs it. See the [VitePress selection rules](../vitepress/include.md).
- **Resolution relative to the containing file:** Consider it if a file-based caller can provide the document path reliably. The current API receives a string and an explicit base directory, so it cannot infer that location.
- **Recursive inclusion:** Consider it only if nested expansion becomes a requirement. It would need a defined cycle policy and tests for repeated sibling includes, unlike the current one-pass design.

Project behavior was checked against commit `0b06496` on 2026-11-08.

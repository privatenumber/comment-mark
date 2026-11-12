# FILE transform

At the audited revision, `FILE` resolves a local `src` relative to the directory of the referencing `srcPath` and reads it as UTF-8. On read failure it normally throws an error naming the resolved path, referencing file, and `src` attribute. The example path `./path/to/file` is an exception: it returns the existing block content instead. [Source](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/core/src/transforms/file.js#L10-L35).

The transform removes leading blank lines and trailing whitespace. For `.md`, `.markdown`, `.mdown`, and `.mdx`, it calls `formatMd`. The `textBefore` and `textAfter` options wrap the resulting content. [Source](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/core/src/transforms/file.js#L38-L54).

By default, `formatMd` strips frontmatter unless `trimFrontmatter` is `false`. It supports section names and heading levels, optional `removeLeadingH1` or `stripFirstH1`, and `shiftHeaders`. [Source](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/core/src/utils/format-md.js#L4-L66).

**Relevance to comment-mark:** [File inclusion](../comment-mark/file-inclusion.md) uses an explicit base directory and whole-file content rather than this transform's formatting options.

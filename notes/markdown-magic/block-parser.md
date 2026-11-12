# Block parser

At the audited repository revision, the package identifies itself as [`comment-block-parser@1.6.4`](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-parser/package.json#L1-L5). Its generated paired-block patterns combine open and close patterns with lazy `[\s\S]*?` matching, including in [custom-pattern mode](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-parser/src/index.js#L212-L220), [pattern mode](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-parser/src/index.js#L777-L805), and [literal-word mode](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-parser/src/index.js#L818-L829).

The parser checks tag balance and then [executes the block regex on the original input](https://github.com/DavidWells/markdown-magic/blob/f6cd8c042c835176a893decfe42f33223c91704b/packages/block-parser/src/index.js#L273-L301). Inspection of the full parser source and a search of its source directory for `fence`, `backtick`, triple backticks, and triple tildes found no fence handling in this parsing path. A run of the published package confirms that a paired example inside a fenced code block is returned as a block. Observed on 2026-11-08 with Node 26.13.0, in an empty directory after `npm i comment-block-parser@1.6.4`:

````sh
node -e '
const { parseBlocks } = require("comment-block-parser")
const md = "Example:\n\n```md\n<!-- docs TOC -->\nexample\n<!-- /docs -->\n```\n\n<!-- docs TOC -->\nreal\n<!-- /docs -->\n"
const { blocks } = parseBlocks(md, { open: "docs", close: "/docs" })
console.log(JSON.stringify(blocks.map(b => ({ content: b.content.value, lines: b.lines }))))
'
````

```text
[{"content":"example","lines":[4,6]},{"content":"real","lines":[9,11]}]
```

The block on lines 4 to 6 is the fenced example.

**Relevance to comment-mark:** [Comment scanning](../comment-mark/comment-scanning.md) excludes fenced examples rather than matching markers solely by their comment text.

# GitHub oracle

A local stand-in for GitHub's Markdown rendering, used to check which HTML comments [the scanner](./comment-scanning.md) should report. It renders with cmark-gfm 0.29.0.gfm.13 and GitHub's extensions, then parses the HTML with parse5 as a browser would. A comment is a comment node that parse5 builds from a real `<!--` and `-->` in the output.

It is not in the test suite because it needs a C build. The [micromark differential spec](./comment-scanning.md#micromark-differential-spec) is the CI check. Verified on macOS with CMake 4.4.3, Apple clang, Node 26.13.0, and parse5 8.1.1 on 2026-11-13.

## Build

Run in an empty directory outside the repository. CMake 4 needs `-DCMAKE_POLICY_VERSION_MINIMUM=3.5` because cmark-gfm 0.29.0.gfm.13 declares an older minimum.

```sh
curl -fsSL https://github.com/github/cmark-gfm/archive/refs/tags/0.29.0.gfm.13.tar.gz | tar xz
cd cmark-gfm-0.29.0.gfm.13
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build build -j 8
# Save batch.c (below) in the parent directory first.
cc ../batch.c -I src -I build/src -I extensions -I build/extensions \
  build/extensions/libcmark-gfm-extensions.a build/src/libcmark-gfm.a -o ../batch
cd ..
npm init -y && npm pkg set type=module && npm install parse5@8.1.1
```

Check: `printf '<!-- a -->\0x <title>' | ./batch | tr '\0' '|'` prints `<!-- a -->`, a line feed, then `|<p>x &lt;title></p>`. The escaped `<title>` shows that the tagfilter extension is active.

## Scripts

Save each file beside `batch`.

`batch.c` renders NUL-separated documents from stdin, so one process renders thousands of documents:

```c
// Renders NUL-separated Markdown documents from stdin with GitHub's
// extensions and writes NUL-separated HTML to stdout.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "cmark-gfm.h"
#include "cmark-gfm-core-extensions.h"

static const char *extensions[] = {"table", "strikethrough", "autolink", "tagfilter", "tasklist"};

int main(void) {
  cmark_gfm_core_extensions_ensure_registered();
  size_t cap = 1 << 20, len = 0;
  char *buf = malloc(cap);
  int c;
  for (;;) {
    c = getchar();
    if (c == EOF || c == 0) {
      if (c == EOF && len == 0) break;
      cmark_parser *parser = cmark_parser_new(CMARK_OPT_UNSAFE);
      for (size_t i = 0; i < sizeof extensions / sizeof *extensions; i++) {
        cmark_parser_attach_syntax_extension(parser, cmark_find_syntax_extension(extensions[i]));
      }
      cmark_parser_feed(parser, buf, len);
      cmark_node *doc = cmark_parser_finish(parser);
      char *html = cmark_render_html(doc, CMARK_OPT_UNSAFE, cmark_parser_get_syntax_extensions(parser));
      fputs(html, stdout);
      putchar(0);
      free(html);
      cmark_node_free(doc);
      cmark_parser_free(parser);
      len = 0;
      if (c == EOF) break;
      continue;
    }
    if (len + 1 >= cap) buf = realloc(buf, cap *= 2);
    buf[len++] = (char)c;
  }
  fflush(stdout);
  return 0;
}
```

`oracle.mjs` runs the binary and reads the output:

```js
// GitHub-like oracle: cmark-gfm 0.29.0.gfm.13 with GitHub's extensions renders
// each document, then parse5 parses the HTML as a browser would. A comment is
// whatever the HTML parser ends up treating as a comment node.
import { execFileSync } from 'node:child_process'
import { parseFragment } from 'parse5'

const batch = new URL('batch', import.meta.url).pathname

export const render = docs => execFileSync(batch, {
    input: docs.join('\0'),
    maxBuffer: 2 ** 30
}).toString('utf8').split('\0').slice(0, docs.length)

const walk = (node, visit) => {
    visit(node)
    for (const child of node.childNodes ?? []) { walk(child, visit) }
    if (node.content) { walk(node.content, visit) }
}

export const commentsOf = (html) => {
    const comments = []
    walk(parseFragment(html), (node) => {
        if (node.nodeName === '#comment') { comments.push(node.data) }
    })
    return comments
}

export const textOf = (html) => {
    let text = ''
    walk(parseFragment(html), (node) => {
        if (node.nodeName === '#text') { text += node.value }
    })
    return text
}

export const githubComments = docs => render(docs).map(commentsOf)
```

`compare.mjs` compares a scanner with the oracle. Pass the path of a checkout's `src/parser/scan-comments.ts`. Set `SHOW=n` to print the n shortest mismatching documents.

```js
// Compares a scanner's comments with the GitHub-like oracle on generated
// documents. Usage: node compare.mjs <scan-comments.ts> <count> <seed> [fragment set]
import { parseFragment } from 'parse5'
import { render } from './oracle.mjs'

const { scanComments } = await import(process.argv[2])
const count = Number(process.argv[3])
let seed = Number(process.argv[4])
const random = (limit) => {
    seed = (seed * 48_271) % 2_147_483_647
    return seed % limit
}

export const fragmentSets = {
    autolink: ['x <!-- a -->', 'x <!-- /a -->', '<!--', '-->', '<', '>', '`', ' ', '\n', 'http', 'a', 'ab', ':', '@', '.', '-', 'b.c', 'x@', 'a.b-c', '<a@b.c>', '<http://x>', '<mailto:', '\\', '_', '+', 'a'.repeat(31), 'a'.repeat(63), '<a', '"', '=', '<!X', '<?', '<http://`', '<a`b@c.d>', '`', '``', '<ab:`>', '<a`@b>'],
    rich: ['x <!-- a -->', 'x <!-- /a -->', '<!-- a -->', '<!--', '-->', '<!-->', '<!--->', ' --->', '\n', '\n', '\n\n', ' ', 'text', '`', '``', '\n```\n', '\n~~~\n', '\n    ', '  ', '> ', '- ', '1. ', '2. ', '| - |', '|', '# ', '\n===\n', '\n---\n', '\n***\n', '\\', '<div>', '\n<div>\n', '<span>', '\n<span>\n', '<pre>', '</pre>', '<?x', '?>', '<!X', '>', '<a title="', '">', '\t', '[x]: ', '&lt;']
}
const fragments = fragmentSets[process.argv[5] ?? 'rich']

// A comment that spans chunks also holds the markup and escaped text that the
// renderer generates between them, so tags and entities are dropped on both sides.
const normalize = text => text
    .replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    .replaceAll(/<\/?[a-z][a-z\d]*\/?/gi, '')
    .replaceAll(/[\s>]+/g, '')

// Comment nodes the HTML parser builds from a real `<!--` in the output.
const oracleComments = (html) => {
    const comments = []
    const walk = (node) => {
        const location = node.sourceCodeLocation
        if (node.nodeName === '#comment' && html.startsWith('<!--', location.startOffset) && html.slice(location.endOffset - 3, location.endOffset) === '-->') {
            comments.push(node.data)
        }
        for (const child of node.childNodes ?? []) { walk(child) }
        if (node.content) { walk(node.content) }
    }
    walk(parseFragment(html, { sourceCodeLocationInfo: true }))
    return comments.map(normalize).filter(text => text !== '' && text !== '-').map(text => text.slice(-3))
}

const scannerComments = (document) => {
    const comments = []
    scanComments(document, (start, innerStart, innerEnd) => {
        comments.push(document.slice(innerStart, innerEnd))
    })
    return comments.map(normalize).filter(text => text !== '' && text !== '-').map(text => text.slice(-3))
}

const docs = []
for (let i = 0; i < count; i += 1) {
    let document = ''
    const length = 2 + random(14)
    for (let j = 0; j < length; j += 1) { document += fragments[random(fragments.length)] }
    docs.push(document)
}

const failures = []
const htmls = render(docs)
let errors = 0
for (const [index, document] of docs.entries()) {
    let actual
    try {
        actual = scannerComments(document)
    } catch (error) {
        errors += 1
        failures.push([document, `THROWS ${error.message}`])
        continue
    }
    const expected = oracleComments(htmls[index])
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push([document, JSON.stringify({
            actual,
            expected
        })])
    }
}
console.log({
    count,
    bad: failures.length,
    errors
})
failures.sort((a, b) => a[0].length - b[0].length)
for (const [document, detail] of failures.slice(0, Number(process.env.SHOW ?? 25))) {
    console.log(JSON.stringify(document))
    console.log('   ', detail.slice(0, 300))
}
```

`show.mjs` prints the rendered HTML and the scanner's comments for given documents. Run it as `SCANNER=<path to scan-comments.ts> node show.mjs -- '<JSON array of documents>'`.

```js
import { render } from './oracle.mjs'

const docs = JSON.parse(process.argv.at(-1))
const { scanComments } = await import(process.env.SCANNER)
for (const [i, html] of render(docs).entries()) {
    console.log('DOC', JSON.stringify(docs[i]))
    console.log(html)
    const out = []
    scanComments(docs[i], (s, a, b) => out.push(JSON.stringify(docs[i].slice(s, b + 3))))
    console.log('SCANNER', out.join(' | '))
}
```

`validate.mjs` checks the oracle itself against GitHub's `/markdown` API with the `gh` CLI. It compares visible text, which shows whether comments were removed in the same places. Each document is one API request, so keep the count small.

```js
// Compares the oracle's visible text with GitHub's rendering for generated
// documents. Usage: node validate.mjs <count> <seed>
import { execFileSync } from 'node:child_process'
import { render, textOf } from './oracle.mjs'

const count = Number(process.argv[2])
let seed = Number(process.argv[3])
const random = (limit) => {
    seed = (seed * 48_271) % 2_147_483_647
    return seed % limit
}
const fragments = ['x <!-- a -->', 'x <!-- /a -->', '<!--', '-->', '<!-->', '<!--->', ' --->', '\n', '\n', '\n\n', ' ', 'text', '`', '``', '\n```\n', '\n    ', '> ', '- ', '1. ', '| - |', '|', '# ', '\n===\n', '\n***\n', '\\', '<div>', '\n<div>\n', '<span>', '\n<span>\n', '<pre>', '</pre>', '<?x', '?>', '<!X', '>', '<a title="', '">', '\t', 'w']
const normalize = text => text.replaceAll(/\s+/g, '')
let bad = 0
for (let i = 0; i < count; i += 1) {
    let document = ''
    const length = 3 + random(14)
    for (let j = 0; j < length; j += 1) { document += fragments[random(fragments.length)] }
    const github = execFileSync('gh', ['api', '-X', 'POST', '/markdown', '-f', 'mode=gfm', '-f', `text=${document}`]).toString()
    const [oracle] = render([document])
    const a = normalize(textOf(github))
    const b = normalize(textOf(oracle))
    if (a !== b) {
        bad += 1
        console.log(JSON.stringify(document))
        console.log('  github:', JSON.stringify(a))
        console.log('  oracle:', JSON.stringify(b))
    }
}
console.log({
    count,
    bad
})
```

## Results

Run `node compare.mjs <scan-comments.ts> 20000 <seed> [rich|autolink]`. The results for the current scanner are in [comment scanning](./comment-scanning.md#github-oracle).

The comparison normalizes both sides: it decodes entities, drops tag-like sequences and whitespace, and compares the last 3 characters of each comment. A comment that spans chunks also holds markup that the renderer generates, so the full text cannot match. A few mismatches per seed remain as artifacts of this normalization, when generated markup such as `<hr />` or a setext underline falls in those last 3 characters. Use `show.mjs` to confirm each mismatch before treating it as a scanner bug.

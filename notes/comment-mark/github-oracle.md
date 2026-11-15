# GitHub oracle

A local stand-in for GitHub's Markdown rendering, used to check which HTML comments [the scanner](./comment-scanning.md) should report. It renders with cmark-gfm 0.29.0.gfm.13, `--github-pre-lang`, and GitHub's extensions, then parses the HTML with parse5 with scripting disabled, as GitHub parses it. A comment is a comment node that parse5 builds from a real `<!--` and `-->` in the output.

The oracle is wrong inside SVG and MathML, where GitHub matched none of the four parsers compared [below](#github-probes). There, [GitHub's own API](#github-probes) is the authority, and the probes below are the evidence.

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

Check: `printf '<!-- a -->\0x <title>' | ./batch --github-pre-lang | tr '\0' '|'` prints `<!-- a -->`, a line feed, then `|<p>x &lt;title></p>`. The escaped `<title>` shows that the tagfilter extension is active. `printf '```js\nx\n```\n' | ./batch --github-pre-lang` prints `<pre lang="js"><code>x`, a line feed, and `</code></pre>`.

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

int main(int argc, char **argv) {
  if (argc != 2 || strcmp(argv[1], "--github-pre-lang") != 0) {
    fputs("Expected --github-pre-lang\n", stderr);
    return 1;
  }
  int options = CMARK_OPT_UNSAFE | CMARK_OPT_GITHUB_PRE_LANG;
  cmark_gfm_core_extensions_ensure_registered();
  size_t cap = 1 << 20, len = 0;
  char *buf = malloc(cap);
  int c;
  for (;;) {
    c = getchar();
    if (c == EOF || c == 0) {
      if (c == EOF && len == 0) break;
      cmark_parser *parser = cmark_parser_new(options);
      for (size_t i = 0; i < sizeof extensions / sizeof *extensions; i++) {
        cmark_parser_attach_syntax_extension(parser, cmark_find_syntax_extension(extensions[i]));
      }
      cmark_parser_feed(parser, buf, len);
      cmark_node *doc = cmark_parser_finish(parser);
      char *html = cmark_render_html(doc, options, cmark_parser_get_syntax_extensions(parser));
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
// each document, then parse5 parses the HTML as GitHub does, with scripting
// disabled. A comment is
// whatever the HTML parser ends up treating as a comment node.
import { execFileSync } from 'node:child_process'
import { parseFragment } from 'parse5'

const batch = new URL('batch', import.meta.url).pathname

export const render = (docs, options = ['--github-pre-lang']) => execFileSync(batch, options, {
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
    walk(parseFragment(html, { scriptingEnabled: false }), (node) => {
        if (node.nodeName === '#comment') { comments.push(node.data) }
    })
    return comments
}

export const textOf = (html) => {
    let text = ''
    walk(parseFragment(html, { scriptingEnabled: false }), (node) => {
        if (node.nodeName === '#text') { text += node.value }
    })
    return text
}

export const githubComments = docs => render(docs).map(commentsOf)
```

For a JSON array of documents, `p5.mjs` runs the cmark-gfm CLI instead of the batch renderer:

```js
// Usage: node p5.mjs <directory with parse5> <cmark-gfm binary> <documents.json>
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(`${process.argv[2]}/`)
const { parse } = await import(require.resolve('parse5'))
const docs = JSON.parse(readFileSync(process.argv[4], 'utf8'))
const walk = (node, comments) => {
    if (node.nodeName === '#comment') { comments.push(node.data) }
    for (const child of node.childNodes ?? []) { walk(child, comments) }
    if (node.content) { walk(node.content, comments) }
    return comments
}
for (const document of docs) {
    const html = execFileSync(process.argv[3], [
        '-e',
        'table',
        '-e',
        'strikethrough',
        '-e',
        'autolink',
        '-e',
        'tagfilter',
        '-e',
        'tasklist',
        '--unsafe',
        '--github-pre-lang'
    ], { input: document }).toString()
    console.log(JSON.stringify(walk(parse(html, { scriptingEnabled: false }), [])))
}
```

`compare.mjs` compares a scanner with the oracle. Pass the path of a checkout's `src/parser/scan-comments/index.ts`. Set `SHOW=n` to print the n shortest mismatching documents.

```js
// Compares a scanner's comments with the GitHub-like oracle on generated
// documents. Usage: node compare.mjs <scan-comments/index.ts> <count> <seed> [fragment set]
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
    foreign: ['<svg>', '</svg>', '<math>', '<![CDATA[', ']]>', '>', '</p>', '<p>', '- ', '> ', '</ul>', '</li>', '</h1>', '# ', '*', '| a |\n| - |\n| ', '<!-- a -->', '<!-- /a -->', 'x', ' ', '\n', '\n\n', '<div>\n'],
    tables: ['| x |\n| - |\n| ', ' |', String.raw`\|`, '<!-- a -->', '<!-- /a -->', '`', String.raw`[x][r\|s]`, `\n\n${String.raw`[r\|s]: /u`}\n`, ' ', '\n', 'x', '<a title="', '">'],
    refs: ['[', ']', '][', '[]', ']: /u\n', '\n\n[r]: /u\n', '[r]', '[R]', 'r', ' ', '\n', 'x <!-- a -->', 'x <!-- /a -->', '<!--', '-->', '!'],
    links: ['[', '![', ']', '](', ')', '(', '<', '>', '"', "'", ' ', '\n', '`', '\\', 'x <!-- a -->', 'x <!-- /a -->', '<!--', '-->', 'u', '<u>', '"t"', '[x](', '![x](', '[x', '![x', '<!-- a -->', '<!-- /a -->'],
    autolink: ['x <!-- a -->', 'x <!-- /a -->', '<!--', '-->', '<', '>', '`', ' ', '\n', 'http', 'a', 'ab', ':', '@', '.', '-', 'b.c', 'x@', 'a.b-c', '<a@b.c>', '<http://x>', '<mailto:', '\\', '_', '+', 'a'.repeat(31), 'a'.repeat(63), '<a', '"', '=', '<!X', '<?', '<http://`', '<a`b@c.d>', '`', '``', '<ab:`>', '<a`@b>'],
    rich: ['x <!-- a -->', 'x <!-- /a -->', '<!-- a -->', '<!--', '-->', '<!-->', '<!--->', ' --->', '\n', '\n', '\n\n', ' ', 'text', '`', '``', '\n```\n', '\n~~~\n', '\n    ', '  ', '> ', '- ', '1. ', '2. ', '| - |', '|', '# ', '\n===\n', '\n---\n', '\n***\n', '\\', '<div>', '\n<div>\n', '<span>', '\n<span>\n', '<pre>', '</pre>', '<?x', '?>', '<!X', '>', '<a title="', '">', '\t', '[x]: ', '&lt;']
}
const fragments = fragmentSets[process.argv[5] ?? 'rich']

// A comment that spans chunks also holds the markup and escaped text that the
// renderer generates between them, so tags and entities are dropped on both sides.
// Each generated `<!--` has a unique number: `o12q` after a bare `<!--`, and
// `a12` or `/a12` in a marker. The number a comment starts with identifies its
// opening, and the last marker number in it identifies its closing. Without
// one, a comment compares by its first or last 3 characters.
const key = (text) => {
    const opening = text.match(/^(?:o\d+q|\/?a\d+)/)?.[0] ?? text.slice(0, 3)
    const closing = [...text.matchAll(/\/?a\d+/g)].at(-1)?.[0] ?? text.slice(-3)
    return `${opening}|${closing}`
}

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
    walk(parseFragment(html, {
        sourceCodeLocationInfo: true,
        scriptingEnabled: false
    }))
    return comments.map(normalize).filter(text => text !== '' && text !== '-').map(key)
}

const scannerComments = (document) => {
    const comments = []
    scanComments(document, (start, innerStart, innerEnd) => {
        comments.push(document.slice(innerStart, innerEnd))
    })
    return comments.map(normalize).filter(text => text !== '' && text !== '-').map(key)
}

const docs = []
for (let i = 0; i < count; i += 1) {
    let document = ''
    let marker = 0
    const length = 2 + random(14)
    for (let j = 0; j < length; j += 1) {
        const fragment = fragments[random(fragments.length)]
        if (fragment === '<!--') {
            marker += 1
            document += `<!--o${marker}q`
        } else {
            document += fragment
        }
    }
    docs.push(document.replaceAll(/(<!-- \/?a)( -->)/g, (_, open, close) => {
        marker += 1
        return `${open}${marker}${close}`
    }))
}

const failures = []
const htmls = render(docs, ['--github-pre-lang'])
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

`show.mjs` prints the rendered HTML and the scanner's comments for given documents. Run it as `SCANNER=<path to scan-comments/index.ts> node show.mjs -- '<JSON array of documents>'`.

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

`validate.mjs` checks the oracle itself against GitHub's `/markdown` API with the `gh` CLI. GitHub's output has no comment nodes to compare, so it compares visible text: text that one side hides in a comment and the other shows is a difference. Two comments that hide the same text with different boundaries look the same. Each document is one API request, so keep the count small.

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

## Reference label case folding

cmark-gfm matches a reference to its definition after `cmark_utf8proc_case_fold`, which uses the Unicode tables bundled with cmark-gfm 0.29.0.gfm.13. The scanner folds with JavaScript's `toLowerCase().toUpperCase()`, which uses the newer tables of the running Node. The two disagree on 185 scalars. Each of them folds to itself in cmark-gfm, but JavaScript merges it with another scalar, such as dotless `ı` with `I`. [reference-definition.ts](../../src/parser/scan-comments/block/reference-definition.ts) keeps these scalars unfolded.

Measured on 2026-11-14 with Node 26.13.0 (Unicode 17.0). Of the 1,112,064 Unicode scalars, 2,767 change under either fold. The scanner keys a label instead of folding it, so `A` keys as `A` where cmark-gfm folds it to `a`. What must agree is which labels match. After the exceptions, every scalar has the same key as its cmark-gfm fold, so labels that cmark-gfm folds alike match, and no two scalars that cmark-gfm folds apart share a key. Labels that combine each changed scalar with `̇`, `ͅ`, `Σ`, `I`, `ı`, `ß`, or `a` also agree. That is a sample, not proof for every label.

Regenerate the table when Node's `process.versions.unicode` changes. Build `fold-scalars.c` in an empty directory against the [oracle build](#build), and run `compare-folds.mjs` beside it:

```sh
C=<path to cmark-gfm-0.29.0.gfm.13>
cc -I $C/src -I $C/build/src -o fold-scalars fold-scalars.c $C/build/src/libcmark-gfm.a
node compare-folds.mjs
```

It prints the exception count and the exceptions as `[start, end]` ranges in hexadecimal, for the table in `reference-definition.ts`. The other four counts must be 0: exceptions that cmark-gfm folds to another scalar, scalars whose key differs from the key of their cmark-gfm fold, keys shared by scalars that cmark-gfm folds apart, and labels where neighboring scalars change the key.

`fold-scalars.c` prints each scalar and its cmark-gfm fold as hexadecimal UTF-8:

```c
#include <stdio.h>
#include "utf8.h"
#include "buffer.h"

int main(void) {
  cmark_mem *mem = cmark_get_default_mem_allocator();
  cmark_strbuf input = CMARK_BUF_INIT(mem);
  cmark_strbuf output = CMARK_BUF_INIT(mem);
  for (int cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    cmark_strbuf_clear(&input);
    cmark_strbuf_clear(&output);
    if (cp == 0xfffe || cp == 0xffff) {
      unsigned char bytes[] = {0xef, 0xbf, cp == 0xfffe ? 0xbe : 0xbf};
      cmark_strbuf_put(&input, bytes, 3);
    } else cmark_utf8proc_encode_char(cp, &input);
    cmark_utf8proc_case_fold(&output, input.ptr, input.size);
    printf("%x\t", cp);
    for (int i = 0; i < output.size; i++) printf("%02x", output.ptr[i]);
    putchar('\n');
  }
  cmark_strbuf_free(&input);
  cmark_strbuf_free(&output);
}
```

`compare-folds.mjs`:

```js
// Compares cmark-gfm's case fold with JavaScript's toLowerCase().toUpperCase()
// on every Unicode scalar. Run beside a built fold-scalars.
import { spawnSync } from 'node:child_process'

const output = spawnSync('./fold-scalars', {
    encoding: 'utf8',
    maxBuffer: 50_000_000
})
if (output.status !== 0) {
    throw new Error(output.stderr)
}

// cmark-gfm's encoder writes U+FFFE and U+FFFF as the single bytes 0xFE and
// 0xFF (utf8.c:202-207), which do not decode as UTF-8. Each folds to itself.
const folds = new Map()
const changed = []
for (const line of output.stdout.trimEnd().split('\n')) {
    const [point, hex] = line.split('\t')
    const input = String.fromCodePoint(Number.parseInt(point, 16))
    const folded = point === 'fffe' || point === 'ffff' ? input : Buffer.from(hex, 'hex').toString('utf8')
    if (folded !== input) {
        folds.set(input, folded)
    }
    if (folded !== input || input.toLowerCase().toUpperCase() !== input) {
        changed.push(input)
    }
}

const fold = text => Array.from(text, char => folds.get(char) ?? char).join('')
const exceptions = new Set(changed.filter(
    char => fold(char.toLowerCase().toUpperCase()) !== fold(char)
))
console.log('changed', changed.length, 'exceptions', exceptions.size)
console.log('exceptions that cmark folds', [...exceptions].filter(char => fold(char) !== char).length)

const ranges = []
for (const char of exceptions) {
    const code = char.codePointAt(0)
    const previous = ranges.at(-1)
    if (previous && previous[1] + 1 === code) {
        previous[1] = code
    } else {
        ranges.push([code, code])
    }
}
console.log('ranges', JSON.stringify(ranges.map(range => range.map(code => code.toString(16)))))

// The scanner's key: exceptions stay as they are, and the rest is case-mapped.
const key = text => Array.from(text, (char) => {
    if (exceptions.has(char)) {
        return char
    }
    return char.toLowerCase().toUpperCase()
}).join('')

// The key of a whole label, as normalizeLabel computes it: each run between
// exceptions is case-mapped as one string.
const runKey = (text) => {
    let result = ''
    let run = ''
    for (const char of text) {
        if (exceptions.has(char)) {
            result += run.toLowerCase().toUpperCase() + char
            run = ''
        } else {
            run += char
        }
    }
    return result + run.toLowerCase().toUpperCase()
}

// Labels that cmark folds alike must share a key: a scalar and its cmark fold,
// such as `ß` and `ss`, must have the same key.
let mismatches = 0
for (const char of changed) {
    if (key(char) !== runKey(fold(char))) {
        mismatches += 1
    }
}
console.log('mismatches', mismatches)

// Labels that cmark folds apart must have different keys.
const classes = new Map()
let collisions = 0
for (const char of changed) {
    const value = fold(char)
    if (classes.has(key(char)) && classes.get(key(char)) !== value) {
        collisions += 1
    } else {
        classes.set(key(char), value)
    }
}
console.log('collisions', collisions)

// Case mapping can depend on neighbors, such as a final sigma.
let interactions = 0
for (const a of changed) {
    for (const b of ['̇', 'ͅ', 'Σ', 'I', 'ı', 'ß', 'a']) {
        if (runKey(a + b) !== key(a) + key(b) || runKey(b + a) !== key(b) + key(a)) {
            interactions += 1
        }
    }
}
console.log('interactions', interactions)
```

## Entity table

[entities.ts](../../src/parser/scan-comments/entities.ts) holds the decoded byte length of each named entity in cmark-gfm 0.29.0.gfm.13, for the [reference expansion budget](./comment-scanning.md#reference-expansion-budget). Its numeric decoder is also used by generated code-block rendering. Save the script below as `generate-entities.mjs` in the repository root, then run it when the scanner ports a new cmark-gfm tag, from that tag's `src/entities.inc`:

```sh
node generate-entities.mjs <cmark-gfm>/src/entities.inc src/parser/scan-comments/entities.ts
```

The script replaces only the `groups` entries and leaves the numeric decoder and lookup code intact. Pass `--check` after the two paths to verify the current table without writing. Each group stores the decoded byte length and the first decoded byte when that byte is ASCII. The first byte can complete a backslash escape, as `=` does in `\&bne;`. The script fails if the table does not have 2,125 unique entries, if decoding any entity grows it by more than 1 byte, which the budget's fast bound relies on, or if a multi-byte entity decodes to a backslash. The source table itself supplies the decoded bytes; the scanner stores only the metadata it needs.

`generate-entities.mjs`:

```js
// Updates the groups in entities.ts from cmark-gfm's entities.inc.
// Usage: node generate-entities.mjs <entities.inc> <entities.ts> [--check]
import fs from 'node:fs'

const source = fs.readFileSync(process.argv[2], 'utf8')
const entries = [...source.matchAll(/\{\(unsigned char\*\)"([^"]+)", \{([^}]+)\}\}/g)]
const names = new Set(entries.map(([, name]) => name))
if (
    entries.length !== 2125 || names.size !== 2125
) {
    throw new Error('Expected 2125 unique names')
}

// Each entity is stored with its decoded byte length and, if it is ASCII, its
// first decoded byte. Backslash removal after decoding needs that byte, as in
// `\&bne;`, which decodes to `=` and a combining character.
const groups = new Map()
for (const [, name, raw] of entries) {
    const bytes = raw.split(',').map(Number).filter(byte => byte !== 0)
    if (bytes.length > name.length + 3) {
        throw new Error(`Decoding grows ${name} by more than 1 byte`)
    }
    // The scanner tracks a decoded backslash only as a whole entity, `&bsol;`.
    if (bytes.length > 1 && bytes.includes(92)) {
        throw new Error(`${name} decodes to a backslash among other bytes`)
    }
    const key = `${bytes.length}, ${bytes[0] < 128 ? bytes[0] : -1}`
    groups.set(key, [...groups.get(key) ?? [], name])
}

const lines = [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([key, groupNames]) => `\t[${key}, '${groupNames.join(' ')}'],`)

const path = process.argv[3]
const current = fs.readFileSync(path, 'utf8')
const marker = 'const groups: Entity[] = [\n'
const start = current.indexOf(marker)
const end = current.indexOf('\n];', start + marker.length)
if (start === -1 || end === -1 || current.includes(marker, start + marker.length)) {
    throw new Error('Expected one groups section in entities.ts')
}
const updated = current.slice(0, start + marker.length) + lines.join('\n') + current.slice(end)
if (process.argv[4] === '--check') {
    if (updated !== current) {
        throw new Error('The generated groups differ from entities.ts')
    }
} else {
    fs.writeFileSync(path, updated)
}
console.log(`Checked ${entries.length} names and decoded byte metadata; groups ${process.argv[4] === '--check' ? 'match' : 'updated'}`)
```

## Results

Run `node compare.mjs <scan-comments/index.ts> 20000 <seed> [rich|autolink|links|refs|tables|foreign]`. The results for the current scanner are in [comment scanning](./comment-scanning.md#github-oracle).

The comparison numbers each generated marker, such as `<!-- a12 -->`, and each bare `<!--`, such as `<!--o12q`. A comment is identified by the number it starts with, which checks its opening, and the last marker number in it, which checks its closing. Where a comment has no number, as with `<!-->` or a `<!--` built from two fragments, its first or last 3 characters are compared after normalization: entities decoded, and tag-like sequences and whitespace dropped. A comment that spans chunks also holds markup that the renderer generates, so its full text cannot match. A few mismatches per seed remain as artifacts of this normalization, when generated markup such as `<hr />` or a setext underline falls in those last 3 characters. Use `show.mjs` to confirm each mismatch before treating it as a scanner bug.

## GitHub probes

GitHub's [`POST /markdown`](https://docs.github.com/en/rest/markdown/markdown#render-a-markdown-document) API, in `gfm` mode, returns the HTML that GitHub serves. It strips every recognized comment, so the visible text shows how each `<!--` was parsed: a comment disappears, and text appears escaped as `&lt;!--`. Each probe sends one synthetic document:

```sh
jq -n --arg t "$document" '{text:$t,mode:"gfm"}' | gh api markdown --input -
```

Probed on 2026-11-14. In the table, D is `<![CDATA[ > <!-- a -->x<!-- /a --> ]]>`. **In** means GitHub kept D as CDATA text, with the output holding `&gt; &lt;!-- a --&gt;x&lt;!-- /a --&gt;`. **Out** means D was a bogus comment that ends at the first `>`, so the markers rendered as comments, with the output holding ` x ]]&gt;`. The last column says whether [the scanner](./comment-scanning.md#github-html-handling) matches. Tests in `tests/specs/markdown.ts` (`foreign content`) cite these numbers.

| # | Markdown | GitHub | Scanner |
| --- | --- | --- | --- |
| 1 | `<svg>\n\ntext\n\nD` | in | matches |
| 2 | `<svg><span></svg>D` | out | matches |
| 3 | `<svg></span>D` | in | matches |
| 4 | `<svg></p>D` | out | matches |
| 5 | `<svg><br>D` | D dropped, no comments | matches |
| 6 | `<svg><svg></svg>D` | in | matches |
| 7 | `<math><mi>D` | in | matches |
| 8 | `<svg/>D` | out | matches |
| 9 | `<svg><foreignObject><div></svg></div>D` | in | differs |
| 10 | `<select><math>D` | out | matches |
| 11 | `<select></select><svg>D` | in | matches |
| 12 | `<p><svg></p>D` | out | matches |
| 13 | `<SVG>D` | in | matches |
| 14 | `- <svg>\n- D` | out | matches |
| 15 | `> <svg>\n\nD` | out | matches |
| 16 | `<em><svg></em>D` | out | matches |
| 17 | `*<svg>* D` | out | matches |
| 18 | `<svg><desc>D` | in | matches |
| 19 | `<table><tr><td><svg></td></tr></table>D` | out | matches |
| 20 | `<svg>\n</svg>\n\nD` | out | matches |
| 101 | `x <svg>\n\nD` | out | matches |
| 102 | `x <svg><foreignObject>\n\nD` | in | differs |
| 103 | `- <svg>\n\n  para\n\n  D` | in | matches |
| 104 | `<svg>\n\n- D` | in | matches |
| 105 | `- x <svg>\n- D` | out | matches |
| 106 | `<select>\n\n<svg>D` | out | matches |
| 107 | `<div><p><svg></div>D` | out | matches |
| 108 | `<b><svg></b>D` | out | matches |
| 109 | `<table><svg>D` | in | matches |
| 110 | `<svg><table>D` | in | matches |
| 111 | `# <svg>\n\nD` | out | matches |
| 112 | `<svg>\n\n# x\n\nD` | in | matches |
| 113 | `<svg><noscript><!-- a -->x<!-- /a --></noscript> tail` | comments stripped | matches |
| 114 | `<div><span><svg></div>D` | out | matches |

An earlier round of 35 probes on the same day found:

- **Breakout start tags don't leave SVG.** D stays in after `<em>x</em>`, `<p>x</p>`, `<b>x</b>`, `<div>x</div>`, and `<font color="red">` inside `<svg>`, and after Markdown's own `*x*` inside it. The [HTML standard](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign) leaves foreign content at each of these.
- **End tags close SVG.** `<svg><foreignObject></svg>D` and `<div>\n\ntext\n\n<svg>\n</div>\nD` are out. `<svg><foreignObject><p><p></p></foreignObject>D</svg>` is in.
- **Integration points keep CDATA.** `<math><annotation-xml encoding="text/html">D` is in, and so is the encoding `text&#47;html`.
- **Scripting is disabled.** `<noscript><!-- a -->x<!-- /a --></noscript> tail` renders `<p>x tail</p>`, so the content is HTML with comments, not raw text.
- **Comments are stripped everywhere tested,** including inside `<svg>`, `<math>`, and `<select>`.

### Tight-list boundary

On 2026-11-15, GitHub `/markdown` in `gfm` mode rendered these two documents. `VISIBLE` distinguishes the comment boundary even though GitHub strips comments.

| Markdown | GitHub output |
| --- | --- |
| `- <!-- n --><?x\n  VISIBLE <!-- a -->old<!-- /a -->` | `<ul>\n<li>\nold</li>\n</ul>` |
| The same input followed by `\n\n- b` | `<ul>\n<li>\nVISIBLE old<p></p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>` |

The first list is tight, so its paragraph emits no `<p>` and the bogus comment started by `<?x` hides `VISIBLE` and the opening marker. The later item makes the second list loose, so `<p>` ends that bogus comment before `VISIBLE`. cmark-gfm 0.29.0.gfm.13 with `--github-pre-lang` and parse5 give the same boundary. The [public-API tests](../../tests/specs/markdown.ts) also cover definition-only and nested-list children, blockquotes, line endings, buffered events, and the range of a later marker; those variants were checked with the local oracle, not separately on GitHub.

### Task-list checkbox and attribute boundary

On 2026-11-15, `/markdown` in `gfm` mode rendered the following document with each fragment in the table. The later raw `<i>` supplies a literal quote. `BEFORE` and `VISIBLE` make the two marker positions distinguishable even though GitHub strips comments.

```text
<!--><a x="

- FRAGMENT <!-- a -->BEFORE<!-- /a --><i title="v">AFTER</i><!-- a -->VISIBLE<!-- /a -->
```

| `FRAGMENT` | GitHub output |
| --- | --- |
| `[x] item` | `AFTERVISIBLE\n` |
| `[ ] item` | `AFTERVISIBLE\n` |
| `ordinary item` | `AFTERVISIBLE\n` |
| `<input type="checkbox" disabled="" /> item` | ` item BEFORE<i title="v">AFTER</i>VISIBLE\n` |

The cmark-gfm 0.29.0.gfm.13 plus parse5 oracle instead reports both markers for `[x] item`: cmark emits a checkbox containing quotes before `BEFORE`. GitHub's task syntax has the same observable boundary as the ordinary item, while the literal input exposes `BEFORE`. This is consistent with the attribute remaining open until the later `<i>`. The [task-list test](../../tests/specs/markdown.ts) checks all four fragments against this table. The scanner matches because it reports no event for the checkbox.

GitHub `/markdown` also turns task syntax inside a raw HTML list item into checkboxes. On 2026-11-15, this input:

```html
<ul><li>[ ] item</li><li>[x] item</li></ul>
```

produced:

```html
<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox" aria-label="Incomplete task"> item</li><li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox" aria-label="Completed task" checked=""> item</li></ul>
```

The local cmark-gfm 0.29.0.gfm.13 oracle with `--github-pre-lang` and the tasklist extension leaves the raw HTML input unchanged. GitHub's archived [`task_list` v1.0.2 filter](https://github.com/github/task_list/blob/v1.0.2/lib/task_list/filter.rb#L11-L15) says to run it after Markdown and sanitization, and [modifies the parsed document](https://github.com/github/task_list/blob/v1.0.2/lib/task_list/filter.rb#L108-L130). These results support a post-parse task-list pass, but neither the response nor the archived filter proves GitHub's current internal pipeline.

Additional `/markdown` probes on 2026-11-15 distinguish task syntax from a literal input and show that reference resolution matters:

| Markdown | GitHub output |
| --- | --- |
| `- [x] item\n\n[x]: /url` | `<ul>\n<li><a href="/url">x</a> item</li>\n</ul>` |
| The attribute-boundary input above with `[x] item` and a later `[x]: /url` definition | `x item BEFORE<i title="v">AFTER</i>VISIBLE\n` |

For the next five probes, let `W` be `<!-- a -->PRESERVE <![CDATA[ > <!-- a -->old ]]> tail<!-- /a -->`:

| Markdown | GitHub output |
| --- | --- |
| `<select>\n\n- [ ] x <svg>\n\n` followed by `W` | `\n\n[ ] x \n\nPRESERVE  old ]]&gt; tail` |
| `<select>\n\n- <input type="checkbox" disabled="" /> x <svg>\n\n` followed by `W` | `\n\n x \n\nPRESERVE  &gt; &lt;!-- a --&gt;old  tail` |
| `<div>\n<svg><a x="\n\n- [ ] item\n\n` followed by `W` | `<div>\n</div>` |
| `<div>\n<svg><a x="\n\n- ordinary item\n\n` followed by `W` | `<div>\n</div>` |
| `<div>\n<svg><a x="\n\n- <input type="checkbox" disabled="" /> item\n\n` followed by `W` | `<div>\n item\n\nPRESERVE  &gt; &lt;!-- a --&gt;old  tail</div>` |

In the SVG attribute cases, cmark renders the task and literal-input documents identically, but GitHub hides `PRESERVE` only in the task document. These observations rule out treating every task marker as the local oracle's generated checkbox before HTML tokenization. They do not identify GitHub's internal rendering stages.

### Parsers that don't match

No local parser reproduces these results, so none can stand in for GitHub inside SVG and MathML:

- **parse5 8.1.1** leaves SVG at breakout start tags. It also reads CDATA directly at an `annotation-xml` integration point as a bogus comment, and it still has the "in select" insertion mode that the standard removed ([inikulin/parse5#1610](https://github.com/inikulin/parse5/issues/1610)). Its default `scriptingEnabled: true` makes `<noscript>` raw text, so the scripts above turn it off.
- **Nokogiri 1.13.8's HTML5 parser (gumbo)** leaves SVG at `<em>` and `<font color>`.
- **lol-html v3.0.3's tree-builder simulator** leaves foreign content at breakout start tags and reads `<noscript>` as raw text ([`tree_builder_simulator/mod.rs`](https://github.com/cloudflare/lol-html/blob/v3.0.3/src/parser/tree_builder_simulator/mod.rs)).
- **libxml2 2.14.6** (through lxml 6.1.3) reads `<![CDATA[` as a bogus comment everywhere, even in `<svg><text>`.

GitHub's public sources don't name its sanitizer. The [html-pipeline README](https://github.com/gjtorikian/html-pipeline/blob/v3.2.4/README.md) says GitHub no longer uses html-pipeline. Probes 9 and 102 are hard to reconcile with a spec-following tree builder: probe 9 needs `<div>` inside `foreignObject` to be an HTML element, which blocks `</svg>`, while probe 102 needs the paragraph's `<p>` there to stay foreign. One explanation is a streaming stage that decides CDATA before a full parser builds the tree. That is an inference from these two probes, not a documented fact, and a parser not compared here could still explain both.

Rerun these probes when GitHub's rendering changes, or before relying on a parser as a stand-in for SVG and MathML.

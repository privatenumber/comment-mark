# AGENTS.md

## Parsing must not use regular expressions

`src/` contains no regular expressions, and it must stay that way.

The parser reads the source by character index. A pattern carries its own scan position, so sharing one across parses lets an inner parse rewind an outer one, and pattern-based block rules also hide the order the scanner actually reads in. Performance work is not a reason to reintroduce them: if an index-based scan is too slow, make that scan faster.

- Locate line endings with forward-only `indexOf` searches.
- Read numeric grammar, such as ordered list markers, one digit at a time.
- Keep all scan state local to a single parse invocation.

`tests/index.ts` parses the syntax tree of every file under `src/` and fails on a regular expression literal, a `RegExp` construction, or `String#match` / `matchAll` / `search`. Tests may still use regular expressions for assertions.

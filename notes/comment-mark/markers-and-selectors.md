# Markers and selectors

comment-mark identifies a section by a matching pair of named comments and selects it by tag name and optional attributes. It exposes only outermost pairs as markers. Readers return plain marker data, while source offsets remain internal for formatting-preserving edits. This design keeps ordinary comments and balanced marker pairs inside generated content from becoming unintended update targets.

Project behavior was checked against commit [`d41c4a5`](https://github.com/privatenumber/comment-mark/commit/d41c4a580492741fc09a1c8ef1e14b3882f87ed7) on 2026-11-08. For Markdown scanning boundaries and parser alternatives, see [comment scanning](./comment-scanning.md). For replacement targeting, see [replacements](./replacements.md).

## Marker syntax and history

An opening comment becomes a marker only when a later comment closes the same tag name. An unrelated or unmatched comment remains ordinary text; its apparent attributes are not validated. See the [pairing tests](../../tests/specs/markers.ts#L9-L42) and [comment classification](../../src/parser/parse-document.ts#L33-L75).

In v2, markers used `<!-- name:start -->` and `<!-- name:end -->`. The free-form name made a documentation example ending in `:start` a potential active marker and provided no attribute grammar. The closed, unmerged [PR #13](https://github.com/privatenumber/comment-mark/pull/13) proposed the fixed tag `<!--comment-mark id="name"-->` and `<!--/comment-mark-->`. [PR #15](https://github.com/privatenumber/comment-mark/pull/15) instead adopted a caller-defined tag name with attributes, so the name identifies the section and attributes can narrow selection.

The v2-to-v3 migration has a false-negative risk: an entirely unmigrated document reads successfully as zero markers because v2 comments are ordinary text to the new parser. Read mode cannot establish migration completeness. The [migration guide](../../skills/comment-mark/references/migration-v2.md#rewriting-a-tree), introduced in [PR #18](https://github.com/privatenumber/comment-mark/pull/18), recommends also searching for remaining old delimiters and inspecting the results.

## Outermost pairs

Only the outermost balanced pair is exposed. A balanced inner pair remains part of the outer content, is not selectable, and is replaced with that content. This allows generated or included text to contain marker pairs without making the next parse fail or introducing new targets. [PR #32](https://github.com/privatenumber/comment-mark/pull/32) superseded the earlier nested-marker error. Its [tests](../../tests/specs/markers.ts#L44-L115) cover different names, same-name nesting, and `ignores malformed attributes in a nested pair`.

Pairing closes the innermost open marker with the same tag first. The parser scans and pairs before it filters nested pairs and parses their attributes ([implementation](../../src/parser/parse-document.ts#L110-L183)). Consequently, malformed attributes inside a nested pair are not validated. An unmatched same-name opener inside content can consume the intended outer closer and move the section boundary, as the [README warns](../../README.md#what-happens-to-a-marker-inside-another-marker). Since [#43](https://github.com/privatenumber/comment-mark/pull/43), an update whose content would do this is rejected instead; see [structure validation](./content-padding.md#structure-validation). The [comment scanning note](./comment-scanning.md) covers how fences affect scanning.

Escaping inner comments or stripping their wrappers would change included content. The outermost-pair rule instead preserves that content. Reconsider the boundary if recursive marker processing becomes a requirement; it would need explicit nesting and selection semantics. The current rule does not protect against unbalanced same-name openers.

## Selector grammar and reader data

Selectors are a deliberate CSS-style subset: a tag name followed by zero or more attribute-presence or equality predicates. Combinators, selector lists, and unsupported operators throw instead of silently matching nothing. Whitespace before a predicate is rejected because it resembles a CSS descendant combinator. See [`parseSelector`](../../src/parser/parse-selector.ts#L28-L104) and the [selector tests](../../tests/specs/selectors.ts).

The public readers return ordered arrays or a single plain `{ tagName, attributes, content }` object. Source offsets live on internal `MarkerNode` and attribute nodes, not the public data type. See [`src/index.ts`](../../src/index.ts#L40-L56), [`CommentMarkData`](../../src/document.ts#L9-L13), and [`MarkerNode`](../../src/parser/parse-document.ts#L9-L20).

A hybrid array with named marker properties would make the names collide with array members and would not serialize those properties as array entries. This is a checkable reason to prefer plain ordered data, not evidence of a historical rationale. On Node 26.13.0:

```sh
fnm exec --using=26.13.0 node --input-type=module-typescript -e 'const a = []; a.name = "x"; a.map = "marker"; try { a.length = "marker"; } catch (e) { console.log("length:", e.name); } console.log("JSON:", JSON.stringify(a)); console.log("map:", a.map);'
```

```text
length: RangeError
JSON: []
map: marker
```

## Attribute rewriting and open grammar gaps

The writer replaces changed value tokens in place, preserving surrounding whitespace and reusing the original quote when the new value fits. It validates names and values against the reader's grammar before mutation, so it does not write attributes that its own reader rejects. [PR #16](https://github.com/privatenumber/comment-mark/pull/16) introduced the update path. [PR #31](https://github.com/privatenumber/comment-mark/pull/31), commit `e8d45a6`, removed the original quote from validation because writability does not depend on the preferred quote; rendering still reuses it. See [`parse-attributes.ts`](../../src/parser/parse-attributes.ts#L136-L181), [`document.ts`](../../src/document.ts#L103-L175), and the [attribute update tests](../../tests/specs/attribute-updates.ts).

Two boundaries remain open:

- The writer rejects `-->` but accepts `--!>`. The [WHATWG HTML tokenizer's comment end bang state](https://html.spec.whatwg.org/multipage/parsing.html#comment-end-bang-state) emits the comment on `>` with an incorrectly-closed-comment parse error. Thus comment-mark's own round-trip check does not establish the same comment boundary for HTML parsing. The living standard was checked on 2026-11-08. The Node 26.13.0 command below shows the writer's actual output; it does not test a browser.
- The [README](../../README.md#markers) says a tag name starts with a "letter" or `_`, but [`isNameStart`](../../src/parser/characters.ts#L16-L20) accepts only ASCII letters and `_`. Clarify the wording or change the grammar if non-ASCII names become a requirement.

```sh
fnm exec --using=26.13.0 node --input-type=module-typescript -e 'import { commentMark } from "./src/index.ts"; console.log(await commentMark("<!-- a --><!-- /a -->", { a: { attributes: { x: "--!>" } } }));'
```

```text
<!-- a x="--!>" --><!-- /a -->
```

Revisit `--!>` handling when defining HTML interoperability requirements. Rejecting or encoding it would require a documented reader/writer policy; this observation does not decide that policy.

# Replacements and resolvers

`commentMark` resolves every selector against the original document before it applies replacements. Static values target the first match, arrays target positions, and resolvers claim every match. Claims are applied in document order, with each resolver awaited before the next. This makes targeting independent of mutations and gives side effects a predictable order.

Project behavior was checked against commit [`d41c4a5`](https://github.com/privatenumber/comment-mark/commit/d41c4a580492741fc09a1c8ef1e14b3882f87ed7) on 2026-11-08. Line anchors into `src/` point at the code after the stack [#39](https://github.com/privatenumber/comment-mark/pull/39) to [#43](https://github.com/privatenumber/comment-mark/pull/43), which must merge before these notes. For marker selection, see [markers and selectors](./markers-and-selectors.md). For content layout, see [content layout](./content-padding.md).

## Target claims

The [claim collector](../../src/document.ts#L287-L374) resolves all selectors before invoking any resolver. It rejects a static value whose selector has no match, excess array entries, a function inside an array, or two selectors claiming the same marker. This catches stale selectors and conflicts before a callback can produce side effects. An empty array is an explicit no-op. A missing resolver selector is also a no-op because its callback runs once per match and there are none.

- A static string or update object claims the first match.
- An array contains static values and addresses matches by position. A `null` or `undefined` entry consumes a position without claiming or updating it.
- A resolver receives the marker data and its zero-based index among that selector's matches. It claims every match, even if it later returns `undefined`. Another selector cannot claim one of those matches.

[PR #21](https://github.com/privatenumber/comment-mark/pull/21) introduced missing-selector errors for static updates. [PR #26](https://github.com/privatenumber/comment-mark/pull/26) changed resolver values to run for every match and made a missing resolver selector a no-op. Its earlier `(attributes, content)` callback signature and first-match resolver behavior are superseded. [PR #27](https://github.com/privatenumber/comment-mark/pull/27) removed functions inside positional arrays: an index check in a selector-level resolver can compute selectively without a second callback form with different claim rules. See the [resolver targeting tests](../../tests/specs/resolvers.ts#L120-L167).

## Async execution and failure boundaries

`commentMark` always returns a promise; its two readers remain synchronous. [PR #24](https://github.com/privatenumber/comment-mark/pull/24) added async resolvers so a callback can perform I/O based on its own marker. The [implementation](../../src/document.ts#L377-L428) sorts claims by document position and awaits each callback before starting the next; [tests](../../tests/specs/resolvers.ts#L53-L66) cover key-order independence and [sequential completion](../../tests/specs/resolvers.ts#L204-L219).

A sync-until-thenable alternative would expose a string-or-promise return type, separate synchronous and asynchronous error paths, and an ordering transition when the first thenable appears. The uniform promise avoids those complications. This is an analysis of the tradeoff; the public PR records the chosen behavior, not a detailed comparison or a current performance measurement.

Sequential awaits also prevent independent I/O from running concurrently, including independent reads by the [files plugin](./file-inclusion.md). Revisit concurrency if representative workloads show that latency matters and the API can specify side-effect order, conflict handling, and rejection behavior without ambiguity. The cost has not been re-measured publicly here.

An invalid claim fails before any resolver runs. A later resolver rejection causes the promise to reject without returning a partially rendered document, but it does not undo external side effects from earlier resolvers. See [`commentMark`](../../src/index.ts#L21-L76) and the [rejection tests](../../tests/specs/resolvers.ts#L196-L202).

## Update objects

[PR #25](https://github.com/privatenumber/comment-mark/pull/25) accepts a direct `{ attributes?, content? }` update, avoiding a function that only returns an already-known object. A resolver can return the same shape. `attributes` is the complete replacement set, not a merge; spread the existing attributes to preserve them. Omitted or explicitly `undefined` fields preserve that part; `content: ''` clears content and `attributes: {}` removes all attributes. Attribute validation happens before mutation. See [`CommentMarkUpdate`](../../src/document.ts#L14-L17), [attribute replacement](../../src/document.ts#L130-L152), and [update object tests](../../tests/specs/update-objects.ts).

Historically, object content was inserted verbatim while some string content was padded. [PR #33](https://github.com/privatenumber/comment-mark/pull/33) superseded that distinction. [#43](https://github.com/privatenumber/comment-mark/pull/43) replaced that rule with one based on the marker's position, described in [content layout](./content-padding.md).

## Open gap: invalid numeric values

The TypeScript API does not accept numeric replacements or numeric `content`, but JavaScript callers can pass them. On Node 26.13.0 at `d41c4a5`, a static number is silently ignored while an object with numeric `content` writes `5`:

```sh
git checkout d41c4a5
node --input-type=module-typescript -e 'import { commentMark } from "./src/index.ts"; const s = "<!-- a -->old<!-- /a -->"; console.log("static:", await commentMark(s, { a: 5 })); console.log("object:", await commentMark(s, { a: { content: 5 } }));'
```

```text
static: <!-- a -->old<!-- /a -->
object: <!-- a -->5<!-- /a -->
```

Since [#43](https://github.com/privatenumber/comment-mark/pull/43), the result depends on the value and the marker's context, because the writer calls whichever string method it reaches first. Observed at `1e3009d`: `{ content: 5 }` on a top-level marker that starts its line throws `TypeError: content.startsWith is not a function`; `{ content: 0 }` there writes `0`, because the empty-content check is a truthiness test; `{ content: 5 }` on a top-level inline marker, as in `x <!-- a -->old<!-- /a -->`, writes `5`; inside a blockquote, as in `> x <!-- a -->old<!-- /a -->`, it throws `TypeError: content.slice is not a function`. A static number is still ignored. The [replacement path](../../src/document.ts#L419-L450) distinguishes strings from object-like updates but does not validate these runtime types. Whether JavaScript callers should get a rejection or coercion is an open policy question, not a decided contract. Revisit when defining runtime validation for invalid replacement values.

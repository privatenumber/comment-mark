# Markers and selectors

## Markers

A marker is a matching pair of HTML comments. The tag name names the section:

```md
<!-- contributors -->Jane<!-- /contributors -->
```

Attributes are optional and carry metadata for the section. They are written after the tag name:

```md
<!-- contributors role="maintainer" -->Jane<!-- /contributors -->
```

- The closing comment repeats the tag name, so `<!-- TODO -->` stays an ordinary comment until a matching `<!-- /TODO -->` follows.
- Whitespace inside the comments is padding: `<!-- contributors -->` and `<!--contributors-->` are equivalent.
- The content between the comments is replaced; the comment pair stays in the output so later updates can find the section.
- Attributes are caller-defined. comment-mark stores and matches on them; it does not interpret them.

### Compared with HTML and XML tags

Markers are modeled on HTML and XML elements. An opening comment works like a start tag, and a closing comment works like an end tag:

```md
<contributors role="maintainer">Jane</contributors>
<!-- contributors role="maintainer" -->Jane<!-- /contributors -->
```

Wrapping the tags in comments is what hides them when the Markdown is rendered.

Where markers follow HTML and XML:

- Attributes follow the tag name as `name="value"`, separated by whitespace. Values can use double quotes, single quotes, or no quotes, as in HTML.
- Tag names and attribute names are case-sensitive, as in XML. `<!-- a -->` is not closed by `<!-- /A -->`.
- A repeated attribute is an error, as in XML.
- Selectors use the syntax of CSS attribute selectors, such as `contributors[role='maintainer']`.

Where markers differ:

- **Every attribute needs a value.** HTML allows boolean attributes such as `hidden`; a marker rejects them, so write `hidden=""`.
- **Every marker needs a closing comment.** There are no self-closing or void markers. `<!-- a /-->` on its own is an ordinary comment, and it is an error when a later `<!-- /a -->` closes it.
- **Names are limited.** A tag name or attribute name starts with an ASCII letter or `_`, followed by ASCII letters, digits, `_`, or `-`. A comment with a namespaced or dotted tag name, such as `<!-- ns:a -->` or `<!-- a.b -->`, is an ordinary comment. The same characters in an attribute name, as in `ns:k="1"`, are an error.
- **Attribute values are literal text.** Surrounding quotes are removed, HTML entities such as `&amp;` are not decoded, and a value cannot contain `-->`, because that would end the comment.
- **Content is text, not a tree.** Tags and entities between the comments are returned exactly as written. A marker pair nested inside another marker is part of the outer marker's content, not a child marker.
- **Mismatched comments are ordinary comments, not errors.** An opening comment that is never closed, or a closing comment with attributes, is left as an ordinary comment. In `<!-- a --><!-- b -->x<!-- /a -->`, the closing comment ends `a`, and `<!-- b -->` becomes part of its content. XML would reject this document.

## Selectors

A selector is a tag name followed by optional attribute predicates:

| Selector | Matches |
| --- | --- |
| `contributors` | Every marker with that tag name |
| `contributors[role]` | Markers that have a `role` attribute |
| `contributors[role='maintainer']` | Markers whose `role` is `maintainer` |
| `contributors[role='maintainer'][lang='en']` | Markers that satisfy every predicate |

- A tag name on its own is usually enough. Give each section you update from the CLI its own tag name so the flag needs no quoting.
- When several sections share a tag name, a predicate narrows them. Testing that an attribute exists (`contributors[role]`) is simpler than comparing its value.
- Attribute values compare as literal text, so `[role='maintainer']` matches `role=maintainer` however the source quoted it.
- Single quotes, double quotes, and unquoted values all work in a selector.
- Combinators, selector lists, pseudo-classes, and operators other than `=` are rejected instead of quietly matching nothing.

## FAQ

### How does comment-mark tell a marker from an ordinary comment?

A comment is a marker only when a later comment closes the same tag name, as `<!-- contributors -->` is closed by `<!-- /contributors -->`. Every other comment stays ordinary text, so `<!-- TODO -->`, `<!-- TODO: fix this -->`, and `<!-- 1 + 1 -->` are left alone.

### How are code examples ignored?

Fenced code blocks (backtick or tilde, including blockquote prefixes) and single-line inline code spans are skipped, so a marker shown as an example is not treated as real. Indented code blocks and code spans that wrap across lines are not detected, so a marker there is treated as real. A marker inside indented code cannot render as if absent. In a GFM table row, an unmatched backtick in one cell can pair with the opening backtick of a code span in a later cell, so a marker inside that code span is treated as real.

### What happens to a marker inside another marker?

Only the outermost pair is a marker. A balanced pair nested inside another pair stays part of the outer marker's content, so `getCommentMark` and `getCommentMarkAll` do not return it and no selector matches it. Replacing the outer section replaces that content, so a replacement can insert its own marker pairs without adding markers to the document.

Pairing still reads the whole text, so an unbalanced comment inside a section takes part in pairing. An opening comment there that is never closed can consume the section's closing comment, which moves the section boundary on the next run.

### Why does a marker have a tag name and attributes?

The tag name names the section, and attributes describe it. Together they form a selector, so a document can hold several sections of the same kind and each one can be addressed by what distinguishes it. A unique tag name per section is usually simplest, especially for CLI updates; attributes are for when sections of the same kind need to be told apart.

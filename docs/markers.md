# Markers and selectors

A marker is written like an HTML element, with each tag inside an HTML comment. The comments are hidden when the Markdown is rendered:

```md
<contributors role="maintainer">Jane</contributors>
<!-- contributors role="maintainer" -->Jane<!-- /contributors -->
```

The tag name names the section, and the optional attributes describe it. When the section is updated, the content between the comments is replaced and both comments stay, so later updates can find the same section.

## Markers

### Syntax

```md
<!-- contributors role="maintainer" lang=en -->Jane<!-- /contributors -->
```

- **Tag names** start with an ASCII letter or `_`, followed by ASCII letters, digits, `_`, or `-`.
- **Attributes** follow the tag name as `name="value"`. Attribute names follow the same rules as tag names.
	- Values can use double quotes, single quotes, or no quotes.
	- Attributes are separated by whitespace: `a="1"b="2"` is an error.
	- Every attribute needs a value. Write `hidden=""`, not `hidden`.
	- Each attribute can appear once. A repeated name is an error.
- **Attribute values are literal text.** Surrounding quotes are removed, HTML entities such as `&amp;` are not decoded, and a value cannot contain `-->`, because that would end the comment.
- **Attributes are caller-defined.** comment-mark stores and matches them; it does not interpret them.
- **Names are case-sensitive.** `<!-- a -->` is not closed by `<!-- /A -->`.
- **Whitespace inside the comments is padding.** `<!-- contributors -->` and `<!--contributors-->` are equivalent.
- **Content is text.** Tags and entities between the comments are not parsed, so `<b>` and `&amp;` come back as they were written.

### What counts as a marker

A comment is a marker only when a later comment closes the same tag name. Every other comment stays ordinary text and is never an error:

| Comment | Why it is ordinary |
| --- | --- |
| `<!-- TODO -->` | No `<!-- /TODO -->` follows it |
| `<!-- TODO: fix this -->` | The tag name is followed by `:` instead of whitespace or the end of the comment |
| `<!-- 1 + 1 -->` | A tag name cannot start with a digit |
| `<!-- a /-->` | There are no self-closing markers |
| `<!-- ns:a -->`, `<!-- a.b -->` | `:` and `.` are not allowed in tag names |
| `<!-- /a extra -->` | A closing comment holds only the tag name |

A comment that looks like a marker but breaks the attribute rules is an error once a closing comment pairs with it, unless the pair is nested inside another marker. The attributes of a nested pair are not checked. For example, `<!-- a /-->` followed later by `<!-- /a -->` is an error, and so is `<!-- a ns:k="1" -->` with its closing comment.

### Nested markers

Only the outermost pair is a marker. A pair inside another marker is part of the outer marker's content:

```md
<!-- a --><!-- b -->x<!-- /b --><!-- /a -->
```

Here `a` is the only marker, and its content is `<!-- b -->x<!-- /b -->`. `getCommentMark` and `getCommentMarkAll` do not return `b`, and no selector matches it. This means a replacement can contain its own marker pairs without adding markers to the document.

A closing comment closes the nearest open comment with the same tag name, and skips openers in between. In `<!-- a --><!-- b -->x<!-- /a -->`, the closing comment ends `a`, and `<!-- b -->` becomes part of its content.

An unclosed opening comment with the section's own tag name changes the section. In `<!-- a -->outer <!-- a -->inner<!-- /a -->`, the closing comment pairs with the second opener, so the section's content is `inner`. An update whose content would cause this is rejected.

### Content layout

When a section is updated, the position of its opening comment decides whether the content goes on its own lines:

```md
<!-- author -->
**Jane**
<!-- /author -->

Written by <!-- author -->Jane<!-- /author -->.
```

- **At the start of a line,** the content goes on its own lines. comment-mark adds a line break after the opening comment and before the closing comment, on each side that does not already have one.
- **Inside a line,** the content is inserted as given, with no added line breaks.
- **Empty content** stays empty, so clearing a section leaves `<!-- a --><!-- /a -->`.

The rule is the same for CLI values, static values, resolver results, and the files plugin.

The reason is how Markdown renders comments. A line that starts with `<!--` begins an HTML block, and Markdown on that line is not rendered, so `<!-- a -->**Jane**<!-- /a -->` on its own line shows `**Jane**` as literal text. A comment inside a line renders as nothing, so content inserted there usually renders as if the markers were absent. The main exception is content that ends with a line break (see below).

Details:

- **Start of a line** allows up to three columns of indentation after any list or blockquote prefix. With four or more, the line is indented code or continues the paragraph above it, so the marker counts as inside a line.
- **Every marker on a line that starts with a comment** counts as starting its line, including a marker right after another one.
- **Added line breaks match the document.** comment-mark uses the first line break outside the markers' opening comments and content: CRLF, LF, or CR. A document without one gets LF.
- **Lists and blockquotes:** each line break in the content is followed by the container's prefix, so the content and the closing comment stay in the container. This also applies to markers inside a line. A marker on a lazy continuation line, such as unprefixed text that continues a `>` paragraph, is not recognized as inside the blockquote, so its content gets no prefix and can end up outside the quote.
- **In HTML,** added line breaks can be visible, for example inside `<pre>`.
- **Reading a section** returns the added line breaks as part of its content. Running an update again with the same static content, or with a resolver that returns its input, leaves the document unchanged, and the CLI reports `Unchanged`. This needs the selector to still match, so an update should not change an attribute its own selector tests.
- **Inside a line, avoid content that ends with a line break.** The closing comment then starts a line and begins an HTML block, so the rest of that line is not rendered as Markdown.
- **An update that would change the document's markers is rejected.** For example, a fenced code block inside a line would put its closing fence on the same line as the closing comment, so the fence could not close. Give the fence lines of its own, as in `\n```js\nx\n```\n`.

### Markers in code examples

Markers shown as examples in code are skipped, so a document can show marker syntax without updating it.

- **Skipped:** fenced code blocks, with backticks or tildes, including fences inside lists and blockquotes, and inline code spans on one line.
- **Not skipped:** indented code blocks, and inline code spans that wrap across lines. A marker there is treated as real.
- **Not skipped:** in a GFM table row, an unmatched backtick in one cell can pair with the opening backtick of a code span in a later cell. A marker inside that code span is treated as real.

To keep an example literal, put it in a fenced code block. Inline code on one line also works outside tables.

### Compared with HTML and XML

| | HTML | XML | Markers |
| --- | --- | --- | --- |
| Case of names | Insensitive | Sensitive | Sensitive |
| Unquoted attribute values | Allowed | Not allowed | Allowed |
| Attributes without a value, such as `hidden` | Allowed | Not allowed | Not allowed |
| Repeated attribute | First one is used | Error | Error |
| Self-closing tags | Only on SVG and MathML elements | Allowed | Not allowed |
| Entities such as `&amp;` | Decoded | Decoded | Not decoded |
| Nested elements | Form a tree | Form a tree | Part of the outer marker's content |
| Mismatched or unclosed tags | Repaired by the parser | Error | Ordinary comments |

## Selectors

A selector is a tag name followed by optional attribute predicates, as in CSS attribute selectors:

| Selector | Matches |
| --- | --- |
| `contributors` | Every marker with that tag name |
| `contributors[role]` | Markers that have a `role` attribute |
| `contributors[role='maintainer']` | Markers whose `role` is `maintainer` |
| `contributors[role='maintainer'][lang='en']` | Markers that satisfy every predicate |

- **Prefer a unique tag name for each section.** A tag name on its own is the simplest selector, and a CLI flag such as `--contributors=...` needs no quoting.
- **Use predicates when sections share a tag name.** Testing that an attribute exists, as in `contributors[role]`, is simpler than comparing its value.
- **Values compare as literal text.** Single quotes, double quotes, or no quotes work in a selector, and `[role='maintainer']` matches `role=maintainer` however the marker quotes it.
- **Unsupported syntax is an error.** Combinators, selector lists, pseudo-classes, and operators other than `=` are rejected instead of matching nothing.

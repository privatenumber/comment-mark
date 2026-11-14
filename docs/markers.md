# Markers and selectors

A marker is written like an HTML element, with each tag inside an HTML comment. The comments are hidden when the Markdown is rendered:

```md
<contributors role="maintainer">Jane</contributors>
<!-- contributors role="maintainer" -->Jane<!-- /contributors -->
```

The tag name names the section, and the optional attributes describe it. When the section is updated, the content between the comments is replaced and both comments stay, so later updates can find the same section.

## Markers

### Syntax

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

### Content layout

There are two ways to write a marker:

- **Block marker:** the opening comment is the first thing on its line. Write the opening and closing comments each on their own line. Use it for block content, such as a heading, list, table, or code block.
- **Inline marker:** both comments go inside a line of text. Use it for inline content, such as a version, date, or link. The content stays part of the sentence.

```md
<!-- changelog -->
## Changelog
<!-- /changelog -->

Version <!-- version -->2.0<!-- /version --> is out.
```

The wrong form breaks the rendering:

| Content | In an inline marker | In a block marker |
| --- | --- | --- |
| `## Changelog` | Plain text: `See ## Changelog below` | A heading |
| `- one` and `- two` | Plain text `Items: - one`, then a list with only `two` | A list |
| A table | Plain text with the pipes showing | A table |
| `**2.0**` | Bold text inside the sentence | A separate paragraph that splits the sentence |

comment-mark decides by the opening comment alone. When it is the first thing on its line, or follows a comment that begins the line, comment-mark puts the content on its own lines, adding a line break after the opening comment and before the closing comment where one is missing. So `<!-- a --><!-- /a -->` alone on a line also works as a block marker. Otherwise, the content is inserted as given. Empty content stays empty, so clearing a section leaves `<!-- a --><!-- /a -->`. The rule is the same for CLI values, static values, resolver results, and the files plugin.

The line breaks are needed because a line that starts with `<!--` begins an HTML block, and Markdown on that line is not rendered. Without them, `<!-- changelog -->## Changelog<!-- /changelog -->` would show `## Changelog` as literal text.

How the rule applies:

- **First thing on its line** ignores any list or blockquote prefix and up to three columns of indentation, where a tab advances to the next multiple of four. With four or more columns, the line is indented code, where markers are skipped, or it continues the paragraph above it, so the marker is inline. Inside an HTML block, such as the lines after `<div>`, indentation does not matter, because those lines are HTML. A marker after a comment that begins the line, such as `a` in `<!-- note --> text <!-- a -->`, counts as a block marker because the whole line is an HTML block.
- **Added line breaks match the document:** the first line break outside the markers' opening comments and content, CRLF, LF, or CR. A document without one gets LF.
- **In lists and blockquotes,** each line break in the content is followed by the container's prefix, so the content and the closing comment stay in the container. This applies to inline markers too.
- **Reading a section** returns the added line breaks as part of its content. Rerunning an update with the same static content, or with a resolver that returns its input, leaves the document unchanged, and the CLI reports `Unchanged`, as long as the update does not change an attribute that its own selector tests.

Pitfalls:

- **Inline content that ends with a line break.** The closing comment is then the first thing on its line and begins an HTML block, so the rest of that line is not rendered as Markdown. This is the main case where an inline marker does not render as if it were absent.
- **A code block in an inline marker.** If the content ends with the closing fence, the fence shares a line with the closing comment and cannot close, so the update is rejected. Content that ends with a line break after the fence, as in `\n```js\nx\n```\n`, is accepted, but a block marker is simpler. Any update that would change the document's markers is rejected the same way.
- **HTML.** Added line breaks can be visible, for example inside `<pre>`.

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

Once a closing comment pairs with an opening comment, the opening comment's attributes must be valid. For example, `<!-- a /-->` followed later by `<!-- /a -->` is an error, and so is `<!-- a ns:k="1" -->` with its closing comment. The attributes of a pair nested inside another marker are not checked.

### Nested markers

Only the outermost pair is a marker. A pair inside another marker is part of the outer marker's content:

```md
<!-- a --><!-- b -->x<!-- /b --><!-- /a -->
```

Here `a` is the only marker, and its content is `<!-- b -->x<!-- /b -->`. `getCommentMark` and `getCommentMarkAll` do not return `b`, and no selector matches it. This means a replacement can contain its own marker pairs without adding markers to the document.

A closing comment closes the nearest open comment with the same tag name, and skips openers in between. In `<!-- a --><!-- b -->x<!-- /a -->`, the closing comment ends `a`, and `<!-- b -->` becomes part of its content.

An unclosed opening comment with the section's own tag name changes the section. In `<!-- a -->outer <!-- a -->inner<!-- /a -->`, the closing comment pairs with the second opener, so the section's content is `inner`. An update whose content would cause this is rejected.

### Markers in code examples

Markers shown as examples in code are skipped, so a document can show marker syntax without updating it. comment-mark reads a comment as a marker only where GitHub renders it as a comment, so it skips comments in:

- fenced and indented code blocks, including code inside lists and blockquotes
- inline code spans, including spans that wrap across lines and spans in table cells
- escaped text, such as `\<!-- a -->`
- link reference definitions, such as `[x]: <!-- a -->`, which render nothing

A few rare forms are still read differently than GitHub reads them, such as footnotes or a backtick inside a bare URL, `` https://example.com/`a ``.

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

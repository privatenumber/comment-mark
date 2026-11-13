import type { CommentVisitor } from './scan-comments.ts';
import { isAsciiLetter } from './html-tag.ts';
import { createForwardSearch } from './utils/forward-search.ts';

/**
 * The browser phase. The renderer copies raw HTML to its output unchanged, and
 * the browser's HTML tokenizer decides which of it is a comment:
 * https://html.spec.whatwg.org/multipage/parsing.html#tokenization
 *
 * The tokenizer reads raw HTML as a sequence of source segments, one per line
 * of an HTML block or of an inline raw HTML span. Between two segments the
 * browser sees a line feed, and sometimes markup that the renderer generates,
 * such as `</p>` or `<li>`. That markup holds a `>` and no `-->`, so only an
 * open comment, an open quoted attribute value, and raw text carry past it.
 * Without it, as between two HTML blocks, every state carries.
 *
 * Only the states that decide where a comment starts and ends are modeled. A
 * comment that ends at `--!>`, at the end of the input, or abruptly, as in
 * `<!-->`, is not reported, because it cannot hold a marker.
 */

const State = {
	Data: 0,
	Comment: 1,
	BogusComment: 2,
	TagName: 3,
	BeforeAttributeName: 4,
	AttributeName: 5,
	AfterAttributeName: 6,
	BeforeAttributeValue: 7,
	DoubleQuotedValue: 8,
	SingleQuotedValue: 9,
	UnquotedValue: 10,
	AfterQuotedValue: 11,
	// The content of `<noscript>`, which is raw text when scripting is enabled.
	RawText: 12,
} as const;

// GitHub's tagfilter extension writes `<` as `&lt;` before these tag names, so
// the browser reads their contents as ordinary HTML:
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/tagfilter.c
const filteredTagNames = ['title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext'];

const isHtmlWhitespace = (code: number) => (
	code === 32 || code === 9 || code === 10 || code === 12 || code === 13
);

// `cmark_isspace`: space, tab, LF, VT, FF, and CR.
const isCmarkSpace = (code: number) => code === 32 || (code >= 9 && code <= 13);

export type HtmlTokenizer = {

	/**
	 * Tokenizes the source from `start` to `end`, which follows a line feed.
	 * `afterMarkup` is true when markup that the renderer generates also comes
	 * before it. `inHtmlBlock` marks the lines of an HTML block, where a comment
	 * that begins its line starts the line.
	 */
	feed: (
		start: number,
		end: number,
		afterMarkup: boolean,
		continuation: string,
		inHtmlBlock: boolean,
	) => void;
};

export const createHtmlTokenizer = (source: string, visit: CommentVisitor): HtmlTokenizer => {
	const findTagOpen = createForwardSearch(source, '<');
	const findTagClose = createForwardSearch(source, '>');
	const findCommentClose = createForwardSearch(source, '-->');
	const findBangCommentClose = createForwardSearch(source, '--!>');
	const findDoubleQuote = createForwardSearch(source, '"');
	const findSingleQuote = createForwardSearch(source, '\'');
	const findEndTagOpen = createForwardSearch(source, '</');

	let state: number = State.Data;
	let tagNameStart = 0;
	let isEndTag = false;
	let isNoscript = false;
	let commentStart = -1;
	let commentContinuation = '';
	let commentStartsLine = false;

	// The end of the segment being read. Positions from it on read as the line
	// feed that follows the segment.
	let end = 0;
	const peek = (index: number) => (index < end ? source.charCodeAt(index) : 10);

	const isFilteredTag = (index: number) => {
		let nameStart = index + 1;
		if (source.charCodeAt(nameStart) === 47) {
			nameStart += 1;
		}
		for (const name of filteredTagNames) {
			let matches = true;
			for (let offset = 0; offset < name.length; offset += 1) {
				let code = peek(nameStart + offset);
				if (code >= 65 && code <= 90) {
					code += 32;
				}
				if (code !== name.charCodeAt(offset)) {
					matches = false;
					break;
				}
			}
			if (matches) {
				const after = peek(nameStart + name.length);
				return isCmarkSpace(after)
					|| after === 62
					|| (after === 47 && peek(nameStart + name.length + 1) === 62);
			}
		}
		return false;
	};

	const endTagName = (nameEnd: number) => {
		isNoscript = !isEndTag
			&& nameEnd - tagNameStart === 8
			&& source.slice(tagNameStart, nameEnd).toLowerCase() === 'noscript';
	};

	const emitTag = () => {
		state = isNoscript ? State.RawText : State.Data;
	};

	/** Reads data from `index` and returns where reading continues. */
	const readData = (index: number, continuation: string, startsLine: boolean) => {
		const open = findTagOpen(index);
		if (open === -1 || open >= end) {
			return end;
		}

		const next = peek(open + 1);
		if (next === 33) {
			if (peek(open + 2) !== 45 || peek(open + 3) !== 45) {
				// A doctype, CDATA section, or bogus comment. All end at `>`.
				state = State.BogusComment;
				return open + 2;
			}
			if (peek(open + 4) === 62) {
				return open + 5;
			}
			if (peek(open + 4) === 45 && peek(open + 5) === 62) {
				return open + 6;
			}
			state = State.Comment;
			commentStart = open;
			commentContinuation = continuation;
			commentStartsLine = startsLine;
			return open + 4;
		}
		if (next === 63) {
			state = State.BogusComment;
			return open + 2;
		}

		const closing = next === 47;
		const nameStart = closing ? open + 2 : open + 1;
		const first = peek(nameStart);
		if (!isAsciiLetter(first)) {
			if (closing) {
				// `</>` is dropped, and `</` before anything else starts a bogus comment.
				if (first === 62) {
					return open + 3;
				}
				state = State.BogusComment;
				return open + 2;
			}
			return open + 1;
		}
		if (isFilteredTag(open)) {
			return open + 1;
		}
		state = State.TagName;
		isEndTag = closing;
		isNoscript = false;
		tagNameStart = nameStart;
		return nameStart + 1;
	};

	/** Reads one character of a tag at `index`. */
	const readTag = (index: number) => {
		const code = source.charCodeAt(index);
		switch (state) {
			case State.TagName: {
				if (isHtmlWhitespace(code) || code === 47) {
					endTagName(index);
					state = State.BeforeAttributeName;
				} else if (code === 62) {
					endTagName(index);
					emitTag();
				}
				return index + 1;
			}
			case State.BeforeAttributeName: {
				if (code === 62) {
					emitTag();
				} else if (!isHtmlWhitespace(code) && code !== 47) {
					state = State.AttributeName;
				}
				return index + 1;
			}
			// Whitespace after a name waits for `=` or the next attribute's name.
			case State.AttributeName:
			case State.AfterAttributeName: {
				switch (code) {
					case 47: {
						state = State.BeforeAttributeName;
						break;
					}
					case 61: {
						state = State.BeforeAttributeValue;
						break;
					}
					case 62: {
						emitTag();
						break;
					}
					default: {
						state = isHtmlWhitespace(code) ? State.AfterAttributeName : State.AttributeName;
					}
				}
				return index + 1;
			}
			case State.BeforeAttributeValue: {
				switch (code) {
					case 34: {
						state = State.DoubleQuotedValue;
						break;
					}
					case 39: {
						state = State.SingleQuotedValue;
						break;
					}
					case 62: {
						emitTag();
						break;
					}
					default: {
						if (!isHtmlWhitespace(code)) {
							state = State.UnquotedValue;
						}
					}
				}
				return index + 1;
			}
			case State.UnquotedValue: {
				if (isHtmlWhitespace(code)) {
					state = State.BeforeAttributeName;
				} else if (code === 62) {
					emitTag();
				}
				return index + 1;
			}
			default: {
				// After a quoted value, anything but `>` continues the attributes.
				if (code === 62) {
					emitTag();
				} else if (isHtmlWhitespace(code) || code === 47) {
					state = State.BeforeAttributeName;
				} else {
					state = State.AttributeName;
				}
				return index + 1;
			}
		}
	};

	/** Reads from `index` in the current state and returns where reading continues. */
	const read = (index: number, continuation: string, startsLine: boolean) => {
		switch (state) {
			case State.Data: {
				return readData(index, continuation, startsLine);
			}
			case State.Comment: {
				const close = findCommentClose(index);
				const bangClose = findBangCommentClose(index);
				const closes = close !== -1 && close + 3 <= end;
				const bangCloses = bangClose !== -1 && bangClose + 4 <= end;
				if (!closes && !bangCloses) {
					return end;
				}
				state = State.Data;
				if (closes && (!bangCloses || close < bangClose)) {
					visit(commentStart, commentStart + 4, close, commentContinuation, commentStartsLine);
					return close + 3;
				}
				return bangClose + 4;
			}
			case State.BogusComment: {
				const close = findTagClose(index);
				if (close === -1 || close >= end) {
					return end;
				}
				state = State.Data;
				return close + 1;
			}
			case State.DoubleQuotedValue:
			case State.SingleQuotedValue: {
				const quote = state === State.DoubleQuotedValue
					? findDoubleQuote(index)
					: findSingleQuote(index);
				if (quote === -1 || quote >= end) {
					return end;
				}
				state = State.AfterQuotedValue;
				return quote + 1;
			}
			case State.RawText: {
				let open = findEndTagOpen(index);
				while (open !== -1 && open < end) {
					const after = peek(open + 10);
					if (
						open + 10 <= end
						&& source.slice(open + 2, open + 10).toLowerCase() === 'noscript'
						&& (isHtmlWhitespace(after) || after === 47 || after === 62)
					) {
						state = State.TagName;
						isEndTag = true;
						tagNameStart = open + 2;
						return open + 10;
					}
					open = findEndTagOpen(open + 1);
				}
				return end;
			}
			default: {
				return readTag(index);
			}
		}
	};

	/** Moves past the line feed or generated markup that precedes a segment. */
	const separate = (afterMarkup: boolean) => {
		// A line feed ends a tag name, attribute name, or unquoted value.
		switch (state) {
			case State.TagName: {
				endTagName(end);
				state = State.BeforeAttributeName;
				break;
			}
			case State.AttributeName: {
				state = State.AfterAttributeName;
				break;
			}
			case State.UnquotedValue:
			case State.AfterQuotedValue: {
				state = State.BeforeAttributeName;
				break;
			}
			default: {
				// Other states read a line feed as content or as whitespace.
				break;
			}
		}

		// Generated markup ends with `>`, which ends any tag or bogus comment.
		if (
			afterMarkup
			&& state !== State.Data
			&& state !== State.Comment
			&& state !== State.DoubleQuotedValue
			&& state !== State.SingleQuotedValue
			&& state !== State.RawText
		) {
			if (state === State.BogusComment) {
				state = State.Data;
			} else {
				emitTag();
			}
		}
	};

	return {
		feed: (start, segmentEnd, afterMarkup, continuation, inHtmlBlock) => {
			separate(afterMarkup);
			end = segmentEnd;

			let startsLine = false;
			if (inHtmlBlock) {
				let first = start;
				while (first < end && (source.charCodeAt(first) === 32 || source.charCodeAt(first) === 9)) {
					first += 1;
				}
				startsLine = source.startsWith('<!--', first) || (state === State.Comment && commentStartsLine);
			}

			let index = start;
			while (index < end) {
				index = read(index, continuation, startsLine);
			}
		},
	};
};

/**
 * Ports of the HTML tag rules in GitHub's Markdown renderer, cmark-gfm
 * 0.29.0.gfm.13. Both the inline phase and the type 7 HTML block start use them:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/scanners.re#L30-L65
 *
 * Each scanner reads `text` up to `end` and treats every position from `end` on
 * as the end of the input.
 */

/** `spacechar` in cmark-gfm: space, tab, LF, VT, FF, and CR. */
export const isSpaceChar = (code: number) => code === 32 || (code >= 9 && code <= 13);

export const isAsciiLetter = (code: number) => (
	(code >= 65 && code <= 90) || (code >= 97 && code <= 122)
);

const isDigit = (code: number) => code >= 48 && code <= 57;

const isTagNameChar = (code: number) => isAsciiLetter(code) || isDigit(code) || code === 45;

const isAttributeNameStart = (code: number) => isAsciiLetter(code) || code === 95 || code === 58;

const isAttributeNameChar = (code: number) => (
	isAttributeNameStart(code) || isDigit(code) || code === 46 || code === 45
);

// `unquotedvalue` excludes spacechar and `"'=<>` plus the backtick.
const isUnquotedValueChar = (code: number) => !(
	isSpaceChar(code)
	|| code === 34
	|| code === 39
	|| code === 61
	|| code === 60
	|| code === 62
	|| code === 96
);

const skipSpaceChars = (text: string, index: number, end: number) => {
	while (index < end && isSpaceChar(text.charCodeAt(index))) {
		index += 1;
	}
	return index;
};

const skipTagName = (text: string, index: number, end: number) => {
	while (index < end && isTagNameChar(text.charCodeAt(index))) {
		index += 1;
	}
	return index;
};

/** Returns the end of the attribute value at `index`, or -1 when none starts there. */
const scanAttributeValue = (text: string, index: number, end: number) => {
	if (index >= end) {
		return -1;
	}
	const code = text.charCodeAt(index);
	if (code === 34 || code === 39) {
		const close = text.indexOf(code === 34 ? '"' : '\'', index + 1);
		return close === -1 || close >= end ? -1 : close + 1;
	}
	let valueEnd = index;
	while (valueEnd < end && isUnquotedValueChar(text.charCodeAt(valueEnd))) {
		valueEnd += 1;
	}
	return valueEnd === index ? -1 : valueEnd;
};

/**
 * Matches `opentag` or `closetag` at the `<` at `index`, and returns the index
 * after its `>`, or -1. A tag may span lines, because `spacechar` includes LF.
 */
export const scanHtmlTag = (text: string, index: number, end: number) => {
	let cursor = index + 1;
	if (text.charCodeAt(cursor) === 47) {
		cursor += 1;
		if (cursor >= end || !isAsciiLetter(text.charCodeAt(cursor))) {
			return -1;
		}
		cursor = skipSpaceChars(text, skipTagName(text, cursor + 1, end), end);
		return cursor < end && text.charCodeAt(cursor) === 62 ? cursor + 1 : -1;
	}

	if (cursor >= end || !isAsciiLetter(text.charCodeAt(cursor))) {
		return -1;
	}
	cursor = skipTagName(text, cursor + 1, end);

	for (;;) {
		const nameStart = skipSpaceChars(text, cursor, end);
		if (
			nameStart === cursor
			|| nameStart >= end
			|| !isAttributeNameStart(text.charCodeAt(nameStart))
		) {
			break;
		}
		let nameEnd = nameStart + 1;
		while (nameEnd < end && isAttributeNameChar(text.charCodeAt(nameEnd))) {
			nameEnd += 1;
		}
		const equals = skipSpaceChars(text, nameEnd, end);
		if (equals < end && text.charCodeAt(equals) === 61) {
			// After `=`, a value is required, and nothing else can follow the
			// attribute instead.
			const valueEnd = scanAttributeValue(text, skipSpaceChars(text, equals + 1, end), end);
			if (valueEnd === -1) {
				return -1;
			}
			cursor = valueEnd;
		} else {
			cursor = nameEnd;
		}
	}

	cursor = skipSpaceChars(text, cursor, end);
	if (cursor < end && text.charCodeAt(cursor) === 47) {
		cursor += 1;
	}
	return cursor < end && text.charCodeAt(cursor) === 62 ? cursor + 1 : -1;
};

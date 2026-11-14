import { isAsciiLetter, isSpaceChar, scanHtmlTag } from './html-tag.ts';

/**
 * The inline phase. It finds the raw HTML spans in the text of one paragraph,
 * heading, or table cell, as `handle_pointy_brace` in GitHub's renderer does:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L911-L1018
 *
 * Only the inline rules that decide where raw HTML can start are lexed:
 * backslash escapes, code spans, and autolinks. Everything else is text that
 * renders escaped, so it cannot open or close a comment.
 */

// `MAXBACKTICKS`: a longer run is literal text.
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L34
const maxBacktickRun = 80;

const isAsciiPunctuation = (code: number) => (
	(code >= 33 && code <= 47)
	|| (code >= 58 && code <= 64)
	|| (code >= 91 && code <= 96)
	|| (code >= 123 && code <= 126)
);

const isAsciiUppercase = (code: number) => code >= 65 && code <= 90;

const isAsciiAlphanumeric = (code: number) => isAsciiLetter(code) || (code >= 48 && code <= 57);

// `scheme`: a letter, then letters, digits, `+`, `.`, or `-`, 2 to 32 in all.
const isSchemeChar = (code: number) => (
	isAsciiAlphanumeric(code) || code === 43 || code === 46 || code === 45
);

const emailLocalPunctuation = '.!#$%&\'*+/=?^_`{|}~-';

const isEmailLocalChar = (text: string, index: number) => (
	isAsciiAlphanumeric(text.charCodeAt(index)) || emailLocalPunctuation.includes(text[index])
);

/** `scan_autolink_uri` after the `<`: returns the index after the `>`, or -1. */
const matchUriAutolink = (text: string, index: number) => {
	if (!isAsciiLetter(text.charCodeAt(index))) {
		return -1;
	}
	let cursor = index + 1;
	while (isSchemeChar(text.charCodeAt(cursor))) {
		cursor += 1;
	}
	const schemeLength = cursor - index;
	if (schemeLength < 2 || schemeLength > 32 || text.charCodeAt(cursor) !== 58) {
		return -1;
	}
	// Anything but U+0001 to U+0020, `<`, and `>`. cmark-gfm reads NUL as
	// U+FFFD, so NUL is allowed.
	for (cursor += 1; cursor < text.length; cursor += 1) {
		const code = text.charCodeAt(cursor);
		if (code === 62) {
			return cursor + 1;
		}
		if ((code !== 0 && code <= 32) || code === 60) {
			return -1;
		}
	}
	return -1;
};

/** `scan_autolink_email` after the `<`: returns the index after the `>`, or -1. */
const matchEmailAutolink = (text: string, index: number) => {
	let cursor = index;
	while (cursor < text.length && isEmailLocalChar(text, cursor)) {
		cursor += 1;
	}
	if (cursor === index || text.charCodeAt(cursor) !== 64) {
		return -1;
	}

	// Labels of 1 to 63 letters, digits, and `-`, which start and end with a
	// letter or digit, separated by `.`.
	for (;;) {
		const labelStart = cursor + 1;
		cursor = labelStart;
		while (isAsciiAlphanumeric(text.charCodeAt(cursor)) || text.charCodeAt(cursor) === 45) {
			cursor += 1;
		}
		if (
			cursor === labelStart
			|| cursor - labelStart > 63
			|| !isAsciiAlphanumeric(text.charCodeAt(labelStart))
			|| !isAsciiAlphanumeric(text.charCodeAt(cursor - 1))
		) {
			return -1;
		}
		const code = text.charCodeAt(cursor);
		if (code === 62) {
			return cursor + 1;
		}
		if (code !== 46) {
			return -1;
		}
	}
};

/** Returns the index after the autolink at the `<` at `index`, or -1. */
const matchAutolink = (text: string, index: number) => {
	const uriEnd = matchUriAutolink(text, index + 1);
	return uriEnd === -1 ? matchEmailAutolink(text, index + 1) : uriEnd;
};

/**
 * Skips a construct that ends at the first run of `char` whose length leaves
 * two of them before `>`. This is how the `htmlcomment` and `cdata` patterns
 * close: a run of 3 or 4 dashes before `>` is still content, and a run of 5
 * ends the comment. Returns the index after the `>`, or -1 at the end of input.
 */
const skipToRunClose = (text: string, index: number, char: number) => {
	while (index < text.length) {
		if (text.charCodeAt(index) !== char) {
			index += 1;
		} else if (text.charCodeAt(index + 1) !== char) {
			index += 2;
		} else if (text.charCodeAt(index + 2) === 62) {
			return index + 3;
		} else {
			index += 3;
		}
	}
	return -1;
};

/**
 * Skips a processing instruction after its `<?`. Each `?` pairs with the
 * character after it, so it ends at the first unpaired `?` before `>`.
 */
const skipProcessingInstruction = (text: string, index: number) => {
	while (index < text.length) {
		if (text.charCodeAt(index) !== 63) {
			index += 1;
		} else if (text.charCodeAt(index + 1) === 62) {
			return index + 2;
		} else {
			index += 2;
		}
	}
	return -1;
};

/**
 * Calls `emit` with the start and end of each raw HTML span in `text`, in order.
 */
export const lexInline = (text: string, emit: (start: number, end: number) => void) => {
	// Once a kind of construct fails to close, cmark-gfm stops matching that
	// kind for the rest of the text. An unclosed comment disables every `<!`
	// construct, including empty comments.
	let skipBang = false;
	let skipCdata = false;
	let skipDeclaration = false;
	let skipProcessing = false;

	// Code spans: each maximal backtick run, found on first use. A span closes at
	// the next run of the same length; backslashes do not escape inside one.
	let runStarts: number[] | undefined;
	const runLengths: number[] = [];
	let currentRun = 0;
	const nextRunOfLength = new Map<number, number>();

	const findRuns = () => {
		const starts: number[] = [];
		let index = text.indexOf('`');
		while (index !== -1) {
			const start = index;
			while (text.charCodeAt(index) === 96) {
				index += 1;
			}
			starts.push(start);
			runLengths.push(index - start);
			index = text.indexOf('`', index);
		}
		return starts;
	};

	/** Returns the index after the code span or literal backticks at `index`. */
	const skipBackticks = (index: number) => {
		runStarts ??= findRuns();
		while (runStarts[currentRun] + runLengths[currentRun] <= index) {
			currentRun += 1;
		}
		// An escaped backtick leaves the rest of its run as the opener.
		const length = runStarts[currentRun] + runLengths[currentRun] - index;
		if (length > maxBacktickRun) {
			return index + length;
		}
		let next = Math.max(nextRunOfLength.get(length) ?? 0, currentRun + 1);
		while (next < runStarts.length && runLengths[next] !== length) {
			next += 1;
		}
		nextRunOfLength.set(length, next);
		return next < runStarts.length ? runStarts[next] + length : index + length;
	};

	/** Returns the end of the raw HTML at the `<` at `index`, or -1. */
	const matchRawHtml = (index: number) => {
		if (index + 3 > text.length) {
			return -1;
		}

		const next = text.charCodeAt(index + 1);
		if (next === 33) {
			if (skipBang) {
				return -1;
			}
			const after = text.charCodeAt(index + 2);
			if (after === 45 && text.charCodeAt(index + 3) === 45) {
				if (text.charCodeAt(index + 4) === 62) {
					return index + 5;
				}
				if (text.charCodeAt(index + 4) === 45 && text.charCodeAt(index + 5) === 62) {
					return index + 6;
				}
				const end = skipToRunClose(text, index + 4, 45);
				skipBang = end === -1;
				return end;
			}
			if (after === 91) {
				if (skipCdata || !text.startsWith('CDATA[', index + 3)) {
					return -1;
				}
				const end = skipToRunClose(text, index + 9, 93);
				skipCdata = end === -1;
				return end;
			}
			if (skipDeclaration || !isAsciiUppercase(after)) {
				return -1;
			}
			let cursor = index + 3;
			while (isAsciiUppercase(text.charCodeAt(cursor))) {
				cursor += 1;
			}
			if (cursor >= text.length || !isSpaceChar(text.charCodeAt(cursor))) {
				return -1;
			}
			const close = text.indexOf('>', cursor);
			skipDeclaration = close === -1;
			return close === -1 ? -1 : close + 1;
		}
		if (next === 63) {
			if (skipProcessing) {
				return -1;
			}
			const end = skipProcessingInstruction(text, index + 2);
			skipProcessing = end === -1;
			return end;
		}
		return next === 47 || isAsciiLetter(next) ? scanHtmlTag(text, index, text.length) : -1;
	};

	let index = 0;
	while (index < text.length) {
		const code = text.charCodeAt(index);
		switch (code) {
			case 92: {
				index += isAsciiPunctuation(text.charCodeAt(index + 1)) ? 2 : 1;

				break;
			}
			case 96: {
				index = skipBackticks(index);

				break;
			}
			case 60: {
				const autolinkEnd = matchAutolink(text, index);
				const end = autolinkEnd === -1 ? matchRawHtml(index) : -1;
				if (end !== -1) {
					emit(index, end);
				}
				index = autolinkEnd === -1 ? (end === -1 ? index + 1 : end) : autolinkEnd;

				break;
			}
			default: {
				index += 1;
			}
		}
	}
};

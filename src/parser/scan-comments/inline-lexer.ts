import {
	isAsciiAlphanumeric,
	isAsciiLetter,
	isAsciiPunctuation,
	isSpaceChar,
	scanHtmlTag,
} from './html-tag.ts';
import {
	isCmarkSpace,
	scanDestination,
	scanLabel,
	scanTitle,
} from './block/reference-definition.ts';

/**
 * Indexes `manual_scan_link_url_2` boundaries for monotonic destination starts.
 * A down-step at the starting balance closes the destination; an up-step 33
 * levels above it exceeds cmark-gfm's nesting limit. Escapes have the same
 * parity globally and within a destination, which starts after `(` or space.
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1064-L1102
 */
const indexDestinations = (text: string) => {
	let parenthesisCount = 0;
	let spaceCount = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code === 92 && isAsciiPunctuation(text.charCodeAt(index + 1))) {
			index += 1;
		} else if (code === 40 || code === 41) {
			parenthesisCount += 1;
		} else if (isCmarkSpace(code)) {
			spaceCount += 1;
		}
	}
	const levelCount = parenthesisCount * 2 + 2;
	const upOffsets = new Int32Array(levelCount);
	const downOffsets = new Int32Array(levelCount);
	const spaces = new Int32Array(spaceCount);
	let spaceIndex = 0;
	let balance = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code === 92 && isAsciiPunctuation(text.charCodeAt(index + 1))) {
			index += 1;
		} else if (code === 40) {
			balance += 1;
			upOffsets[balance + parenthesisCount + 1] += 1;
		} else if (code === 41) {
			downOffsets[balance + parenthesisCount + 1] += 1;
			balance -= 1;
		} else if (isCmarkSpace(code)) {
			spaces[spaceIndex] = index;
			spaceIndex += 1;
		}
	}
	// Counting sort groups each level's positions while preserving source order.
	for (let level = 1; level < levelCount; level += 1) {
		upOffsets[level] += upOffsets[level - 1];
		downOffsets[level] += downOffsets[level - 1];
	}
	const upPositions = new Int32Array(upOffsets[levelCount - 1]);
	const downPositions = new Int32Array(downOffsets[levelCount - 1]);
	const upCursors = upOffsets.slice();
	const downCursors = downOffsets.slice();
	balance = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code === 92 && isAsciiPunctuation(text.charCodeAt(index + 1))) {
			index += 1;
		} else if (code === 40) {
			balance += 1;
			const level = balance + parenthesisCount;
			upPositions[upCursors[level]] = index;
			upCursors[level] += 1;
		} else if (code === 41) {
			const level = balance + parenthesisCount;
			downPositions[downCursors[level]] = index;
			downCursors[level] += 1;
			balance -= 1;
		}
	}
	upCursors.set(upOffsets);
	downCursors.set(downOffsets);
	const next = (
		positions: Int32Array,
		offsets: Int32Array,
		cursors: Int32Array,
		level: number,
		start: number,
	) => {
		if (level < 0 || level + 1 >= levelCount) {
			return text.length;
		}
		let cursor = cursors[level];
		const end = offsets[level + 1];
		while (cursor < end && positions[cursor] < start) {
			cursor += 1;
		}
		cursors[level] = cursor;
		return cursor < end ? positions[cursor] : text.length;
	};
	let spaceCursor = 0;
	let balanceCursor = 0;
	let startBalance = 0;
	return (start: number) => {
		// Destination starts increase and cannot occur inside an escaped pair.
		while (balanceCursor < start) {
			const code = text.charCodeAt(balanceCursor);
			if (code === 92 && isAsciiPunctuation(text.charCodeAt(balanceCursor + 1))) {
				balanceCursor += 2;
			} else {
				startBalance += Number(code === 40) - Number(code === 41);
				balanceCursor += 1;
			}
		}
		while (spaceCursor < spaceCount && spaces[spaceCursor] < start) {
			spaceCursor += 1;
		}
		const whitespace = spaceCursor < spaceCount ? spaces[spaceCursor] : text.length;
		const level = startBalance + parenthesisCount;
		const close = next(downPositions, downOffsets, downCursors, level, start);
		const overflow = next(upPositions, upOffsets, upCursors, level + 33, start);
		const end = Math.min(whitespace, close);
		return end === text.length || overflow < end || whitespace === start ? -1 : end;
	};
};

/**
 * The inline phase. It finds the raw HTML spans in the text of one paragraph,
 * heading, or table cell, as `handle_pointy_brace` in GitHub's renderer does:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L911-L1018
 *
 * It lexes the inline rules that decide where raw HTML can start: backslash
 * escapes, code spans, `<…>` autolinks, and links and images. Footnotes and
 * bare-URL autolinks are not lexed yet.
 * Everything else renders as escaped text or renderer-generated markup, neither
 * of which can open a comment.
 */

// `MAXBACKTICKS`: a longer run is literal text.
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L34
const maxBacktickRun = 80;

const isAsciiUppercase = (code: number) => code >= 65 && code <= 90;

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
export const lexInline = (
	text: string,
	emit: (start: number, end: number) => void,
	isDefinedLabel: (label: string) => boolean,
) => {
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

	// `scan_spacechars` differs from the whitespace in a reference definition.
	const skipInlineSpaces = (start: number) => {
		while (isSpaceChar(text.charCodeAt(start))) {
			start += 1;
		}
		return start;
	};
	let destinationIndex: ReturnType<typeof indexDestinations> | undefined;
	let destinationWork = 0;
	const scanUnbracketedDestination = (start: number) => {
		if (!destinationIndex && destinationWork > text.length) {
			destinationIndex = indexDestinations(text);
		}
		if (destinationIndex) {
			return destinationIndex(start);
		}
		let cursor = start;
		let depth = 0;
		while (cursor < text.length) {
			const code = text.charCodeAt(cursor);
			if (code === 92 && isAsciiPunctuation(text.charCodeAt(cursor + 1))) {
				cursor += 2;
			} else if (code === 40) {
				depth += 1;
				if (depth > 32) {
					break;
				}
				cursor += 1;
			} else if (code === 41) {
				if (depth === 0) {
					break;
				}
				depth -= 1;
				cursor += 1;
			} else if (isCmarkSpace(code)) {
				break;
			} else {
				cursor += 1;
			}
		}
		destinationWork += cursor - start + 1;
		const startsWithSpace = cursor === start && text.charCodeAt(cursor) !== 41;
		return cursor >= text.length || depth > 32 || startsWithSpace ? -1 : cursor;
	};
	const matchLinkTail = (start: number) => {
		if (text.charCodeAt(start) !== 40) {
			return -1;
		}
		const destinationStart = skipInlineSpaces(start + 1);
		let destinationEnd: number;
		if (text.charCodeAt(destinationStart) === 60) {
			destinationEnd = scanDestination(text, destinationStart);
		} else {
			destinationEnd = scanUnbracketedDestination(destinationStart);
		}
		if (destinationEnd === -1) {
			return -1;
		}
		const titleStart = skipInlineSpaces(destinationEnd);
		const title = titleStart === destinationEnd ? -1 : scanTitle(text, titleStart);
		const end = skipInlineSpaces(title === -1 ? titleStart : title);
		return text.charCodeAt(end) === 41 ? end + 1 : -1;
	};

	// A completed link sets one shared flag; a later `[` clears it, so even an
	// older link opener may become usable again.
	// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1136-L1349
	const brackets: {
		image: boolean;
		spanStart: number;
		position: number;
		bracketAfter: boolean;
	}[] = [];
	const spans: {
		start: number;
		end: number;
	}[] = [];
	let images = 0;
	let noLinkOpeners = true;
	const pushBracket = (image: boolean) => {
		if (brackets.length > 0) {
			brackets.at(-1)!.bracketAfter = true;
		}
		brackets.push({
			image,
			spanStart: spans.length,
			position: index + (image ? 2 : 1),
			bracketAfter: false,
		});
		if (image) {
			images += 1;
		} else {
			noLinkOpeners = false;
		}
	};
	const flushSpans = () => {
		for (const span of spans) {
			emit(span.start, span.end);
		}
		spans.length = 0;
	};
	// `handle_close_bracket`: https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1199-L1228
	const matchReference = (opener: (typeof brackets)[number], start: number) => {
		const labelEnd = text.charCodeAt(start) === 91 ? scanLabel(text, start, true) : -1;
		let label = labelEnd === -1 ? '' : text.slice(start + 1, labelEnd - 1);
		let labelStart = 0;
		while (labelStart < label.length && isCmarkSpace(label.charCodeAt(labelStart))) {
			labelStart += 1;
		}
		const empty = labelStart === label.length;
		if ((labelEnd === -1 || empty) && !opener.bracketAfter) {
			label = text.slice(opener.position, start - 1);
		}
		return (labelEnd !== -1 || !opener.bracketAfter) && isDefinedLabel(label)
			? (labelEnd === -1 ? start : labelEnd)
			: -1;
	};

	let index = 0;
	while (index < text.length) {
		const code = text.charCodeAt(index);
		switch (code) {
			case 33: {
				if (text.charCodeAt(index + 1) === 91 && text.charCodeAt(index + 2) !== 94) {
					pushBracket(true);
					index += 2;
				} else {
					index += 1;
				}
				break;
			}
			case 91: {
				pushBracket(false);
				index += 1;
				break;
			}
			case 93: {
				const opener = brackets.pop();
				index += 1;
				if (!opener) {
					break;
				}
				let end = -1;
				if (opener.image || !noLinkOpeners) {
					end = matchLinkTail(index);
					if (end === -1) {
						end = matchReference(opener, index);
					}
				}
				if (end !== -1) {
					index = end;
					if (opener.image) {
						spans.length = opener.spanStart;
					} else {
						noLinkOpeners = true;
					}
				}
				if (opener.image) {
					images -= 1;
					if (images === 0) {
						flushSpans();
					}
				}
				break;
			}
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
				if (autolinkEnd !== -1) {
					index = autolinkEnd;
					break;
				}
				const end = matchRawHtml(index);
				if (end === -1) {
					index += 1;
				} else {
					if (images > 0) {
						spans.push({
							start: index,
							end,
						});
					} else {
						emit(index, end);
					}
					index = end;
				}

				break;
			}
			default: {
				index += 1;
			}
		}
	}
	flushSpans();
};

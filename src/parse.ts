/* eslint-disable unicorn/prefer-code-point -- Scanning uses UTF-16 code-unit offsets. */

export type CommentMark = {

	/** Value of the `id` attribute, when the marker is named. */
	id?: string;

	/** Attributes other than `id`, preserved for extensibility (e.g. `file`). */
	attributes: Record<string, string>;

	/** Raw content between the opening and closing comments. */
	content: string;
};

export type ParsedMark = CommentMark & {

	/** Offset where the content starts, right after the opening comment. */
	contentStart: number;

	/** Offset where the content ends, right before the closing comment. */
	contentEnd: number;
};

type CodeRange = [start: number, end: number];

type Comment = {
	start: number;
	innerStart: number;
	innerEnd: number;
};

type Fence = {
	char: string;
	length: number;
	start: number;
};

type ClassifiedComment =
	| {
		kind: 'open';
		attributes: Record<string, string>;
	}
	| { kind: 'close' }
	| { kind: 'other' };

const openDelimiter = '<!--';
const closeDelimiter = '-->';
const keyword = 'comment-mark';

const space = 32;
const tab = 9;
const lineFeed = 10;
const carriageReturn = 13;
const formFeed = 12;
const quoteDouble = 34;
const quoteSingle = 39;
const hyphen = 45;
const slash = 47;
const digitStart = 48;
const digitEnd = 57;
const greaterThan = 62;
const upperStart = 65;
const upperEnd = 90;
const underscore = 95;
const lowerStart = 97;
const lowerEnd = 122;
const equals = 61;

const isWhitespace = (code: number) => (
	code === space
	|| code === tab
	|| code === lineFeed
	|| code === carriageReturn
	|| code === formFeed
);

const isNameStart = (code: number) => (
	(code >= lowerStart && code <= lowerEnd)
	|| (code >= upperStart && code <= upperEnd)
	|| code === underscore
);

const isNameChar = (code: number) => (
	isNameStart(code)
	|| (code >= digitStart && code <= digitEnd)
	|| code === hyphen
);

const isValueChar = (code: number) => (
	!isWhitespace(code) && code !== quoteDouble && code !== quoteSingle
);

const fail = (message: string): never => {
	throw new Error(`[comment-mark] ${message}`);
};

const describeMarker = (id: string | undefined) => (
	id === undefined ? 'without an id' : JSON.stringify(id)
);

/**
 * Matches a fenced code block line. Blockquote prefixes (`>`, `> >`) are
 * allowed, but the fence itself may be indented by at most three spaces.
 */
const matchFence = (line: string) => {
	let index = 0;

	for (;;) {
		let cursor = index;
		let spaces = 0;
		while (line[cursor] === ' ' && spaces < 3) {
			cursor += 1;
			spaces += 1;
		}

		if (line.charCodeAt(cursor) !== greaterThan) {
			break;
		}

		cursor += 1;
		if (line[cursor] === ' ') {
			cursor += 1;
		}
		index = cursor;
	}

	let spaces = 0;
	while (line[index] === ' ' && spaces < 3) {
		index += 1;
		spaces += 1;
	}

	const char = line[index];
	if (char !== '`' && char !== '~') {
		return undefined;
	}

	let length = 0;
	while (line[index + length] === char) {
		length += 1;
	}
	if (length < 3) {
		return undefined;
	}

	return {
		char,
		length,
		remainder: line.slice(index + length),
	};
};

// Inline code: a backtick run closes on the next unescaped run of equal length.
const findInlineCodeRanges = (line: string, lineStart: number, ranges: CodeRange[]) => {
	let index = 0;
	while (index < line.length) {
		if (line[index] !== '`' || (index > 0 && line[index - 1] === '\\')) {
			index += 1;
			continue;
		}

		let run = 0;
		while (line[index + run] === '`') {
			run += 1;
		}

		let cursor = index + run;
		let closeIndex = -1;
		while (cursor < line.length) {
			if (line[cursor] !== '`') {
				cursor += 1;
				continue;
			}

			let closeRun = 0;
			while (line[cursor + closeRun] === '`') {
				closeRun += 1;
			}

			if (line[cursor - 1] !== '\\' && closeRun === run) {
				closeIndex = cursor;
				break;
			}

			cursor += closeRun;
		}

		if (closeIndex === -1) {
			index += run;
			continue;
		}

		ranges.push([lineStart + index, lineStart + closeIndex + run]);
		index = closeIndex + run;
	}
};

const findCodeRanges = (source: string): CodeRange[] => {
	const ranges: CodeRange[] = [];
	let offset = 0;
	let fence: Fence | undefined;

	for (const line of source.split('\n')) {
		const lineStart = offset;
		const lineEnd = offset + line.length;
		offset = lineEnd + 1;

		if (fence) {
			const match = matchFence(line);
			if (match
				&& match.char === fence.char
				&& match.length >= fence.length
				&& match.remainder.trim() === '') {
				ranges.push([fence.start, lineEnd]);
				fence = undefined;
			}
			continue;
		}

		const match = matchFence(line);
		if (match) {
			fence = {
				char: match.char,
				length: match.length,
				start: lineStart,
			};
			continue;
		}

		findInlineCodeRanges(line, lineStart, ranges);
	}

	if (fence) {
		ranges.push([fence.start, source.length]);
	}

	return ranges;
};

const scanComments = (source: string): Comment[] => {
	const comments: Comment[] = [];
	let position = 0;

	while (position < source.length) {
		const start = source.indexOf(openDelimiter, position);
		if (start === -1) {
			break;
		}

		const innerStart = start + openDelimiter.length;
		const innerEnd = source.indexOf(closeDelimiter, innerStart);
		if (innerEnd === -1) {
			break;
		}

		comments.push({
			start,
			innerStart,
			innerEnd,
		});
		position = innerEnd + closeDelimiter.length;
	}

	return comments;
};

const matchesKeyword = (source: string, index: number, end: number) => (
	index + keyword.length <= end && source.startsWith(keyword, index)
);

const skipWhitespace = (source: string, index: number, end: number) => {
	while (index < end && isWhitespace(source.charCodeAt(index))) {
		index += 1;
	}
	return index;
};

const isOnlyWhitespace = (source: string, index: number, end: number) => (
	skipWhitespace(source, index, end) === end
);

const parseValue = (source: string, index: number, end: number, name: string) => {
	const quote = source.charCodeAt(index);
	if (quote === quoteDouble || quote === quoteSingle) {
		const valueEnd = source.indexOf(source[index], index + 1);
		if (valueEnd === -1 || valueEnd >= end) {
			return fail(`Unterminated attribute value for ${JSON.stringify(name)}`);
		}

		const value = source.slice(index + 1, valueEnd);
		index = valueEnd + 1;

		// Attributes must be separated by whitespace so `a="1"b="2"` is
		// rejected instead of silently merging into one token.
		if (index < end && !isWhitespace(source.charCodeAt(index))) {
			return fail('Expected whitespace between attributes');
		}

		return {
			value,
			index,
		};
	}

	const valueStart = index;
	while (index < end && isValueChar(source.charCodeAt(index))) {
		index += 1;
	}
	if (index === valueStart) {
		return fail(`Missing value for attribute ${JSON.stringify(name)}`);
	}

	return {
		value: source.slice(valueStart, index),
		index,
	};
};

const parseAttributes = (source: string, start: number, end: number) => {
	const attributes: Record<string, string> = Object.create(null);
	let index = start;

	while (index < end) {
		index = skipWhitespace(source, index, end);
		if (index >= end) {
			break;
		}

		const nameStart = index;
		if (!isNameStart(source.charCodeAt(index))) {
			return fail(`Invalid marker attribute: ${JSON.stringify(source.slice(index, index + 16))}`);
		}
		index += 1;
		while (index < end && isNameChar(source.charCodeAt(index))) {
			index += 1;
		}
		const name = source.slice(nameStart, index);

		index = skipWhitespace(source, index, end);
		if (source.charCodeAt(index) !== equals) {
			return fail(`Invalid marker attribute: ${JSON.stringify(name)}`);
		}
		index += 1;
		index = skipWhitespace(source, index, end);

		const parsed = parseValue(source, index, end, name);
		if (name in attributes) {
			return fail(`Duplicate marker attribute: ${JSON.stringify(name)}`);
		}
		attributes[name] = parsed.value;
		index = parsed.index;
	}

	return attributes;
};

const classifyComment = (source: string, start: number, end: number): ClassifiedComment => {
	let index = skipWhitespace(source, start, end);

	if (source.charCodeAt(index) === slash) {
		index = skipWhitespace(source, index + 1, end);
		if (
			matchesKeyword(source, index, end)
			&& isOnlyWhitespace(source, index + keyword.length, end)
		) {
			return { kind: 'close' };
		}
		return { kind: 'other' };
	}

	if (matchesKeyword(source, index, end)) {
		const after = index + keyword.length;
		if (after === end || !isNameChar(source.charCodeAt(after))) {
			return {
				kind: 'open',
				attributes: parseAttributes(source, after, end),
			};
		}
	}

	return { kind: 'other' };
};

type ActiveMarker = {
	id?: string;
	attributes: Record<string, string>;
	contentStart: number;
};

const advanceCodeIndex = (codeRanges: CodeRange[], codeIndex: number, offset: number) => {
	while (codeIndex < codeRanges.length && codeRanges[codeIndex][1] <= offset) {
		codeIndex += 1;
	}
	return codeIndex;
};

const isInCode = (codeRanges: CodeRange[], codeIndex: number, offset: number) => (
	codeIndex < codeRanges.length
	&& codeRanges[codeIndex][0] <= offset
	&& offset < codeRanges[codeIndex][1]
);

/**
 * Parses comment-mark markers from a document.
 *
 * Markers inside fenced code blocks or single-line inline code spans are
 * ignored, and both the opening and closing comments must sit outside code.
 * Indented code blocks and code spans that wrap across lines are not
 * recognized.
 */
export const parseMarks = (source: string): ParsedMark[] => {
	if (!source.includes(openDelimiter)) {
		return [];
	}

	const hasCodeSyntax = source.includes('`') || source.includes('~');
	const codeRanges = hasCodeSyntax ? findCodeRanges(source) : [];
	const marks: ParsedMark[] = [];
	let active: ActiveMarker | undefined;
	let codeIndex = 0;

	for (const comment of scanComments(source)) {
		codeIndex = advanceCodeIndex(codeRanges, codeIndex, comment.start);
		if (isInCode(codeRanges, codeIndex, comment.start)) {
			continue;
		}

		const classified = classifyComment(source, comment.innerStart, comment.innerEnd);
		if (classified.kind === 'open') {
			const { id, ...attributes } = classified.attributes;
			if (active) {
				return fail(`Nested marker ${describeMarker(id || undefined)} is not supported`);
			}
			active = {
				id: id || undefined,
				attributes,
				contentStart: comment.innerEnd + closeDelimiter.length,
			};
		} else if (classified.kind === 'close' && active) {
			marks.push({
				id: active.id,
				attributes: active.attributes,
				content: source.slice(active.contentStart, comment.start),
				contentStart: active.contentStart,
				contentEnd: comment.start,
			});
			active = undefined;
		}
	}

	if (active) {
		return fail(`No closing comment found for marker ${describeMarker(active.id)}`);
	}

	return marks;
};

/* eslint-enable unicorn/prefer-code-point */

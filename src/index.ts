export type CommentMark = {

	/** Value of the `id` attribute, when the marker is named. */
	id?: string;

	/** Attributes other than `id`, preserved for extensibility (e.g. `file`). */
	attributes: Record<string, string>;

	/** Raw content between the opening and closing comments. */
	content: string;
};

type CodeRange = [start: number, end: number];

type Fence = {
	char: string;
	length: number;
	start: number;
};

type ParsedMark = CommentMark & {
	contentStart: number;
	contentEnd: number;
};

// Fenced code blocks and single-line inline code spans are treated as literal
// text so markers shown in documentation examples are not parsed. Indented code
// blocks, blockquote/list-prefixed fences, and code spans that wrap across lines
// are out of scope; covering those would require a full Markdown parser.
const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const openPattern = /<!--\s*comment-mark\b([\s\S]*?)-->/g;
const closePattern = /<!--\s*\/\s*comment-mark\s*-->/g;
const attributePattern = /([a-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/gi;

// Inline code span: a backtick run closes on the next run of equal length.
const findInlineCodeRanges = (line: string, lineStart: number, ranges: CodeRange[]) => {
	let index = 0;
	while (index < line.length) {
		if (line[index] !== '`') {
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
			if (closeRun === run) {
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

const findCodeRanges = (content: string): CodeRange[] => {
	const ranges: CodeRange[] = [];
	let offset = 0;
	let fence: Fence | undefined;

	for (const line of content.split('\n')) {
		const lineStart = offset;
		const lineEnd = offset + line.length;
		offset = lineEnd + 1;

		const fenceMatch = fencePattern.exec(line);
		if (fence) {
			if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length) {
				ranges.push([fence.start, lineEnd]);
				fence = undefined;
			}
			continue;
		}

		if (fenceMatch) {
			fence = {
				char: fenceMatch[1][0],
				length: fenceMatch[1].length,
				start: lineStart,
			};
			continue;
		}

		findInlineCodeRanges(line, lineStart, ranges);
	}

	if (fence) {
		ranges.push([fence.start, content.length]);
	}

	return ranges;
};

const isInCode = (ranges: CodeRange[], offset: number) => ranges.some(
	([start, end]) => offset >= start && offset < end,
);

// Parses `key="value"` attributes, rejecting stray text and duplicates.
const parseAttributes = (raw: string): Record<string, string> => {
	const attributes: Record<string, string> = Object.create(null);
	let lastIndex = 0;

	attributePattern.lastIndex = 0;
	for (let match = attributePattern.exec(raw); match !== null; match = attributePattern.exec(raw)) {
		const stray = raw.slice(lastIndex, match.index).trim();
		if (stray) {
			throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(stray)}`);
		}

		const name = match[1];
		if (name in attributes) {
			throw new Error(`[comment-mark] Duplicate marker attribute: ${JSON.stringify(name)}`);
		}

		attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
		lastIndex = attributePattern.lastIndex;
	}

	const trailing = raw.slice(lastIndex).trim();
	if (trailing) {
		throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(trailing)}`);
	}

	return attributes;
};

const parseMarks = (content: string): ParsedMark[] => {
	const codeRanges = findCodeRanges(content);
	const marks: ParsedMark[] = [];

	openPattern.lastIndex = 0;
	for (let open = openPattern.exec(content); open !== null; open = openPattern.exec(content)) {
		if (isInCode(codeRanges, open.index)) {
			continue;
		}

		const attributes = parseAttributes(open[1]);
		const { id, ...rest } = attributes;
		const contentStart = open.index + open[0].length;

		closePattern.lastIndex = contentStart;
		const close = closePattern.exec(content);
		if (!close) {
			const label = id ? JSON.stringify(id) : 'without an id';
			throw new Error(`[comment-mark] No closing comment found for marker ${label}`);
		}

		marks.push({
			id: id || undefined,
			attributes: rest,
			content: content.slice(contentStart, close.index),
			contentStart,
			contentEnd: close.index,
		});

		openPattern.lastIndex = close.index + close[0].length;
	}

	return marks;
};

export const commentMark = (
	input: string | Buffer,
	data: Record<string, string | null | undefined>,
) => {
	if (
		!input
		|| data === null
		|| data === undefined
		|| typeof data !== 'object'
	) {
		return input;
	}

	const content = Buffer.isBuffer(input) ? input.toString() : input;

	let out = '';
	let cursor = 0;
	for (const mark of parseMarks(content)) {
		const value = mark.id !== undefined && Object.hasOwn(data, mark.id) ? data[mark.id] : undefined;

		out += content.slice(cursor, mark.contentStart);
		if (value === null || value === undefined) {
			out += mark.content;
		} else {
			out += value.includes('\n') ? `\n${value}\n` : value;
		}
		cursor = mark.contentEnd;
	}

	return out + content.slice(cursor);
};

export const getCommentMarks = (input: string | Buffer): Record<string, string> => {
	const content = Buffer.isBuffer(input) ? input.toString() : input;
	// Null-prototype dictionary so marker ids can never collide with inherited properties.
	const commentMarks: Record<string, string> = Object.create(null);

	for (const mark of parseMarks(content)) {
		if (mark.id !== undefined) {
			commentMarks[mark.id] = mark.content;
		}
	}

	return commentMarks;
};

export const getCommentMarkers = (input: string | Buffer): CommentMark[] => {
	const content = Buffer.isBuffer(input) ? input.toString() : input;

	return parseMarks(content).map((mark) => {
		const marker: CommentMark = {
			attributes: mark.attributes,
			content: mark.content,
		};
		if (mark.id !== undefined) {
			marker.id = mark.id;
		}
		return marker;
	});
};

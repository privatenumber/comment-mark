import {
	type Cursor,
	consumeIndent,
	isBlank,
	isSetextUnderline,
	isThematicBreak,
	matchAtxHeading,
	matchBlockquote,
	matchFence,
	matchListMarker,
	tabSize,
} from './parser/block-context.ts';

const newCursor = (): Cursor => ({
	index: 0,
	column: 0,
	pending: 0,
});

// A line indented by four or more columns is indented code. It cannot interrupt
// a paragraph, so it is only a block at the start of one.
const isIndentedCode = (line: string, inParagraph: boolean) => {
	if (inParagraph) {
		return false;
	}
	const cursor = newCursor();
	return consumeIndent(line, cursor, tabSize) && !isBlank(line, cursor.index);
};

// A GFM table starts with a `|` cell row. The delimiter row that makes it a
// table follows, so only the first row is needed to spot one.
const startsTable = (line: string) => {
	let index = 0;
	while (index < 3 && line[index] === ' ') {
		index += 1;
	}
	return line[index] === '|';
};

/**
 * Reports whether this line opens a block other than a paragraph. A setext
 * underline counts because it turns the paragraph above it into a heading.
 */
const lineOpensBlock = (line: string, inParagraph: boolean) => {
	const cursor = newCursor();
	return (
		matchAtxHeading(line, cursor) !== undefined
		|| isThematicBreak(line, cursor)
		|| isSetextUnderline(line, cursor)
		|| matchFence(line, cursor) !== undefined
		|| matchBlockquote(line, cursor)
		|| matchListMarker(line, cursor, inParagraph) !== undefined
		|| startsTable(line)
		|| isIndentedCode(line, inParagraph)
	);
};

/**
 * Reports whether replacement content has to sit on its own lines.
 *
 * A comment that starts a line opens a CommonMark HTML block, so text written
 * on the same line is not parsed as Markdown. A single line of inline text
 * reads the same either way, but content on more than one line cannot sit
 * inside a paragraph, and a block only renders when it starts a line.
 */
export const needsBlockPadding = (content: string) => {
	// A trailing line ending only ends the last line, so it does not make the
	// content multiline.
	let end = content.length;
	while (end > 0 && (content[end - 1] === '\n' || content[end - 1] === '\r')) {
		end -= 1;
	}
	for (let index = 0; index < end; index += 1) {
		if (content[index] === '\n') {
			return true;
		}
	}

	let lineStart = 0;
	let inParagraph = false;

	while (lineStart < content.length) {
		const lineFeed = content.indexOf('\n', lineStart);
		const lineEnd = lineFeed === -1 ? content.length : lineFeed;
		const line = content.slice(lineStart, lineEnd);

		if (isBlank(line, 0)) {
			// A blank line inside content separates two blocks. Leading and
			// trailing blank lines only pad the content.
			if (inParagraph) {
				return true;
			}
		} else {
			if (lineOpensBlock(line, inParagraph)) {
				return true;
			}
			inParagraph = true;
		}

		if (lineFeed === -1) {
			break;
		}
		lineStart = lineFeed + 1;
	}

	return false;
};

/**
 * Prepares replacement content for a section. Content that needs block layout
 * gets a newline on each side when it does not already have one, so it starts
 * on its own line and the closing comment cannot join its last line. Inline
 * content is inserted as written, so a value can sit inside a paragraph.
 */
export const padContent = (content: string) => {
	if (!needsBlockPadding(content)) {
		return content;
	}

	const leading = content.startsWith('\n') ? '' : '\n';
	const trailing = content.endsWith('\n') ? '' : '\n';
	return `${leading}${content}${trailing}`;
};

export const tabSize = 4;

/**
 * A source position while matching block structure. `index` is the next
 * unconsumed character, `column` is that character's rendered column, and
 * `pending` is the number of indentation columns still available from a tab
 * that was only partially consumed. A tab spans several columns but has a
 * single source offset, so `pending` lets one tab satisfy the indentation of
 * more than one nested container. The position's consumed columns are
 * `column - pending`.
 */
export type Cursor = {
	index: number;
	column: number;
	pending: number;
};

export type Container =
	| { type: 'blockquote' }
	| {
		type: 'listItem';
		indent: number;
	};

export type Fence = {
	char: string;
	length: number;
	depth: number;
};

/** A blank line holds only spaces and tabs, per the CommonMark definition. */
export const isBlank = (line: string, start: number) => {
	for (let index = start; index < line.length; index += 1) {
		const char = line[index];
		if (char !== ' ' && char !== '\t') {
			return false;
		}
	}
	return true;
};

/**
 * Advances the cursor past `columns` indentation columns and commits it on
 * success. Tabs advance to the next four-column tab stop; a tab that overshoots
 * leaves its remaining columns in `pending`. Returns false, without moving the
 * cursor, when the line is not indented enough.
 */
export const consumeIndent = (line: string, cursor: Cursor, columns: number) => {
	let { index, column, pending } = cursor;
	let remaining = columns;

	if (pending >= remaining) {
		cursor.pending = pending - remaining;
		return true;
	}
	remaining -= pending;
	pending = 0;

	while (remaining > 0) {
		const char = line[index];
		if (char === ' ') {
			index += 1;
			column += 1;
			remaining -= 1;
		} else if (char === '\t') {
			const width = tabSize - (column % tabSize);
			index += 1;
			column += width;
			if (width > remaining) {
				cursor.index = index;
				cursor.column = column;
				cursor.pending = width - remaining;
				return true;
			}
			remaining -= width;
		} else {
			return false;
		}
	}

	cursor.index = index;
	cursor.column = column;
	cursor.pending = pending;
	return true;
};

/**
 * Matches a `>` blockquote marker after at most three indentation columns and
 * commits the cursor past it and its optional delimiter space.
 */
export const matchBlockquote = (line: string, cursor: Cursor) => {
	let { index, column } = cursor;
	let indent = cursor.pending;

	while (indent < 3 && line[index] === ' ') {
		index += 1;
		column += 1;
		indent += 1;
	}

	if (line[index] !== '>') {
		return false;
	}

	index += 1;
	column += 1;

	const char = line[index];
	if (char === ' ') {
		index += 1;
		column += 1;
	} else if (char === '\t') {
		// The tab stands in for the optional delimiter space, so all but one
		// of its columns remain as content indentation.
		const width = tabSize - (column % tabSize);
		index += 1;
		column += width;
		cursor.index = index;
		cursor.column = column;
		cursor.pending = width - 1;
		return true;
	}

	cursor.index = index;
	cursor.column = column;
	cursor.pending = 0;
	return true;
};

/**
 * Reports whether a container continues on this line and commits the cursor
 * past its prefix.
 *
 * A blockquote requires its `>` marker on every line it contains, including
 * blank ones. A list item requires its content indentation, but a blank
 * remainder continues it: list items accept blank lines while blockquotes do
 * not. Because each container reads the line from where the previous one
 * stopped, a `>`-prefixed blank line is blank inside the blockquote without
 * also being blank at the outer level.
 */
export const continueContainer = (line: string, cursor: Cursor, container: Container) => {
	if (container.type === 'blockquote') {
		return matchBlockquote(line, cursor);
	}
	return isBlank(line, cursor.index) || consumeIndent(line, cursor, container.indent);
};

/**
 * Matches a list item marker after at most three indentation columns and
 * commits the cursor past its content padding. Returns the item's content
 * indentation, or undefined when this line does not start a list item.
 *
 * An open paragraph is only interrupted by a bullet item, or by an ordered item
 * that starts at `1`, and never by an empty item.
 */
export const matchListMarker = (line: string, cursor: Cursor, inParagraph: boolean) => {
	let { index, column } = cursor;
	let indent = cursor.pending;

	while (indent < 4 && line[index] === ' ') {
		index += 1;
		column += 1;
		indent += 1;
	}
	// A fourth indentation column makes this indented code, not a marker.
	if (indent > 3) {
		return undefined;
	}

	const char = line[index];
	let markerWidth = 1;
	if (char !== '-' && char !== '+' && char !== '*') {
		// An ordered marker is one to nine digits followed by `.` or `)`. The
		// digits are read one index at a time so the marker grammar stays
		// explicit.
		let digits = 0;
		while (digits < 9) {
			const digit = line[index + digits];
			if (digit === undefined || digit < '0' || digit > '9') {
				break;
			}
			digits += 1;
		}

		const terminator = line[index + digits];
		if (digits === 0 || (terminator !== '.' && terminator !== ')')) {
			return undefined;
		}
		// Only `1.` may interrupt an open paragraph.
		if (inParagraph && (digits !== 1 || char !== '1')) {
			return undefined;
		}
		markerWidth = digits + 1;
	}

	const afterMarker = index + markerWidth;
	if (afterMarker < line.length) {
		const next = line[afterMarker];
		if (next !== ' ' && next !== '\t') {
			return undefined;
		}
	}
	if (inParagraph && isBlank(line, afterMarker)) {
		return undefined;
	}

	// Measure the padding after the marker in rendered columns, because a tab
	// spans to the next tab stop and can satisfy several indentation columns.
	let paddingIndex = afterMarker;
	let paddingColumn = column + markerWidth;
	let padding = 0;
	while (padding < 5) {
		const paddingChar = line[paddingIndex];
		if (paddingChar === ' ') {
			paddingIndex += 1;
			paddingColumn += 1;
			padding += 1;
		} else if (paddingChar === '\t') {
			const width = tabSize - (paddingColumn % tabSize);
			paddingIndex += 1;
			paddingColumn += width;
			padding += width;
		} else {
			break;
		}
	}

	// A blank item, or five or more padding columns, collapses to a single
	// space. That space can fall inside a tab, so the cursor keeps the rest of
	// the tab's columns as the item's content indentation.
	if (padding < 1 || padding > 4) {
		const first = line[afterMarker];
		if (first === '\t') {
			const width = tabSize - ((column + markerWidth) % tabSize);
			cursor.index = afterMarker + 1;
			cursor.column = column + markerWidth + width;
			cursor.pending = width - 1;
		} else if (first === ' ') {
			cursor.index = afterMarker + 1;
			cursor.column = column + markerWidth + 1;
			cursor.pending = 0;
		} else {
			cursor.index = afterMarker;
			cursor.column = column + markerWidth;
			cursor.pending = 0;
		}

		return {
			contentIndent: indent + markerWidth + 1,
		};
	}

	cursor.index = paddingIndex;
	cursor.column = paddingColumn;
	cursor.pending = 0;

	return {
		contentIndent: indent + markerWidth + padding,
	};
};

/**
 * Matches a fence opener or closer after at most three indentation columns. A
 * backtick fence whose info string contains a backtick is rejected so inline
 * code cannot open a fence.
 */
export const matchFence = (line: string, cursor: Cursor) => {
	let { index } = cursor;
	let spaces = cursor.pending;

	while (spaces < 3 && line[index] === ' ') {
		index += 1;
		spaces += 1;
	}
	// A fourth indentation column makes this indented code, not a fence.
	if (line[index] === ' ') {
		return undefined;
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

	const end = index + length;
	if (char === '`' && line.slice(end).includes('`')) {
		return undefined;
	}

	return {
		char,
		length,
		end,
	};
};

/**
 * Reports whether this line closes the given fence: the same character, at
 * least as long, indented up to three columns, with only spaces and tabs after
 * it.
 */
export const closesFence = (line: string, cursor: Cursor, fence: Fence) => {
	const match = matchFence(line, cursor);
	return Boolean(
		match
		&& match.char === fence.char
		&& match.length >= fence.length
		&& isBlank(line, match.end),
	);
};

/**
 * Matches a thematic break (horizontal rule): three or more `-`, `_`, or `*`
 * characters separated only by spaces or tabs, indented up to three columns. A
 * thematic break takes precedence over a list item, so it must be recognized
 * before a list container opens.
 */
export const isThematicBreak = (line: string, cursor: Cursor) => {
	let { index } = cursor;
	let indent = cursor.pending;

	while (indent < 4 && line[index] === ' ') {
		index += 1;
		indent += 1;
	}
	if (indent > 3) {
		return false;
	}

	let marker = '';
	let count = 0;
	for (; index < line.length; index += 1) {
		const char = line[index];
		if (char === ' ' || char === '\t') {
			continue;
		}
		if (char !== '-' && char !== '_' && char !== '*') {
			return false;
		}
		if (marker === '') {
			marker = char;
		} else if (char !== marker) {
			return false;
		}
		count += 1;
	}

	return count >= 3;
};

/**
 * Matches an ATX heading: one to six `#` followed by a space, a tab, or the end
 * of the line, indented up to three columns. Returns the index the heading's
 * content starts at, or undefined.
 *
 * A heading is a leaf block. The scanner treats it like a paragraph while it is
 * being read, but it must not leave a paragraph open for the next line, or a
 * following ordered list would be rejected as a paragraph interruption and its
 * fenced example would be treated as a real marker. The content is scanned like
 * any other line, so a marker written in a heading is still a marker.
 */
export const matchAtxHeading = (line: string, cursor: Cursor) => {
	let { index } = cursor;
	let indent = cursor.pending;

	while (indent < 4 && line[index] === ' ') {
		index += 1;
		indent += 1;
	}
	if (indent > 3) {
		return undefined;
	}

	let hashes = 0;
	while (hashes < 7 && line[index + hashes] === '#') {
		hashes += 1;
	}
	if (hashes < 1 || hashes > 6) {
		return undefined;
	}

	const next = line[index + hashes];
	if (next !== undefined && next !== ' ' && next !== '\t') {
		return undefined;
	}

	// Skip the separator so the caller scans the heading's text.
	let content = index + hashes;
	while (line[content] === ' ' || line[content] === '\t') {
		content += 1;
	}

	return content;
};

/**
 * Matches a setext heading underline: a run of `=` or `-` followed by only
 * spaces and tabs, indented up to three columns.
 *
 * An underline turns the open paragraph into a heading, so it ends the
 * paragraph rather than extending it. It must also be recognized before a list
 * marker, because a bare `-` would otherwise become an empty list item.
 */
export const isSetextUnderline = (line: string, cursor: Cursor) => {
	let { index } = cursor;
	let indent = cursor.pending;

	while (indent < 4 && line[index] === ' ') {
		index += 1;
		indent += 1;
	}
	if (indent > 3) {
		return false;
	}

	const char = line[index];
	if (char !== '=' && char !== '-') {
		return false;
	}

	let underline = 0;
	while (line[index + underline] === char) {
		underline += 1;
	}

	return isBlank(line, index + underline);
};

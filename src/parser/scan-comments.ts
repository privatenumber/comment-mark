export type CommentVisitor = (
	start: number,
	innerStart: number,
	innerEnd: number,
) => void;

type Container =
	| { type: 'blockquote' }
	| {
		type: 'listItem';
		indent: number;
	};

type Fence = {
	char: string;
	length: number;
	containers: Container[];
	start: number;
};

type BacktickRun = {
	start: number;
	length: number;
	escaped: boolean;
	synthetic: boolean;
	next: number;
};

const openDelimiter = '<!--';
const closeDelimiter = '-->';

const isBlank = (line: string) => line.trim() === '';

const tabSize = 4;

/**
 * A source position while matching block structure. `column` is the rendered
 * column of `line[index]`, and `pending` is the number of indentation columns
 * still available from a tab that was only partially consumed. A tab spans
 * several columns but has a single source offset, so `pending` lets one tab
 * satisfy the indentation of more than one nested container.
 */
type Cursor = {
	index: number;
	column: number;
	pending: number;
};

/**
 * Advances the cursor past `columns` indentation columns and commits it on
 * success. Tabs advance to the next four-column tab stop; a tab that overshoots
 * leaves its remaining columns in `pending`. Returns false when the line is not
 * indented enough.
 */
const consumeIndent = (line: string, cursor: Cursor, columns: number) => {
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
 * Matches a `>` blockquote marker after at most three spaces and returns the
 * index after it, or -1 when this level has no marker.
 */
const matchBlockquote = (line: string, cursor: Cursor) => {
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
 * Matches a list item marker after at most three spaces. Returns the item's
 * content indentation and content start, or undefined when there is no marker.
 */
const matchListMarker = (line: string, cursor: Cursor) => {
	let { index, column } = cursor;
	let spaces = cursor.pending;

	while (spaces < 4 && line[index] === ' ') {
		index += 1;
		column += 1;
		spaces += 1;
	}
	if (spaces > 3) {
		return undefined;
	}

	const char = line[index];
	let markerWidth = 1;
	if (char !== '-' && char !== '+' && char !== '*') {
		const match = /^\d{1,9}[.)]/.exec(line.slice(index));
		if (!match) {
			return undefined;
		}
		markerWidth = match[0].length;
	}

	const afterMarker = index + markerWidth;
	if (line[afterMarker] !== ' ' && line[afterMarker] !== '\t') {
		return undefined;
	}

	// Measure the padding after the marker in rendered columns, because a tab
	// spans to the next tab stop and can satisfy several indentation columns.
	// Five or more columns collapse to a single space.
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

	if (padding > 4) {
		padding = 1;
		paddingIndex = afterMarker + 1;
		paddingColumn = column + markerWidth + 1;
	}

	cursor.index = paddingIndex;
	cursor.column = paddingColumn;
	cursor.pending = 0;

	return {
		contentIndent: spaces + markerWidth + padding,
	};
};

/**
 * Matches a fence opener after at most three spaces. A backtick fence whose
 * info string contains a backtick is rejected so inline code cannot open a
 * fence.
 */
const matchFence = (line: string, cursor: Cursor) => {
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
 * Matches a thematic break (horizontal rule): three or more `-`, `_`, or `*`
 * characters separated only by spaces or tabs. A thematic break is not a list
 * item, so it must be recognized before a list container opens.
 */
const isThematicBreak = (line: string, start: number) => {
	let marker = '';
	let count = 0;

	for (let index = start; index < line.length; index += 1) {
		const char = line[index];
		if (char === ' ' || char === '\t') {
			continue;
		}
		if (char === '\r') {
			break;
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
 * Matches the current block containers and returns how much of the line they
 * consume. `matched` is the number of containers that continue on this line.
 */
const matchContainers = (line: string, cursor: Cursor, containers: Container[]) => {
	let matched = 0;

	for (const container of containers) {
		const continues = container.type === 'blockquote'
			? matchBlockquote(line, cursor)
			: consumeIndent(line, cursor, container.indent);
		if (!continues) {
			break;
		}
		matched += 1;
	}

	return matched;
};

/**
 * Reports whether any container is a blockquote. A blockquote does not continue
 * across a blank line, unlike a list item, so a blank line ends a fence whose
 * container is a blockquote.
 */
const hasBlockquote = (containers: Container[]) => {
	for (const container of containers) {
		if (container.type === 'blockquote') {
			return true;
		}
	}
	return false;
};

/**
 * Collects the backtick runs in one line and links each run to the next run of
 * the same length. Span matching walks these links, so the line is scanned
 * once instead of searching the rest of the line per run.
 */
const findBacktickRuns = (line: string, start: number) => {
	const runs = new Map<number, BacktickRun>();
	let index = start;

	while (index < line.length) {
		if (line[index] !== '`') {
			index += 1;
			continue;
		}

		// A backtick escaped by an odd number of backslashes cannot open a span,
		// but it can still close one because escapes do not apply inside a span.
		let backslashes = 0;
		let cursor = index - 1;
		while (cursor >= 0 && line[cursor] === '\\') {
			backslashes += 1;
			cursor -= 1;
		}
		const escaped = backslashes % 2 === 1;

		let length = 0;
		while (line[index + length] === '`') {
			length += 1;
		}
		runs.set(index, {
			start: index,
			length,
			escaped,
			synthetic: false,
			next: -1,
		});
		// Only the first backtick is escaped; the rest form a run that can open.
		if (escaped && length > 1) {
			runs.set(index + 1, {
				start: index + 1,
				length: length - 1,
				escaped: false,
				synthetic: true,
				next: -1,
			});
		}
		index += length;
	}

	const lastByLength = new Map<number, number>();
	for (const run of [...runs.values()].toReversed()) {
		const next = lastByLength.get(run.length);
		if (next !== undefined) {
			run.next = next;
		}
		// A synthetic run can only open a span; inside a span the escaped
		// backtick is literal, so the run's real length is the full run.
		if (!run.synthetic) {
			lastByLength.set(run.length, run.start);
		}
	}

	return runs;
};

/**
 * Visits every HTML comment's boundaries in document order.
 *
 * `innerStart` is the first character after `<!--` and `innerEnd` is the index
 * of the closing `-->`.
 *
 * The scan tracks block containers, fenced code blocks, inline code spans, and
 * HTML comments in one pass. A comment inside code is not visited, and code
 * syntax inside a comment is not interpreted, so the two cannot corrupt each
 * other. Fence openers and closers must share the same block containers, so a
 * top-level fence is not closed by a blockquote line and an unclosed fence ends
 * with its container.
 */
export const scanComments = (source: string, visit: CommentVisitor) => {
	const containers: Container[] = [];
	let fence: Fence | undefined;
	let commentStart = -1;
	let offset = 0;

	const scanInline = (line: string, lineStart: number, start: number) => {
		const runs = line.includes('`', start) ? findBacktickRuns(line, start) : undefined;
		let index = start;

		while (index < line.length) {
			const run = runs?.get(index);
			if (run) {
				if (run.escaped) {
					// Skip only the escaped backtick so the rest of the run can open.
					index += 1;
				} else if (run.next === -1) {
					// An unmatched run is literal text.
					index += run.length;
				} else {
					const close = runs?.get(run.next);
					index = run.next + (close?.length ?? run.length);
				}
				continue;
			}

			if (line.startsWith(openDelimiter, index)) {
				const close = line.indexOf(closeDelimiter, index + openDelimiter.length);
				if (close === -1) {
					commentStart = lineStart + index;
					return;
				}
				visit(
					lineStart + index,
					lineStart + index + openDelimiter.length,
					lineStart + close,
				);
				index = close + closeDelimiter.length;
				continue;
			}

			index += 1;
		}
	};

	const openContainersAndScan = (line: string, lineStart: number, cursor: Cursor) => {
		for (;;) {
			if (matchBlockquote(line, cursor)) {
				containers.push({ type: 'blockquote' });
				continue;
			}

			if (isThematicBreak(line, cursor.index)) {
				break;
			}

			const list = matchListMarker(line, cursor);
			if (list) {
				containers.push({
					type: 'listItem',
					indent: list.contentIndent,
				});
				continue;
			}
			break;
		}

		const match = matchFence(line, cursor);
		if (match) {
			fence = {
				char: match.char,
				length: match.length,
				containers: containers.slice(),
				start: lineStart,
			};
			return;
		}

		scanInline(line, lineStart, cursor.index);
	};

	// One cursor reused across lines. The scan is synchronous, so the cursor
	// never escapes a call, and reusing it keeps the hot loop allocation-free.
	const cursor: Cursor = {
		index: 0,
		column: 0,
		pending: 0,
	};

	for (const line of source.split('\n')) {
		const lineStart = offset;
		offset = lineStart + line.length + 1;
		cursor.index = 0;
		cursor.column = 0;
		cursor.pending = 0;

		if (commentStart !== -1) {
			const close = line.indexOf(closeDelimiter);
			if (close === -1) {
				continue;
			}
			visit(commentStart, commentStart + openDelimiter.length, lineStart + close);
			commentStart = -1;
			scanInline(line, lineStart, close + closeDelimiter.length);
			continue;
		}

		if (fence) {
			// A blank line continues a fence inside a list item, but ends a fence
			// inside a blockquote, whose `>` marker the blank line lacks.
			if (isBlank(line) && !hasBlockquote(fence.containers)) {
				continue;
			}

			const matched = matchContainers(line, cursor, fence.containers);
			if (matched < fence.containers.length) {
				// The fence's container ended before this line, which ends the
				// unclosed block. Reprocess the line at the surviving level.
				const surviving = fence.containers.slice(0, matched);
				fence = undefined;
				containers.length = 0;
				containers.push(...surviving);
				openContainersAndScan(line, lineStart, cursor);
				continue;
			}

			const match = matchFence(line, cursor);
			if (
				match
				&& match.char === fence.char
				&& match.length >= fence.length
				&& line.slice(match.end).trim() === ''
			) {
				fence = undefined;
			}
			continue;
		}

		if (isBlank(line)) {
			continue;
		}

		containers.length = matchContainers(line, cursor, containers);
		openContainersAndScan(line, lineStart, cursor);
	}
};

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
	next: number;
};

const openDelimiter = '<!--';
const closeDelimiter = '-->';

const isBlank = (line: string) => line.trim() === '';

const countIndent = (line: string, index: number) => {
	let indent = 0;
	while (line[index + indent] === ' ') {
		indent += 1;
	}
	return indent;
};

/**
 * Matches a `>` blockquote marker after at most three spaces and returns the
 * index after it, or -1 when this level has no marker.
 */
const matchBlockquote = (line: string, start: number) => {
	let index = start;
	let spaces = 0;
	while (line[index] === ' ' && spaces < 3) {
		index += 1;
		spaces += 1;
	}

	if (line[index] !== '>') {
		return -1;
	}

	index += 1;
	if (line[index] === ' ') {
		index += 1;
	}
	return index;
};

/**
 * Matches a list item marker after at most three spaces. Returns the item's
 * content indentation and content start, or undefined when there is no marker.
 */
const matchListMarker = (line: string, start: number) => {
	let index = start;
	let spaces = 0;
	while (line[index] === ' ' && spaces < 4) {
		index += 1;
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

	let padding = 0;
	while (line[afterMarker + padding] === ' ') {
		padding += 1;
	}
	if (padding < 1 || padding > 4) {
		padding = 1;
	}

	return {
		contentIndent: spaces + markerWidth + padding,
		contentStart: afterMarker + padding,
	};
};

/**
 * Matches a fence opener after at most three spaces. A backtick fence whose
 * info string contains a backtick is rejected so inline code cannot open a
 * fence.
 */
const matchFence = (line: string, start: number) => {
	let index = start;
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
 * Matches the current block containers and returns how much of the line they
 * consume. `matched` is the number of containers that continue on this line.
 */
const matchContainers = (line: string, containers: Container[]) => {
	let contentOffset = 0;
	let matched = 0;

	for (const container of containers) {
		if (container.type === 'blockquote') {
			const next = matchBlockquote(line, contentOffset);
			if (next === -1) {
				break;
			}
			contentOffset = next;
		} else {
			if (countIndent(line, contentOffset) < container.indent) {
				break;
			}
			contentOffset += container.indent;
		}
		matched += 1;
	}

	return {
		contentOffset,
		matched,
	};
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
			next: -1,
		});
		// Only the first backtick is escaped; the rest form a run that can open.
		if (escaped && length > 1) {
			runs.set(index + 1, {
				start: index + 1,
				length: length - 1,
				escaped: false,
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
		lastByLength.set(run.length, run.start);
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

	const openContainersAndScan = (line: string, lineStart: number, start: number) => {
		let contentOffset = start;

		for (;;) {
			const blockquote = matchBlockquote(line, contentOffset);
			if (blockquote !== -1) {
				containers.push({ type: 'blockquote' });
				contentOffset = blockquote;
				continue;
			}

			const list = matchListMarker(line, contentOffset);
			if (list) {
				containers.push({
					type: 'listItem',
					indent: list.contentIndent,
				});
				contentOffset = list.contentStart;
				continue;
			}
			break;
		}

		const match = matchFence(line, contentOffset);
		if (match) {
			fence = {
				char: match.char,
				length: match.length,
				containers: containers.slice(),
				start: lineStart,
			};
			return;
		}

		scanInline(line, lineStart, contentOffset);
	};

	for (const line of source.split('\n')) {
		const lineStart = offset;
		offset = lineStart + line.length + 1;

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
			if (isBlank(line)) {
				continue;
			}

			const { contentOffset, matched } = matchContainers(line, fence.containers);
			if (matched < fence.containers.length) {
				// The fence's container ended before this line, which ends the
				// unclosed block. Reprocess the line at the surviving level.
				const surviving = fence.containers.slice(0, matched);
				fence = undefined;
				containers.length = 0;
				containers.push(...surviving);
				openContainersAndScan(line, lineStart, contentOffset);
				continue;
			}

			const match = matchFence(line, contentOffset);
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

		const { contentOffset, matched } = matchContainers(line, containers);
		containers.length = matched;
		openContainersAndScan(line, lineStart, contentOffset);
	}
};

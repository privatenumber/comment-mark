import {
	type Container,
	type Cursor,
	type Fence,
	closesFence,
	continueContainer,
	isBlank,
	isThematicBreak,
	matchBlockquote,
	matchFence,
	matchListMarker,
} from './block-context.js';

export type CommentVisitor = (
	start: number,
	innerStart: number,
	innerEnd: number,
) => void;

type BacktickRun = {
	start: number;
	length: number;
	escaped: boolean;
	synthetic: boolean;
	next: number;
};

const openDelimiter = '<!--';
const closeDelimiter = '-->';

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
 * The scan reads the source line by line and tracks block containers, fenced
 * code blocks, inline code spans, and HTML comments together. A comment inside
 * code is not visited, and code syntax inside a comment is not interpreted, so
 * the two cannot corrupt each other.
 *
 * Each line is processed in four ordered steps: continue the open containers,
 * continue or close an active fence, open new containers and leaf blocks, then
 * scan whatever content remains for comments and inline code.
 */
export const scanComments = (source: string, visit: CommentVisitor) => {
	const containers: Container[] = [];
	let fence: Fence | undefined;
	let commentStart = -1;
	let inParagraph = false;

	// One cursor reused across lines. The scan is synchronous, so the cursor
	// never escapes a call, and reusing it keeps the hot loop allocation-free.
	const cursor: Cursor = {
		index: 0,
		column: 0,
		pending: 0,
	};

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

	const scanLine = (line: string, lineStart: number) => {
		cursor.index = 0;
		cursor.column = 0;
		cursor.pending = 0;

		// A comment opened on an earlier line stays open until `-->`, so code
		// syntax inside it is never interpreted.
		if (commentStart !== -1) {
			const close = line.indexOf(closeDelimiter);
			if (close === -1) {
				return;
			}
			visit(commentStart, commentStart + openDelimiter.length, lineStart + close);
			commentStart = -1;
			scanInline(line, lineStart, close + closeDelimiter.length);
			return;
		}

		// Continue the open containers, outermost first. Each one reads the line
		// from where the previous stopped, so blankness is evaluated per level.
		let matched = 0;
		for (const container of containers) {
			if (!continueContainer(line, cursor, container)) {
				break;
			}
			matched += 1;
		}

		if (fence) {
			// A fence's containers must all continue. When one ends, so does the
			// unclosed fence, and this line is read again at the surviving level.
			if (matched < fence.depth) {
				fence = undefined;
				containers.length = matched;
			} else {
				if (closesFence(line, cursor, fence)) {
					fence = undefined;
				}
				return;
			}
		} else if (matched < containers.length) {
			containers.length = matched;
			// The dropped containers took their paragraph with them, so this line
			// may start a block that could not interrupt one.
			inParagraph = false;
		}

		if (isBlank(line, cursor.index)) {
			// A blank line ends the paragraph but leaves list items open.
			inParagraph = false;
			return;
		}

		// Open new containers. A thematic break takes precedence over a list.
		for (;;) {
			if (matchBlockquote(line, cursor)) {
				containers.push({ type: 'blockquote' });
				continue;
			}

			if (isThematicBreak(line, cursor)) {
				inParagraph = false;
				return;
			}

			const list = matchListMarker(line, cursor, inParagraph);
			if (!list) {
				break;
			}
			containers.push({
				type: 'listItem',
				indent: list.contentIndent,
			});
		}

		const match = matchFence(line, cursor);
		if (match) {
			fence = {
				char: match.char,
				length: match.length,
				depth: containers.length,
			};
			inParagraph = false;
			return;
		}

		inParagraph = true;
		scanInline(line, lineStart, cursor.index);
	};

	// Split on every line ending so a CR-only document is read as lines without
	// normalizing the source or shifting its offsets.
	let lineStart = 0;
	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];
		if (char !== '\n' && char !== '\r') {
			continue;
		}
		scanLine(source.slice(lineStart, index), lineStart);
		if (char === '\r' && source[index + 1] === '\n') {
			index += 1;
		}
		lineStart = index + 1;
	}
	scanLine(source.slice(lineStart), lineStart);
};

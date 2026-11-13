import {
	type Container,
	type Cursor,
	type Fence,
	type HtmlBlockEnd,
	closesFence,
	continueContainer,
	isBlank,
	isSetextUnderline,
	isThematicBreak,
	matchAtxHeading,
	matchBlockquote,
	matchFence,
	matchHtmlBlock,
	matchListMarker,
	skipBlockIndent,
} from './block-context.ts';

/**
 * An open HTML block: how it ends, and the number of containers it is nested
 * in, which must all continue for the block to continue.
 */
type HtmlBlock = {
	end: HtmlBlockEnd;
	depth: number;
};

export type CommentVisitor = (
	start: number,
	innerStart: number,
	innerEnd: number,
	continuation: string,
	startsLine: boolean,
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
 * Reports whether the line's content starts with an HTML comment, which
 * CommonMark treats as a block rather than paragraph text, indented up to three
 * columns. A block comment interrupts an open paragraph and leaves none open,
 * so a following ordered list is recognized and its fenced example stays code.
 */
const startsBlockComment = (line: string, cursor: Cursor) => {
	const index = skipBlockIndent(line, cursor);
	return index !== -1 && line.startsWith(openDelimiter, index);
};

/**
 * Reports whether the line continues the open paragraph, which an inline
 * comment needs in order to span lines. A blank line or the start of another
 * block ends the paragraph. `lazy` means some containers did not continue, as in
 * an unprefixed line after a `>` paragraph; such a line still continues the
 * paragraph, but cannot be a setext underline.
 */
const continuesParagraph = (line: string, cursor: Cursor, lazy: boolean) => (
	!isBlank(line, cursor.index)
	// The matchers below commit the cursor on success, so they get a copy.
	&& !matchBlockquote(line, { ...cursor })
	&& !isThematicBreak(line, cursor)
	&& (lazy || !isSetextUnderline(line, cursor))
	&& !matchListMarker(line, { ...cursor }, true)
	&& matchAtxHeading(line, cursor) === undefined
	&& !matchFence(line, { ...cursor })
	&& matchHtmlBlock(line, cursor) === undefined
);

/**
 * Reports whether the line's content, which starts at `contentStart` after any
 * container prefixes, holds one of the closers. A blockquote's `>` prefix must
 * not end a block whose closer is `>`.
 */
const closesHtmlBlock = (line: string, contentStart: number, closers: readonly string[]) => {
	const lower = line.toLowerCase();
	return closers.some(closer => lower.includes(closer, contentStart));
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
	let commentContinuation = '';
	let commentStartsLine = false;
	// Whether the open comment is paragraph text, which ends with its paragraph.
	// Otherwise it is raw HTML, which stays open until a line containing `-->`.
	let commentInParagraph = false;
	let inParagraph = false;
	// Inside an HTML block, a comment is raw HTML even when it does not start
	// the line.
	let htmlBlock: HtmlBlock | undefined;
	// Whether the line being scanned belongs to an HTML block.
	let lineInHtmlBlock = false;

	// One cursor reused across lines. The scan is synchronous, so the cursor
	// never escapes a call, and reusing it keeps the hot loop allocation-free.
	const cursor: Cursor = {
		index: 0,
		column: 0,
		pending: 0,
	};

	const scanInline = (line: string, lineStart: number, start: number, startsLine: boolean) => {
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
				// `<!-->` and `<!--->` are complete, empty comments in CommonMark and on
				// GitHub. They hold no tag, so they are skipped rather than opening a
				// comment that would run to the next `-->`.
				const emptyEnd = line.startsWith('>', index + 4)
					? index + 5
					: (line.startsWith('->', index + 4) ? index + 6 : -1);
				if (emptyEnd !== -1) {
					index = emptyEnd;
					continue;
				}

				const continuation = containers.length === 0
					? ''
					: containers.map(container => (
						container.type === 'blockquote' ? '> ' : ' '.repeat(container.indent)
					)).join('');
				const close = line.indexOf(closeDelimiter, index + openDelimiter.length);
				if (close === -1) {
					commentStart = lineStart + index;
					commentContinuation = continuation;
					commentStartsLine = startsLine;
					commentInParagraph = !startsLine && !lineInHtmlBlock;
					return;
				}
				visit(
					lineStart + index,
					lineStart + index + openDelimiter.length,
					lineStart + close,
					continuation,
					startsLine,
				);
				index = close + closeDelimiter.length;
				continue;
			}

			index += 1;
		}
	};

	/**
	 * Continues or ends the open HTML block for a line whose containers matched
	 * `matched` levels, and reports whether the line belongs to the block. A block
	 * that ends at a closer still includes the closer's line.
	 */
	const continueHtmlBlock = (line: string, contentStart: number, matched: number) => {
		if (!htmlBlock) {
			return false;
		}
		const { end, depth } = htmlBlock;
		if (matched < depth || (end === 'blankLine' && isBlank(line, contentStart))) {
			htmlBlock = undefined;
			return false;
		}
		if (end !== 'blankLine' && closesHtmlBlock(line, contentStart, end)) {
			htmlBlock = undefined;
		}
		return true;
	};

	const scanLine = (line: string, lineStart: number) => {
		cursor.index = 0;
		cursor.column = 0;
		cursor.pending = 0;

		// A comment in raw HTML stays open until a line containing `-->`, so code
		// syntax inside it is never interpreted.
		if (commentStart !== -1 && !commentInParagraph) {
			// Containers are not matched here, so they are assumed to continue.
			lineInHtmlBlock = continueHtmlBlock(line, 0, htmlBlock?.depth ?? 0);
			const close = line.indexOf(closeDelimiter);
			if (close === -1) {
				return;
			}
			visit(
				commentStart,
				commentStart + openDelimiter.length,
				lineStart + close,
				commentContinuation,
				commentStartsLine,
			);
			commentStart = -1;
			scanInline(line, lineStart, close + closeDelimiter.length, commentStartsLine);
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
		lineInHtmlBlock = continueHtmlBlock(line, cursor.index, matched);

		// A comment inside a line is paragraph text, so it spans only the lines that
		// continue its paragraph. On any other line the paragraph has ended, and
		// its `<!--` was literal text. A heading ends its paragraph on its own line,
		// so `inParagraph` is false after one.
		if (commentStart !== -1) {
			if (inParagraph && continuesParagraph(line, cursor, matched < containers.length)) {
				const close = line.indexOf(closeDelimiter, cursor.index);
				if (close === -1) {
					return;
				}
				visit(
					commentStart,
					commentStart + openDelimiter.length,
					lineStart + close,
					commentContinuation,
					false,
				);
				commentStart = -1;
				scanInline(line, lineStart, close + closeDelimiter.length, false);
				return;
			}
			commentStart = -1;
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

			// An underline converts the open paragraph into a heading, so it has
			// to be recognized before a leading `-` is read as a list marker.
			if (inParagraph && isSetextUnderline(line, cursor)) {
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

		// A heading is a leaf block, so it closes a paragraph instead of opening
		// one. Leaving a paragraph open would make a following ordered list look
		// like a paragraph interruption, and the list's fence would then expose
		// an example marker as real. Its content is scanned, so a marker written
		// in the heading is still found.
		const headingContent = matchAtxHeading(line, cursor);
		if (headingContent !== undefined) {
			inParagraph = false;
			scanInline(line, lineStart, headingContent, false);
			return;
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

		// A comment that starts a line is an HTML block, not paragraph text. It
		// interrupts an open paragraph and leaves none open, so a following
		// ordered list is recognized and its fenced example stays code.
		const blockComment = startsBlockComment(line, cursor);
		inParagraph = !blockComment;
		// A line such as `<div>` starts an HTML block, so a comment that opens
		// later in the block is raw HTML rather than paragraph text.
		if (!lineInHtmlBlock) {
			const end = matchHtmlBlock(line, cursor);
			if (end !== undefined) {
				lineInHtmlBlock = true;
				if (end === 'blankLine' || !closesHtmlBlock(line, cursor.index, end)) {
					htmlBlock = {
						end,
						depth: containers.length,
					};
				}
			}
		}
		scanInline(line, lineStart, cursor.index, blockComment);
	};

	// Lines end with LF, CRLF, or CR. Both searches only move forward, and the
	// one that was consumed is refreshed, so locating line boundaries stays
	// linear without a pattern. Every position is local to this invocation, so a
	// resolver that reenters the parser cannot disturb the outer scan.
	// Markdown parsers drop a leading byte order mark, so a comment after it
	// still starts the first line.
	let lineStart = source.startsWith('﻿') ? 1 : 0;
	let lineFeed = source.indexOf('\n', lineStart);
	let carriageReturn = source.indexOf('\r', lineStart);

	while (lineFeed !== -1 || carriageReturn !== -1) {
		let lineEnd: number;
		let endingLength: number;

		if (carriageReturn !== -1 && (lineFeed === -1 || carriageReturn < lineFeed)) {
			lineEnd = carriageReturn;
			endingLength = source[carriageReturn + 1] === '\n' ? 2 : 1;
		} else {
			lineEnd = lineFeed;
			endingLength = 1;
		}

		scanLine(source.slice(lineStart, lineEnd), lineStart);
		lineStart = lineEnd + endingLength;

		if (lineFeed !== -1 && lineFeed < lineStart) {
			lineFeed = source.indexOf('\n', lineStart);
		}
		if (carriageReturn !== -1 && carriageReturn < lineStart) {
			carriageReturn = source.indexOf('\r', lineStart);
		}
	}

	scanLine(source.slice(lineStart), lineStart);
};

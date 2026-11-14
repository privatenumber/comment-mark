import { isSpaceChar } from '../html-tag.ts';
import {
	parseListMarker,
	scanAtxHeadingStart,
	scanCloseFence,
	scanOpenFence,
	scanSetextHeadingLine,
	scanThematicBreak,
} from './block-starts.ts';
import { closesHtmlBlock, scanHtmlBlockStart } from './html-block.ts';
import { charAt, isSpaceOrTab, lineFeed } from './line.ts';
import { countDefinitionLines } from './reference-definition.ts';
import { readTableRow, scanTableStart } from './table.ts';

/**
 * The block phase: a port of the block parser in GitHub's renderer, cmark-gfm
 * 0.29.0.gfm.13, with its table extension. It builds no tree. It tracks the
 * open containers and the open leaf block, as `check_open_blocks`,
 * `open_new_blocks`, and `add_text_to_container` do, and reports the text of
 * each leaf block that can hold raw HTML:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/blocks.c#L1044-L1518
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/table.c#L189-L522
 *
 * Positions are source offsets. Lines end at LF, CR, or CRLF, and the line
 * ending reads as LF. Footnotes are not recognized.
 */

export type BlockHandlers = {

	/**
	 * Receives the text of a paragraph, heading, or table cell when the block
	 * ends, as `[start, end]` pairs, one per line.
	 */
	text: (segments: number[], continuation: string) => void;

	/**
	 * Receives each line of an HTML block as it is read. `afterMarkup` is true
	 * when the renderer writes markup of its own, such as `<p>` or `</li>`,
	 * between the previous HTML block line and this one.
	 */
	html: (start: number, end: number, afterMarkup: boolean, continuation: string) => void;
};

type Container =
	| { type: 'blockquote' }
	| {
		type: 'listItem';
		// The column where the item's content starts, relative to its parent.
		indent: number;
		hasChild: boolean;
	};

type Leaf =
	| {
		type: 'paragraph' | 'heading';
		segments: number[];
		continuation: string;
		// Set when the paragraph failed to become a table header.
		tableVisited: boolean;
	}
	| {
		type: 'fence';
		char: number;
		length: number;
		offset: number;
	}
	| { type: 'indentedCode' }
	| {
		type: 'html';
		kind: number;
		continuation: string;
	}
	| {
		type: 'table';
		columns: number;
		continuation: string;
	};

type TextLeaf = Extract<Leaf, { type: 'paragraph' | 'heading' }>;

/**
 * What a line's content was last attached to: an open container, the open
 * leaf, or a block that takes no text, such as a table row or a thematic break.
 */
type Target = 'container' | Leaf['type'] | 'row' | 'thematicBreak';

const tabStop = 4;
const codeIndent = 4;
const maxListDepth = 100;
export const lexBlocks = (source: string, handlers: BlockHandlers) => {
	const containers: Container[] = [];
	let leaf: Leaf | undefined;
	// Whether the renderer has written markup since the last HTML block line.
	// Opening or closing any block other than an HTML block writes markup.
	let markup = false;

	// The line being read, as cmark-gfm's parser fields. Every position from
	// `lineEnd` on reads as the line feed that ends the line.
	let lineEnd = 0;
	let offset = 0;
	let column = 0;
	let firstNonspace = 0;
	let firstNonspaceColumn = 0;
	let indent = 0;
	let blank = false;
	let partiallyConsumedTab = false;

	const peek = (index: number) => charAt(source, index, lineEnd);

	const findFirstNonspace = () => {
		let charsToTab = tabStop - (column % tabStop);
		if (firstNonspace <= offset) {
			firstNonspace = offset;
			firstNonspaceColumn = column;
			for (;;) {
				const code = peek(firstNonspace);
				if (code === 32) {
					firstNonspace += 1;
					firstNonspaceColumn += 1;
					charsToTab -= 1;
					if (charsToTab === 0) {
						charsToTab = tabStop;
					}
				} else if (code === 9) {
					firstNonspace += 1;
					firstNonspaceColumn += charsToTab;
					charsToTab = tabStop;
				} else {
					break;
				}
			}
		}
		indent = firstNonspaceColumn - column;
		blank = firstNonspace >= lineEnd;
	};

	/**
	 * Advances by `count` columns, or by `count` characters when `columns` is
	 * false. A tab advanced over partly leaves `offset` on it.
	 */
	const advance = (count: number, columns: boolean) => {
		while (count > 0 && offset <= lineEnd) {
			if (peek(offset) === 9) {
				const charsToTab = tabStop - (column % tabStop);
				if (columns) {
					partiallyConsumedTab = charsToTab > count;
					const advanced = Math.min(count, charsToTab);
					column += advanced;
					offset += partiallyConsumedTab ? 0 : 1;
					count -= advanced;
				} else {
					partiallyConsumedTab = false;
					column += charsToTab;
					offset += 1;
					count -= 1;
				}
			} else {
				partiallyConsumedTab = false;
				offset += 1;
				column += 1;
				count -= 1;
			}
		}
	};

	const continuation = () => {
		let prefix = '';
		for (const container of containers) {
			prefix += container.type === 'blockquote' ? '> ' : ' '.repeat(container.indent);
		}
		return prefix;
	};

	/**
	 * `resolve_reference_link_definitions`: drops the lines of the link
	 * reference definitions that start a paragraph. Returns whether text remains.
	 */
	const resolveDefinitions = (segments: number[]) => {
		if (source.charCodeAt(segments[0]) === 91) {
			let text = '';
			for (let index = 0; index < segments.length; index += 2) {
				text += `${source.slice(segments[index], segments[index + 1])}\n`;
			}
			segments.splice(0, countDefinitionLines(text) * 2);
		}
		return segments.length > 0;
	};

	const finalizeLeaf = () => {
		if (
			leaf?.type === 'heading'
			|| (leaf?.type === 'paragraph' && resolveDefinitions(leaf.segments))
		) {
			handlers.text(leaf.segments, leaf.continuation);
		}
		leaf = undefined;
	};

	const reportCells = (cells: number[], columns: number, prefix: string) => {
		const end = Math.min(cells.length, columns * 2);
		for (let index = 0; index < end; index += 2) {
			handlers.text([cells[index], cells[index + 1]], prefix);
		}
	};

	/**
	 * `try_opening_table_header`: the paragraph's last line becomes the header
	 * row when this line is a delimiter row with the same number of cells.
	 */
	const openTableHeader = (paragraph: TextLeaf) => {
		if (paragraph.tableVisited || !scanTableStart(source, firstNonspace, lineEnd)) {
			return false;
		}
		const delimiters = readTableRow(source, firstNonspace, lineEnd);
		if (!delimiters) {
			return false;
		}
		const { segments } = paragraph;
		const header = readTableRow(source, segments.at(-2)!, segments.at(-1)!);
		if (!header || header.length !== delimiters.length) {
			paragraph.tableVisited = true;
			return false;
		}

		// Earlier lines stay a paragraph before the table.
		if (segments.length > 2) {
			handlers.text(segments.slice(0, -2), paragraph.continuation);
		}
		reportCells(header, header.length / 2, paragraph.continuation);
		leaf = {
			type: 'table',
			columns: header.length / 2,
			continuation: paragraph.continuation,
		};
		advance(lineEnd - offset, false);
		return true;
	};

	const processLine = (lineStart: number, end: number) => {
		lineEnd = end;
		offset = lineStart;
		column = 0;
		firstNonspace = lineStart;
		firstNonspaceColumn = 0;
		indent = 0;
		blank = false;
		partiallyConsumedTab = false;
		// A leading byte order mark is skipped.
		if (lineStart === 0 && source.charCodeAt(0) === 0xFE_FF) {
			offset = 1;
		}

		// check_open_blocks: continue the open containers, outermost first.
		let matched = 0;
		for (; matched < containers.length; matched += 1) {
			findFirstNonspace();
			const container = containers[matched];
			if (container.type === 'blockquote') {
				if (indent > 3 || peek(firstNonspace) !== 62) {
					break;
				}
				advance(indent + 1, true);
				if (isSpaceOrTab(peek(offset))) {
					advance(1, true);
				}
			} else if (indent >= container.indent) {
				advance(container.indent, true);
			} else if (blank && container.hasChild) {
				advance(firstNonspace - offset, false);
			} else {
				break;
			}
		}

		let leafMatched = false;
		if (leaf && matched === containers.length) {
			findFirstNonspace();
			switch (leaf.type) {
				case 'fence': {
					if (
						indent <= 3
						&& peek(firstNonspace) === leaf.char
						&& scanCloseFence(source, firstNonspace, lineEnd) >= leaf.length
					) {
						// The closing fence ends the line.
						leaf = undefined;
						return;
					}
					for (let spaces = leaf.offset; spaces > 0 && isSpaceOrTab(peek(offset)); spaces -= 1) {
						advance(1, true);
					}
					leafMatched = true;
					break;
				}
				case 'indentedCode': {
					if (indent >= codeIndent) {
						advance(codeIndent, true);
						leafMatched = true;
					} else if (blank) {
						advance(firstNonspace - offset, false);
						leafMatched = true;
					}
					break;
				}
				case 'html': {
					leafMatched = leaf.kind <= 5 || !blank;
					break;
				}
				case 'paragraph': {
					leafMatched = !blank;
					break;
				}
				case 'table': {
					leafMatched = readTableRow(source, firstNonspace, lineEnd) !== undefined;
					break;
				}
				default: {
					// A heading holds one line.
					break;
				}
			}
		}
		// A table's open row never matches, so its lines are never all matched.
		const allMatched = matched === containers.length && (!leaf || (leafMatched && leaf.type !== 'table'));

		// Blocks that did not match close before any new block opens.
		let unmatchedClosed = false;
		const closeUnmatched = () => {
			if (unmatchedClosed) {
				return;
			}
			unmatchedClosed = true;
			markup ||= containers.length > matched;
			if (!leafMatched) {
				finalizeLeaf();
			}
			containers.length = matched;
		};

		let target: Target = leafMatched ? leaf!.type : 'container';
		let opened = false;
		const addChild = (writesMarkup = true) => {
			closeUnmatched();
			if (target !== 'container') {
				finalizeLeaf();
			}
			const parent = containers.at(-1);
			if (parent?.type === 'listItem') {
				parent.hasChild = true;
			}
			opened = true;
			target = 'container';
			markup ||= writesMarkup;
		};

		// open_new_blocks: `openBlock` tries each block start in order, and
		// returns whether one matched. Only the first block on a line may be a
		// lazy paragraph continuation instead of indented code.
		let lazyAllowed = leaf?.type === 'paragraph';
		const openBlock = (depth: number) => {
			findFirstNonspace();
			if (indent >= codeIndent) {
				if (lazyAllowed || blank) {
					return false;
				}
				advance(codeIndent, true);
				addChild();
				leaf = { type: 'indentedCode' };
				target = 'indentedCode';
				return true;
			}

			const char = peek(firstNonspace);
			if (char === 62) {
				advance(firstNonspace + 1 - offset, false);
				if (isSpaceOrTab(peek(offset))) {
					advance(1, true);
				}
				addChild();
				containers.push({ type: 'blockquote' });
				return true;
			}

			const headingLength = scanAtxHeadingStart(source, firstNonspace, lineEnd);
			if (headingLength) {
				advance(firstNonspace + headingLength - offset, false);
				addChild();
				leaf = {
					type: 'heading',
					segments: [],
					continuation: continuation(),
					tableVisited: false,
				};
				target = 'heading';
				return true;
			}

			const fenceLength = scanOpenFence(source, firstNonspace, lineEnd);
			if (fenceLength) {
				const fenceOffset = firstNonspace - offset;
				addChild();
				leaf = {
					type: 'fence',
					char,
					// cmark-gfm stores at most 255, so any longer run closes it.
					length: Math.min(fenceLength, 255),
					offset: fenceOffset,
				};
				advance(firstNonspace + fenceLength - offset, false);
				target = 'fence';
				return true;
			}

			const htmlKind = scanHtmlBlockStart(source, firstNonspace, lineEnd, target === 'paragraph');
			if (htmlKind) {
				// Only the blocks that this closes write markup before it.
				addChild(false);
				leaf = {
					type: 'html',
					kind: htmlKind,
					continuation: continuation(),
				};
				target = 'html';
				return true;
			}

			if (target === 'paragraph' && scanSetextHeadingLine(source, firstNonspace, lineEnd)) {
				// When only definitions precede it, the underline is paragraph text.
				const paragraph = leaf as TextLeaf;
				if (resolveDefinitions(paragraph.segments)) {
					paragraph.type = 'heading';
					advance(lineEnd - offset, false);
					target = 'heading';
				}
				return true;
			}

			if (!(target === 'paragraph' && !allMatched) && scanThematicBreak(source, firstNonspace, lineEnd)) {
				addChild();
				advance(lineEnd - offset, false);
				target = 'thematicBreak';
				return true;
			}

			const markerLength = depth < maxListDepth
				? parseListMarker(source, firstNonspace, lineEnd, target === 'paragraph')
				: 0;
			if (markerLength) {
				const markerOffset = indent;
				advance(firstNonspace + markerLength - offset, false);
				const savedOffset = offset;
				const savedColumn = column;
				const savedPartiallyConsumedTab: boolean = partiallyConsumedTab;
				while (column - savedColumn <= 5 && isSpaceOrTab(peek(offset))) {
					advance(1, true);
				}
				const spaces = column - savedColumn;
				let padding = markerLength + spaces;
				if (spaces >= 5 || spaces < 1 || offset >= lineEnd) {
					// One space is part of the marker; the rest is content.
					padding = markerLength + 1;
					offset = savedOffset;
					column = savedColumn;
					partiallyConsumedTab = savedPartiallyConsumedTab;
					if (spaces > 0) {
						advance(1, true);
					}
				}
				addChild();
				containers.push({
					type: 'listItem',
					indent: markerOffset + padding,
					hasChild: false,
				});
				return true;
			}

			if (target === 'paragraph') {
				if (!openTableHeader(leaf as TextLeaf)) {
					return false;
				}
				target = 'table';
				return true;
			}

			if (target === 'table' && !blank) {
				const cells = readTableRow(source, firstNonspace, lineEnd);
				if (!cells) {
					return false;
				}
				// A row is a child of the table, so the table stays open.
				closeUnmatched();
				opened = true;
				const table = leaf as Extract<Leaf, { type: 'table' }>;
				reportCells(cells, table.columns, table.continuation);
				advance(lineEnd - offset, false);
				target = 'row';
				return true;
			}
			return false;
		};

		for (let depth = 1; target !== 'fence' && target !== 'indentedCode' && target !== 'html'; depth += 1) {
			if (!openBlock(depth)) {
				break;
			}
			// `openBlock` changed `target`. A leaf that takes the line's text ends
			// the search.
			const openedTarget = target as Target;
			if (
				openedTarget === 'paragraph'
				|| openedTarget === 'heading'
				|| openedTarget === 'fence'
				|| openedTarget === 'indentedCode'
			) {
				break;
			}
			lazyAllowed = false;
		}

		// add_text_to_container
		findFirstNonspace();
		const contentStart = offset + (partiallyConsumedTab ? 1 : 0);

		// A lazy continuation line adds to the open paragraph without matching
		// the containers that hold it.
		if (!opened && leaf?.type === 'paragraph' && !leafMatched && !blank) {
			leaf.segments.push(contentStart, lineEnd);
			return;
		}

		closeUnmatched();
		switch (target) {
			case 'fence':
			case 'indentedCode': {
				return;
			}
			case 'html': {
				const html = leaf as Extract<Leaf, { type: 'html' }>;
				handlers.html(contentStart, lineEnd, markup, html.continuation);
				markup = false;
				if (html.kind <= 5 && closesHtmlBlock(source, firstNonspace, lineEnd, html.kind)) {
					leaf = undefined;
				}
				return;
			}
			default: {
				break;
			}
		}
		if (blank) {
			return;
		}

		if (target === 'paragraph' || target === 'heading') {
			const text = leaf as TextLeaf;
			// Only an ATX heading line reaches here as a heading: a setext
			// underline is blank by now. It drops its closing `#` sequence.
			const textEnd = target === 'heading'
				? chopClosingSequence(source, firstNonspace, lineEnd)
				: lineEnd;
			text.segments.push(firstNonspace, textEnd);
			return;
		}

		addChild();
		leaf = {
			type: 'paragraph',
			segments: [firstNonspace, lineEnd],
			continuation: continuation(),
			tableVisited: false,
		};
	};

	// Lines end with LF, CR, or CRLF. Both searches only move forward, and the
	// one that was consumed is refreshed, so finding line ends stays linear.
	let lineStart = 0;
	let lineFeedIndex = source.indexOf('\n');
	let carriageReturn = source.indexOf('\r');
	while (lineFeedIndex !== -1 || carriageReturn !== -1) {
		let end: number;
		let endingLength: number;
		if (carriageReturn !== -1 && (lineFeedIndex === -1 || carriageReturn < lineFeedIndex)) {
			end = carriageReturn;
			endingLength = source.charCodeAt(carriageReturn + 1) === lineFeed ? 2 : 1;
		} else {
			end = lineFeedIndex;
			endingLength = 1;
		}

		processLine(lineStart, end);
		lineStart = end + endingLength;

		if (lineFeedIndex !== -1 && lineFeedIndex < lineStart) {
			lineFeedIndex = source.indexOf('\n', lineStart);
		}
		if (carriageReturn !== -1 && carriageReturn < lineStart) {
			carriageReturn = source.indexOf('\r', lineStart);
		}
	}
	// cmark-gfm reads no line after a final line ending.
	if (lineStart < source.length) {
		processLine(lineStart, source.length);
	}
	finalizeLeaf();
};

/**
 * `chop_trailing_hashtags`: drops trailing whitespace, and a closing sequence of
 * `#` that follows a space or tab. Returns the new end.
 */
const chopClosingSequence = (source: string, start: number, end: number) => {
	while (end > start && isSpaceChar(source.charCodeAt(end - 1))) {
		end -= 1;
	}
	let hashes = end;
	while (hashes > start && source.charCodeAt(hashes - 1) === 35) {
		hashes -= 1;
	}
	if (hashes === start) {
		// Only the closing sequence remains; the opening one was already skipped.
		return start;
	}
	if (hashes === end || !isSpaceOrTab(source.charCodeAt(hashes - 1))) {
		return end;
	}
	while (hashes > start && isSpaceChar(source.charCodeAt(hashes - 1))) {
		hashes -= 1;
	}
	return hashes;
};

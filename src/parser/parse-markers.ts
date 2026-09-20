import { isNameChar, skipWhitespace } from './characters.js';
import { parseAttributes } from './parse-attributes.js';
import { scanComments } from './scan-comments.js';

export type CommentMark = {
	id?: string;
	attributes: Record<string, string>;
	content: string;
};

export type MarkVisitor = (
	mark: CommentMark,
	contentStart: number,
	contentEnd: number,
) => void;

type ActiveMarker = {
	id?: string;
	attributes: Record<string, string>;
	contentStart: number;
};

const keyword = 'comment-mark';
const openDelimiter = '<!--';
const closeDelimiter = '-->';

/**
 * Visits markers in document order, with the offsets that bound each marker's
 * content.
 *
 * Markers inside fenced code blocks or single-line inline code spans are
 * ignored, and both the opening and closing comments must sit outside code.
 * Indented code blocks and code spans that wrap across lines are not
 * recognized.
 */
export const parseMarks = (source: string, visit: MarkVisitor) => {
	if (!source.includes(openDelimiter)) {
		return;
	}

	let active: ActiveMarker | undefined;

	scanComments(source, (start, innerStart, innerEnd) => {
		const index = skipWhitespace(source, innerStart, innerEnd);

		if (source[index] === '/') {
			const after = skipWhitespace(source, index + 1, innerEnd);
			if (
				!source.startsWith(keyword, after)
				|| after + keyword.length > innerEnd
				|| skipWhitespace(source, after + keyword.length, innerEnd) !== innerEnd
			) {
				return;
			}

			if (active) {
				const { id, attributes, contentStart } = active;
				const content = source.slice(contentStart, start);

				// The id leads the object because read mode prints its keys in order.
				const mark: CommentMark = id === undefined
					? {
						attributes,
						content,
					}
					: {
						id,
						attributes,
						content,
					};
				visit(mark, contentStart, start);
				active = undefined;
			}
			return;
		}

		if (!source.startsWith(keyword, index) || index + keyword.length > innerEnd) {
			return;
		}
		const after = index + keyword.length;
		if (after !== innerEnd && isNameChar(source[after])) {
			return;
		}

		const { id, ...attributes } = parseAttributes(source, after, innerEnd);
		const markerId = id || undefined;
		if (active) {
			const label = markerId === undefined ? 'without an id' : JSON.stringify(markerId);
			throw new Error(`[comment-mark] Nested marker ${label} is not supported`);
		}
		active = {
			id: markerId,
			attributes,
			contentStart: innerEnd + closeDelimiter.length,
		};
	});

	if (active) {
		const label = active.id === undefined ? 'without an id' : JSON.stringify(active.id);
		throw new Error(`[comment-mark] No closing comment found for marker ${label}`);
	}
};

/**
 * Collects every marker in document order, including markers without an `id`.
 * Internal to the package: the CLI's read mode exposes this shape as JSON, but
 * the JavaScript API only reads content by `id` through `getCommentMarks`.
 */
export const getCommentMarkers = (source: string): CommentMark[] => {
	const markers: CommentMark[] = [];

	parseMarks(source, (mark) => {
		markers.push(mark);
	});

	return markers;
};

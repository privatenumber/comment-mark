import {
	isNameChar,
	isNameStart,
	isWhitespace,
	skipWhitespace,
} from './characters.ts';
import { type Attribute, parseAttributeNodes } from './parse-attributes.ts';
import { scanComments } from './scan-comments.ts';

export type MarkerNode = {
	tagName: string;
	attributes: Attribute[];
	// The opening comment, from its `<` through its closing `-->`.
	openingStart: number;
	contentStart: number;
	contentEnd: number;
	// Where the attributes begin, so a rewrite can insert new ones after the
	// tag name and drop the whitespace a removed attribute was written with.
	attributesStart: number;
};

type CommentKind =
	| { type: 'opener';
		tagName: string;
		attributesStart: number; }
	| { type: 'closer';
		tagName: string; }
	| { type: 'other' };

const openDelimiter = '<!--';
const closeDelimiter = '-->';

const readTagName = (source: string, index: number, end: number) => {
	if (index >= end || !isNameStart(source[index])) {
		return undefined;
	}

	const start = index;
	index += 1;
	while (index < end && isNameChar(source[index])) {
		index += 1;
	}
	return {
		name: source.slice(start, index),
		end: index,
	};
};

/**
 * Classifies a comment's inner text. A tag name must be followed by whitespace
 * or the end of the comment, so `<!-- TODO: fix -->` and `<!-- 1 + 1 -->` stay
 * ordinary comments instead of failing as malformed markers. A closing comment
 * is only a tag name, so `<!-- /a extra -->` stays ordinary text rather than
 * closing `a` and leaving `extra` unread.
 */
const classifyComment = (source: string, innerStart: number, innerEnd: number): CommentKind => {
	let index = skipWhitespace(source, innerStart, innerEnd);
	if (index >= innerEnd) {
		return { type: 'other' };
	}

	let closing = false;
	if (source[index] === '/') {
		closing = true;
		index = skipWhitespace(source, index + 1, innerEnd);
	}

	const tag = readTagName(source, index, innerEnd);
	if (!tag) {
		return { type: 'other' };
	}

	if (closing) {
		if (skipWhitespace(source, tag.end, innerEnd) < innerEnd) {
			return { type: 'other' };
		}
		return {
			type: 'closer',
			tagName: tag.name,
		};
	}

	if (tag.end < innerEnd && !isWhitespace(source[tag.end])) {
		return { type: 'other' };
	}

	return {
		type: 'opener',
		tagName: tag.name,
		attributesStart: tag.end,
	};
};

type Opener = {
	kind: Extract<CommentKind, { type: 'opener' }>;
	openingStart: number;
	openingEnd: number;
	closerStart: number;
	matched: boolean;
	// The opener below this one in the open stack, and the nearest earlier
	// opener with the same tag name. A closer finds its opener through
	// `previousSameTag` and drops the skipped openers through `previousOpen`,
	// so a document that opens many comments and closes none stays linear.
	previousOpen: Opener | undefined;
	previousSameTag: Opener | undefined;
};

/**
 * Collects the outermost paired tag markers in document order.
 *
 * A marker is an opening comment and a later closing comment with the same tag
 * name. Any other comment stays ordinary text, so `<!-- TODO -->` is never
 * treated as an unfinished marker.
 *
 * A matched pair nested inside another matched pair is skipped. The outer
 * marker's content already spans it, so it is not part of the marker set that
 * readers and replacements see. Content inserted into a section can therefore
 * contain markers of its own without changing which markers the document has.
 */
export const parseDocument = (source: string): MarkerNode[] => {
	if (!source.includes(openDelimiter)) {
		return [];
	}

	const openers: Opener[] = [];
	const topByTag = new Map<string, Opener | undefined>();
	let openTop: Opener | undefined;

	scanComments(source, (start, innerStart, innerEnd) => {
		const kind = classifyComment(source, innerStart, innerEnd);

		if (kind.type === 'closer') {
			// Close the innermost opener with this tag name. Openers above it
			// are comments the closer was written after, so they are dropped
			// instead of breaking the marker they sit inside.
			const opener = topByTag.get(kind.tagName);
			if (!opener) {
				return;
			}

			let dropped = openTop;
			while (dropped && dropped !== opener) {
				topByTag.set(dropped.kind.tagName, dropped.previousSameTag);
				dropped = dropped.previousOpen;
			}

			opener.matched = true;
			opener.closerStart = start;
			topByTag.set(opener.kind.tagName, opener.previousSameTag);
			openTop = opener.previousOpen;
			return;
		}

		if (kind.type === 'opener') {
			const opener: Opener = {
				kind,
				openingStart: start,
				openingEnd: innerEnd,
				closerStart: -1,
				matched: false,
				previousOpen: openTop,
				previousSameTag: topByTag.get(kind.tagName),
			};
			openers.push(opener);
			topByTag.set(kind.tagName, opener);
			openTop = opener;
		}
	});

	// A matched marker is nested when it opens before an earlier matched marker
	// closes. Matched markers are in opening order, so one stack detects
	// containment without walking a parent chain per marker. Only the outermost
	// markers reach the stack, so a marker under an open one is skipped instead
	// of being reported.
	const markers: MarkerNode[] = [];
	const ancestors: Opener[] = [];

	for (const opener of openers) {
		if (!opener.matched) {
			continue;
		}

		while (ancestors.length > 0) {
			const ancestor = ancestors.at(-1);
			if (!ancestor || ancestor.closerStart >= opener.openingStart) {
				break;
			}
			ancestors.pop();
		}

		// A nested marker stays inside the outer marker's content, so it is not
		// a marker this document exposes.
		if (ancestors.length > 0) {
			continue;
		}
		ancestors.push(opener);

		markers.push({
			tagName: opener.kind.tagName,
			attributes: parseAttributeNodes(source, opener.kind.attributesStart, opener.openingEnd),
			openingStart: opener.openingStart,
			contentStart: opener.openingEnd + closeDelimiter.length,
			contentEnd: opener.closerStart,
			attributesStart: opener.kind.attributesStart,
		});
	}

	return markers;
};

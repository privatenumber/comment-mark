import {
	isNameChar,
	isNameStart,
	isWhitespace,
	skipWhitespace,
} from './characters.js';
import { type Attribute, parseAttributeNodes } from './parse-attributes.js';
import { scanComments } from './scan-comments.js';

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
 * ordinary comments instead of failing as malformed markers.
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
	if (!tag || (tag.end < innerEnd && !isWhitespace(source[tag.end]))) {
		return { type: 'other' };
	}

	return closing
		? {
			type: 'closer',
			tagName: tag.name,
		}
		: {
			type: 'opener',
			tagName: tag.name,
			attributesStart: tag.end,
		};
};

type Opener = {
	kind: Extract<CommentKind, { type: 'opener' }>;
	openingStart: number;
	openingEnd: number;
	parent: Opener | undefined;
	closerStart: number;
	matched: boolean;
};

/**
 * Collects the paired tag markers in document order.
 *
 * A marker is an opening comment and a later closing comment with the same tag
 * name. Any other comment stays ordinary text, so `<!-- TODO -->` is never
 * treated as an unfinished marker. A matched pair nested inside another matched
 * pair aborts parsing, because replacing the outer marker's content would
 * overwrite the inner marker's comments.
 */
export const parseDocument = (source: string): MarkerNode[] => {
	if (!source.includes(openDelimiter)) {
		return [];
	}

	const openers: Opener[] = [];
	const stack: Opener[] = [];

	scanComments(source, (start, innerStart, innerEnd) => {
		const kind = classifyComment(source, innerStart, innerEnd);

		if (kind.type === 'closer') {
			// Close the innermost opener with this tag name. Openers above it
			// are comments the closer was written after, so they are dropped
			// instead of breaking the marker they sit inside.
			const index = stack.findLastIndex(opener => opener.kind.tagName === kind.tagName);
			if (index !== -1) {
				const [opener] = stack.splice(index);
				opener.matched = true;
				opener.closerStart = start;
			}
			return;
		}

		if (kind.type === 'opener') {
			const opener: Opener = {
				kind,
				openingStart: start,
				openingEnd: innerEnd,
				parent: stack.at(-1),
				closerStart: -1,
				matched: false,
			};
			openers.push(opener);
			stack.push(opener);
		}
	});

	const markers: MarkerNode[] = [];
	for (const opener of openers) {
		if (!opener.matched) {
			continue;
		}

		if (opener.parent?.matched) {
			throw new Error(
				`[comment-mark] Nested marker ${JSON.stringify(opener.kind.tagName)} is not supported`,
			);
		}

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

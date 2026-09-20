import {
	type CommentDocument,
	type CommentMarkReplacement,
	applyReplacements,
	toDocument,
} from './document.js';

export type {
	CommentDocument,
	CommentMark,
	CommentMarkData,
	CommentMarkReplacement,
	CommentMarkValue,
} from './document.js';

export { createDocument } from './document.js';

/**
 * Replaces marked sections in `input`, which may be source text or a document
 * from `createDocument`. Passing a document updates that document and returns
 * its rendered source; passing text parses it, applies the replacements, and
 * returns the result.
 */
export const commentMark = (
	input: string | Buffer | CommentDocument,
	replacements: Record<string, CommentMarkReplacement>,
) => {
	if (
		!input
		|| replacements === null
		|| replacements === undefined
		|| typeof replacements !== 'object'
	) {
		return input;
	}

	const document = toDocument(input);
	applyReplacements(document, replacements);
	return document.toString();
};

/**
 * Returns the first marker matching `selector`, or null.
 */
export const getCommentMark = (input: string | Buffer | CommentDocument, selector: string) => (
	toDocument(input).querySelector(selector)
);

/**
 * Returns every marker matching `selector` in document order. Without a
 * selector, returns every recognized marker.
 */
export const getCommentMarkAll = (input: string | Buffer | CommentDocument, selector?: string) => (
	toDocument(input).querySelectorAll(selector)
);

/**
 * Returns marker content keyed by tag name. Duplicate tag names collapse to the
 * last occurrence; use `getCommentMarkAll` for every occurrence and its
 * attributes.
 */
export const getCommentMarks = (
	input: string | Buffer | CommentDocument,
): Record<string, string> => {
	// Null-prototype dictionary so tag names never collide with inherited properties.
	const commentMarks: Record<string, string> = Object.create(null);

	for (const mark of getCommentMarkAll(input)) {
		commentMarks[mark.tagName] = mark.content;
	}

	return commentMarks;
};

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
): string => {
	if (
		!input
		|| replacements === null
		|| replacements === undefined
		|| typeof replacements !== 'object'
	) {
		// Invalid arguments are a no-op for JavaScript callers, mirroring the
		// pre-document API by returning the input unchanged. Typed callers
		// cannot reach this branch, so the string return still describes every
		// supported call.
		return input as string;
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

import {
	type CommentMarkData,
	type CommentMarkReplacement,
	applyReplacements,
	createDocument,
	markerData,
	renderDocument,
	selectMarkers,
} from './document.js';

export type { CommentMarkData } from './document.js';

/**
 * Replaces marked sections in `input` and returns the updated source.
 */
export const commentMark = (
	input: string | Buffer,
	replacements: Record<string, CommentMarkReplacement>,
): string => {
	if (
		!input
		|| replacements === null
		|| replacements === undefined
		|| typeof replacements !== 'object'
	) {
		// Invalid arguments are a no-op for JavaScript callers, returning the
		// input unchanged. Typed callers cannot reach this branch, so the
		// string return still describes every supported call.
		return input as string;
	}

	const document = createDocument(input);
	applyReplacements(document, replacements);
	return renderDocument(document);
};

/**
 * Returns the first marker matching `selector`, or null.
 */
export const getCommentMark = (
	input: string | Buffer,
	selector: string,
): CommentMarkData | null => {
	const [first] = selectMarkers(createDocument(input), selector);
	return first ? markerData(first) : null;
};

/**
 * Returns every marker matching `selector` in document order. Without a
 * selector, returns every recognized marker.
 */
export const getCommentMarkAll = (input: string | Buffer, selector?: string): CommentMarkData[] => (
	selectMarkers(createDocument(input), selector).map(markerData)
);

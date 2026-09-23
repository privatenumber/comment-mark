import {
	type CommentMarkData,
	type CommentMarkReplacement,
	applyReplacements,
	createDocument,
	markerData,
	renderDocument,
	selectMarkers,
} from './document.ts';

export type { CommentMarkData } from './document.ts';

/**
 * Replaces marked sections in `input` and returns the updated source.
 */
export const commentMark = (
	input: string | Buffer,
	replacements: Record<string, CommentMarkReplacement>,
): string => {
	if (
		(typeof input !== 'string' && !Buffer.isBuffer(input))
		|| typeof replacements !== 'object'
		|| replacements === null
	) {
		// Invalid arguments are a no-op for JavaScript callers, returning the
		// input unchanged. An empty string is valid input, so it still reaches
		// the parser and its validation.
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

import {
	type CommentMarkData,
	type CommentMarkReplacement,
	applyReplacements,
	createDocument,
	markerData,
	renderDocument,
	selectMarkers,
} from './document.ts';
import { parseDocument } from './parser/parse-document.ts';

export type { CommentMarkData, CommentMarkReplacement } from './document.ts';

/**
 * Replaces marked sections in `input` and returns the updated source.
 *
 * Returns a promise, so a resolver can read a file or do other async work. All
 * selectors are validated before any resolver runs, and resolvers run in
 * document order.
 */
export const commentMark = async (
	input: string | Buffer,
	replacements: Record<string, CommentMarkReplacement>,
): Promise<string> => {
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
	await applyReplacements(document, replacements);
	if (!document.markers.some(marker => marker.changed)) {
		return document.source;
	}
	const boundaries: Array<[number, number]> = [];
	const output = renderDocument(document, boundaries);
	if (output === document.source) {
		return output;
	}
	let valid = false;
	try {
		const markers = parseDocument(output);
		valid = markers.length === document.markers.length && markers.every((marker, index) => (
			marker.tagName === document.markers[index].node.tagName
			&& marker.startsLine === document.markers[index].node.startsLine
			&& marker.continuation === document.markers[index].node.continuation
			&& marker.openingStart === boundaries[index][0]
			&& marker.contentEnd === boundaries[index][1]
		));
	} catch (error) {
		// Replacement text can also expose a malformed marker.
		if (!(error instanceof Error && error.message.startsWith('[comment-mark] '))) {
			throw error;
		}
	}
	if (!valid) {
		const selectors = new Set<string>();
		for (const [index, state] of document.markers.entries()) {
			const original = document.source.slice(state.node.openingStart, state.node.contentEnd);
			if (
				state.selectorText !== undefined
				&& output.slice(...boundaries[index]) !== original
			) {
				selectors.add(state.selectorText);
			}
		}
		throw new Error(`[comment-mark] Replacement for ${[...selectors].map(selector => JSON.stringify(selector)).join(', ')} would change the document's markers`);
	}
	return output;
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

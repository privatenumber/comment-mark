import { type MarkerNode, parseDocument } from './parser/parse-document.js';
import { type Selector, parseSelector } from './parser/parse-selector.js';

export type CommentMarkData = {
	tagName: string;
	attributes: Record<string, string>;
	content: string;
};

// A replacement is the new content. `null` and `undefined` consume their
// position without replacing anything, which is what an array entry needs to
// skip one match and reach the next.
export type CommentMarkValue = string | null | undefined;

export type CommentMarkReplacement = CommentMarkValue | readonly CommentMarkValue[];

export type MarkerState = {
	index: number;
	source: string;
	node: MarkerNode;
	// The replacement content, or `undefined` while the marker is untouched.
	content: string | undefined;
};

/**
 * The result of parsing `input`: the source text plus one state per marker, in
 * document order. Applying replacements records them on the states, and
 * rendering reads the source back around the recorded spans, so a document is
 * parsed once and never re-read.
 */
export type CommentDocument = {
	source: string;
	markers: MarkerState[];
};

const currentContent = (state: MarkerState) => (
	state.content ?? state.source.slice(state.node.contentStart, state.node.contentEnd)
);

const currentAttributes = (state: MarkerState) => Object.fromEntries(
	state.node.attributes.map(attribute => [attribute.name, attribute.value]),
);

export const markerData = (state: MarkerState): CommentMarkData => ({
	tagName: state.node.tagName,
	attributes: currentAttributes(state),
	content: currentContent(state),
});

const matchesSelector = (state: MarkerState, selector: Selector) => {
	if (state.node.tagName !== selector.tagName) {
		return false;
	}

	return selector.attributes.every(({ name, value }) => {
		const attribute = state.node.attributes.find(candidate => candidate.name === name);
		if (!attribute) {
			return false;
		}
		return value === undefined || attribute.value === value;
	});
};

export const selectMarkers = (document: CommentDocument, selectorText: string | undefined) => {
	if (selectorText === undefined) {
		return document.markers.slice();
	}

	const selector = parseSelector(selectorText);
	return document.markers.filter(state => matchesSelector(state, selector));
};

export const renderDocument = (document: CommentDocument) => {
	const { source } = document;
	let output = '';
	let cursor = 0;

	for (const state of document.markers) {
		if (state.content === undefined) {
			continue;
		}

		output += source.slice(cursor, state.node.contentStart);
		output += state.content;
		cursor = state.node.contentEnd;
	}

	return output + source.slice(cursor);
};

export const createDocument = (input: string | Buffer): CommentDocument => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;
	return {
		source,
		markers: parseDocument(source).map((node, index): MarkerState => ({
			index,
			source,
			node,
			content: undefined,
		})),
	};
};

/**
 * Applies `replacements` to a document. Every selector is resolved before any
 * replacement is applied, so one replacement cannot change which markers the
 * others target. A scalar replaces the first match and an array replaces
 * matches by position; giving more values than matches, or targeting one marker
 * from two selectors, is an error rather than a silent partial update.
 */
export const applyReplacements = (
	document: CommentDocument,
	replacements: Record<string, CommentMarkReplacement>,
) => {
	const claims: Array<{ state: MarkerState;
		value: string; }> = [];
	const claimed = new Map<MarkerState, string>();

	for (const [selectorText, replacement] of Object.entries(replacements)) {
		const matches = selectMarkers(document, selectorText);
		const positional = Array.isArray(replacement);

		if (positional && replacement.length > matches.length) {
			throw new Error(
				`[comment-mark] Selector ${JSON.stringify(selectorText)} matched ${matches.length} marker${matches.length === 1 ? '' : 's'} but received ${replacement.length} values`,
			);
		}

		// A selector with no matching marker is skipped, like a key with no
		// marker always was. Only an explicit array has to fit its matches.
		if (matches.length === 0) {
			continue;
		}

		const values = positional ? replacement : [replacement];

		values.forEach((value, index) => {
			if (value === null || value === undefined) {
				return;
			}

			const state = matches[index];
			const owner = claimed.get(state);
			if (owner !== undefined) {
				throw new Error(
					`[comment-mark] Selectors ${JSON.stringify(owner)} and ${JSON.stringify(selectorText)} both target the marker ${JSON.stringify(state.node.tagName)}`,
				);
			}

			claimed.set(state, selectorText);
			claims.push({
				state,
				value,
			});
		});
	}

	// Apply in document order so the result does not depend on key order.
	claims.sort((a, b) => a.state.index - b.state.index);

	for (const { state, value } of claims) {
		// A multiline static value keeps its surrounding newlines.
		state.content = value.includes('\n') ? `\n${value}\n` : value;
	}
};

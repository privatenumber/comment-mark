import { type MarkerNode, parseDocument } from './parser/parse-document.js';
import { type Selector, parseSelector } from './parser/parse-selector.js';

export type CommentMarkData = {
	tagName: string;
	attributes: Record<string, string>;
	content: string;
};

export type CommentMark = {
	readonly tagName: string;
	content: string;
	readonly attributes: Record<string, string>;
	getAttribute(name: string): string | null;
	hasAttribute(name: string): boolean;
	toJSON(): CommentMarkData;
};

export type CommentDocument = {
	querySelector(selector: string): CommentMark | null;
	querySelectorAll(selector?: string): CommentMark[];
	toString(): string;
};

// A replacement is the new content. `null` and `undefined` consume their
// position without replacing anything, which is what an array entry needs to
// skip one match and reach the next.
export type CommentMarkValue = string | null | undefined;

export type CommentMarkReplacement = CommentMarkValue | readonly CommentMarkValue[];

type MarkerState = {
	index: number;
	source: string;
	node: MarkerNode;
	content: string | undefined;
	mark: CommentMark | undefined;
};

const documentStates = new WeakMap<object, MarkerState[]>();

const currentContent = (state: MarkerState) => (
	state.content ?? state.source.slice(state.node.contentStart, state.node.contentEnd)
);

const currentAttributes = (state: MarkerState) => Object.fromEntries(
	state.node.attributes.map(attribute => [attribute.name, attribute.value]),
);

// Methods stay out of enumeration so a marker's own shape is its data.
const markMethods = ['getAttribute', 'hasAttribute', 'toJSON'] as const;

const toMark = (state: MarkerState): CommentMark => {
	if (state.mark) {
		return state.mark;
	}

	// A marker closes over its own state, so it stays valid without the document
	// having to resolve it again.
	const mark = {
		tagName: state.node.tagName,
		get content() {
			return currentContent(state);
		},
		set content(value: string) {
			state.content = value;
		},
		get attributes() {
			return currentAttributes(state);
		},
		getAttribute: (name: string) => {
			const attribute = state.node.attributes.find(candidate => candidate.name === name);
			return attribute ? attribute.value : null;
		},
		hasAttribute: (name: string) => (
			state.node.attributes.some(attribute => attribute.name === name)
		),
		toJSON: () => ({
			tagName: state.node.tagName,
			attributes: currentAttributes(state),
			content: currentContent(state),
		}),
	};

	for (const key of markMethods) {
		Object.defineProperty(mark, key, { enumerable: false });
	}

	state.mark = mark;
	return mark;
};

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

const selectStates = (states: MarkerState[], selectorText: string | undefined) => {
	if (selectorText === undefined) {
		return states.slice();
	}

	const selector = parseSelector(selectorText);
	return states.filter(state => matchesSelector(state, selector));
};

const renderDocument = (source: string, states: MarkerState[]) => {
	let output = '';
	let cursor = 0;

	for (const state of states) {
		if (state.content === undefined) {
			continue;
		}

		output += source.slice(cursor, state.node.contentStart);
		output += state.content;
		cursor = state.node.contentEnd;
	}

	return output + source.slice(cursor);
};

/**
 * Parses `input` once and returns a document whose markers can be queried by
 * selector. Reusing the document keeps the parsed offsets valid, so a query
 * never re-reads the source.
 */
export const createDocument = (input: string | Buffer): CommentDocument => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;
	const states = parseDocument(source).map((node, index): MarkerState => ({
		index,
		source,
		node,
		content: undefined,
		mark: undefined,
	}));

	const document: CommentDocument = {
		querySelector: (selector) => {
			const [first] = selectStates(states, selector);
			return first ? toMark(first) : null;
		},
		querySelectorAll: selector => (
			selectStates(states, selector).map(toMark)
		),
		toString: () => renderDocument(source, states),
	};

	documentStates.set(document, states);
	return document;
};

export const isCommentDocument = (value: unknown): value is CommentDocument => (
	typeof value === 'object' && value !== null && documentStates.has(value)
);

/**
 * Returns `input` as a document, parsing it when it is source text. A document
 * that is already parsed is reused so its offsets stay valid.
 */
export const toDocument = (input: string | Buffer | CommentDocument): CommentDocument => (
	isCommentDocument(input) ? input : createDocument(input)
);

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
	const states = documentStates.get(document);
	if (!states) {
		throw new Error('[comment-mark] Marker does not belong to a document');
	}

	const claims: Array<{ state: MarkerState;
		value: string; }> = [];
	const claimed = new Map<MarkerState, string>();

	for (const [selectorText, replacement] of Object.entries(replacements)) {
		const matches = selectStates(states, selectorText);
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

import {
	encodeAttributeValue,
	isAttributeName,
} from './parser/parse-attributes.ts';
import { type MarkerNode, parseDocument } from './parser/parse-document.ts';
import { type Selector, parseSelector } from './parser/parse-selector.ts';

export type CommentMarkData = {
	tagName: string;
	attributes: Record<string, string>;
	content: string;
};

export type CommentMarkUpdate = {
	attributes?: Record<string, string> | undefined;
	content?: string | undefined;
};

export type CommentMarkResolverResult = string | CommentMarkUpdate | null | undefined;

export type CommentMarkResolver = (
	attributes: Record<string, string>,
	content: string,
) => CommentMarkResolverResult | Promise<CommentMarkResolverResult>;

// A replacement is the new content, an update object that replaces the
// attributes and content it names, or a resolver that computes either from the
// marker's current values. `null` and `undefined` consume their position
// without replacing anything, which is what an array entry needs to skip one
// match and reach the next.
export type CommentMarkValue = string | CommentMarkUpdate | CommentMarkResolver | null | undefined;

export type CommentMarkReplacement = CommentMarkValue | readonly CommentMarkValue[];

export type MarkerState = {
	index: number;
	source: string;
	node: MarkerNode;
	// Current attribute values in document order. `null` marks a removal.
	values: Map<string, string | null>;
	// The replacement content, or `undefined` while the marker is untouched.
	content: string | undefined;
	changed: boolean;
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

const currentAttributes = (state: MarkerState) => {
	const attributes: Array<[string, string]> = [];
	for (const [name, value] of state.values) {
		if (value !== null) {
			attributes.push([name, value]);
		}
	}
	return Object.fromEntries(attributes);
};

const setContent = (state: MarkerState, content: string) => {
	state.content = content;
	state.changed = true;
};

const originalAttribute = (state: MarkerState, name: string) => (
	state.node.attributes.find(attribute => attribute.name === name)
);

// Reading rejects the same names and values, so writing an unchecked one would
// produce a marker that cannot be read again.
const assertAttribute = (state: MarkerState, name: string, value: string) => {
	if (!isAttributeName(name)) {
		throw new Error(`[comment-mark] Invalid attribute name: ${JSON.stringify(name)}`);
	}
	encodeAttributeValue(value, originalAttribute(state, name)?.quote);
};

/**
 * Replaces the marker's attribute set. The map is the complete set, so an
 * attribute left out is removed; spread the attributes a resolver received to
 * keep them.
 */
const replaceAttributes = (state: MarkerState, attributes: Record<string, string>) => {
	const entries = Object.entries(attributes);

	// Validate every name and value before changing any, so a rejected
	// replacement leaves the marker's attributes as they were.
	for (const [name, value] of entries) {
		assertAttribute(state, name, value);
	}

	for (const name of state.values.keys()) {
		state.values.set(name, null);
	}

	for (const [name, value] of entries) {
		state.values.set(name, value);
	}

	state.changed = true;
};

const renderOpeningTag = (state: MarkerState) => {
	const { source, node } = state;
	const written = new Set(node.attributes.map(attribute => attribute.name));
	// The tag name and its padding are always kept; new attributes are inserted
	// after them.
	const parts: string[] = [source.slice(node.openingStart, node.attributesStart)];
	let cursor = node.attributesStart;

	for (const attribute of node.attributes) {
		const value = state.values.get(attribute.name);
		if (value === null || value === undefined) {
			// Drop the attribute, and the whitespace written before it, with it.
			cursor = attribute.end;
			continue;
		}

		// Copy everything up to the value, so the tag name, the whitespace
		// around `=`, the indentation, and the line endings are kept as written.
		parts.push(
			source.slice(cursor, attribute.valueStart),
			value === attribute.value
				? source.slice(attribute.valueStart, attribute.valueEnd)
				: encodeAttributeValue(value, attribute.quote),
		);
		cursor = attribute.valueEnd;
	}

	for (const [name, value] of state.values) {
		if (written.has(name) || value === null) {
			continue;
		}
		// An attribute the marker did not have has no written quoting to keep.
		parts.push(` ${name}=${encodeAttributeValue(value, '"')}`);
	}

	parts.push(source.slice(cursor, node.contentStart));

	return parts.join('');
};

export const renderDocument = (document: CommentDocument) => {
	const { source } = document;
	let output = '';
	let cursor = 0;

	for (const state of document.markers) {
		if (!state.changed) {
			continue;
		}

		output += source.slice(cursor, state.node.openingStart);
		output += renderOpeningTag(state);
		output += currentContent(state);
		cursor = state.node.contentEnd;
	}

	return output + source.slice(cursor);
};

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
		const current = state.values.get(name);
		if (current === null || current === undefined) {
			return false;
		}
		return value === undefined || current === value;
	});
};

export const selectMarkers = (document: CommentDocument, selectorText: string | undefined) => {
	if (selectorText === undefined) {
		return document.markers.slice();
	}

	const selector = parseSelector(selectorText);
	return document.markers.filter(state => matchesSelector(state, selector));
};

export const createDocument = (input: string | Buffer): CommentDocument => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;
	return {
		source,
		markers: parseDocument(source).map((node, index): MarkerState => ({
			index,
			source,
			node,
			values: new Map(node.attributes.map((attribute): [string, string | null] => (
				[attribute.name, attribute.value]
			))),
			content: undefined,
			changed: false,
		})),
	};
};

/**
 * Applies `replacements` to a document. Every selector is resolved before any
 * replacement is applied, so one replacement cannot change which markers the
 * others target and a rejected selector fails before any resolver runs. A
 * scalar replaces the first match and an array replaces matches by position;
 * an empty array is an explicit no-op. Giving more values than matches,
 * targeting one marker from two selectors, or naming a selector that matches
 * nothing is an error rather than a silent partial update.
 *
 * A resolver may return its result or a promise of it. Each call is awaited in
 * document order before the next starts, so a resolver with side effects runs
 * in the same order as the markers it targets.
 */
export const applyReplacements = async (
	document: CommentDocument,
	replacements: Record<string, CommentMarkReplacement>,
): Promise<void> => {
	const claims: Array<{ state: MarkerState;
		value: CommentMarkValue; }> = [];
	const claimed = new Map<MarkerState, string>();

	for (const [selectorText, replacement] of Object.entries(replacements)) {
		const matches = selectMarkers(document, selectorText);
		const positional = Array.isArray(replacement);

		if (positional && replacement.length > matches.length) {
			throw new Error(
				`[comment-mark] Selector ${JSON.stringify(selectorText)} matched ${matches.length} marker${matches.length === 1 ? '' : 's'} but received ${replacement.length} values`,
			);
		}

		// An empty array is the explicit way to request no change, even when
		// nothing matches.
		if (positional && replacement.length === 0) {
			continue;
		}

		// A selector with no matching marker is an error, so a typo or a stale
		// selector fails loudly instead of being mistaken for a successful
		// no-op.
		if (matches.length === 0) {
			throw new Error(`[comment-mark] Selector ${JSON.stringify(selectorText)} matched no markers`);
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
		const resolver = typeof value === 'function';
		// A resolver computes its own replacement from the marker's current
		// attributes and content; each occurrence gets its own call. Awaiting
		// each call before the next keeps resolvers in document order.
		const updated = resolver
			? await value(currentAttributes(state), currentContent(state))
			: value;

		if (updated === null || updated === undefined) {
			continue;
		}

		if (typeof updated === 'string') {
			// A resolver returns exact replacement content, so no newline padding
			// is added. A static multiline value keeps its surrounding newlines.
			setContent(state, resolver || !updated.includes('\n') ? updated : `\n${updated}\n`);
			continue;
		}

		// Apply attributes before content: attributes are validated and can
		// throw, while a content assignment cannot, so a rejected update leaves
		// the marker untouched.
		if (updated.attributes !== undefined) {
			replaceAttributes(state, updated.attributes);
		}

		if (updated.content !== undefined) {
			setContent(state, updated.content);
		}
	}
};

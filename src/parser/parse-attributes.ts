import {
	isNameChar,
	isNameStart,
	isWhitespace,
	skipWhitespace,
} from './characters.js';

const isValueChar = (char: string) => (
	!isWhitespace(char) && char !== '"' && char !== "'"
);

export type Attribute = {
	name: string;
	value: string;
	// The index just past the value, where the next attribute starts.
	end: number;
};

/**
 * Reads one attribute starting at or after `index`, or undefined once the
 * attributes end.
 */
const readAttribute = (source: string, index: number, end: number): Attribute | undefined => {
	index = skipWhitespace(source, index, end);
	if (index >= end) {
		return undefined;
	}

	const start = index;
	if (!isNameStart(source[index])) {
		const attribute = source.slice(index, index + 16);
		throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(attribute)}`);
	}
	index += 1;
	while (index < end && isNameChar(source[index])) {
		index += 1;
	}
	const name = source.slice(start, index);

	index = skipWhitespace(source, index, end);
	if (source[index] !== '=') {
		throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(name)}`);
	}
	index += 1;
	index = skipWhitespace(source, index, end);

	const valueStart = index;
	let value: string;
	const openingQuote = source[index];
	if (openingQuote === '"' || openingQuote === "'") {
		const quoteEnd = source.indexOf(openingQuote, index + 1);
		if (quoteEnd === -1 || quoteEnd >= end) {
			throw new Error(
				`[comment-mark] Unterminated attribute value for ${JSON.stringify(name)}`,
			);
		}

		value = source.slice(index + 1, quoteEnd);
		index = quoteEnd + 1;

		// Attributes must be separated by whitespace so `a="1"b="2"` is
		// rejected instead of silently merging into one token.
		if (index < end && !isWhitespace(source[index])) {
			throw new Error('[comment-mark] Expected whitespace between attributes');
		}
	} else {
		while (index < end && isValueChar(source[index])) {
			index += 1;
		}
		if (index === valueStart) {
			throw new Error(`[comment-mark] Missing value for attribute ${JSON.stringify(name)}`);
		}
		value = source.slice(valueStart, index);
	}

	return {
		name,
		value,
		end: index,
	};
};

/**
 * Reads the attributes in the order they are written. A repeated name is
 * rejected because it would make the attribute's value ambiguous.
 */
export const parseAttributeNodes = (source: string, start: number, end: number) => {
	const attributes: Attribute[] = [];
	const names = new Set<string>();
	let index = start;

	while (index < end) {
		const attribute = readAttribute(source, index, end);
		if (!attribute) {
			break;
		}

		if (names.has(attribute.name)) {
			throw new Error(`[comment-mark] Duplicate marker attribute: ${JSON.stringify(attribute.name)}`);
		}
		names.add(attribute.name);
		attributes.push(attribute);
		index = attribute.end;
	}

	return attributes;
};

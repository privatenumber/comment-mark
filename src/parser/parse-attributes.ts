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
	// The quote that wrapped the value, or undefined when it was unquoted.
	quote: '"' | "'" | undefined;
	// The whole attribute, from its name through the end of its value.
	start: number;
	end: number;
	// The value token, including its quotes, so a rewrite can replace only the
	// value and leave the whitespace around `=` and the line endings intact.
	valueStart: number;
	valueEnd: number;
};

/**
 * Reads one attribute starting at or after `index`, or undefined once the
 * attributes end. The grammar lives here so that reading attributes and
 * rewriting them cannot drift apart.
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
	let quote: '"' | "'" | undefined;
	const openingQuote = source[index];
	if (openingQuote === '"' || openingQuote === "'") {
		const quoteEnd = source.indexOf(openingQuote, index + 1);
		if (quoteEnd === -1 || quoteEnd >= end) {
			throw new Error(
				`[comment-mark] Unterminated attribute value for ${JSON.stringify(name)}`,
			);
		}

		quote = openingQuote;
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
		quote,
		start,
		end: index,
		valueStart,
		valueEnd: index,
	};
};

/**
 * Reads the attributes in the order they are written, with the offsets a
 * rewrite needs. A repeated name is rejected because it would make the
 * attribute's value ambiguous.
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

const isUnquotedValue = (value: string) => {
	if (value === '') {
		return false;
	}

	for (let index = 0; index < value.length; index += 1) {
		if (!isValueChar(value[index])) {
			return false;
		}
	}

	return true;
};

/**
 * Whether `name` is a name the grammar accepts. Reading rejects the same names,
 * so writing an unchecked one would produce a marker that cannot be read again.
 */
export const isAttributeName = (name: string) => {
	if (name === '' || !isNameStart(name[0])) {
		return false;
	}

	for (let index = 1; index < name.length; index += 1) {
		if (!isNameChar(name[index])) {
			return false;
		}
	}

	return true;
};

/**
 * Encodes a value for writing, reusing the quoting it was written with when the
 * value still fits it. Throws for values the grammar cannot hold.
 */
export const encodeAttributeValue = (value: string, quote: '"' | "'" | undefined) => {
	// The closing `-->` ends the comment wherever it appears, so a value cannot
	// contain one: `a="x-->y"` would be read as `a="x` followed by text.
	if (value.includes('-->')) {
		throw new Error(`[comment-mark] Attribute value cannot contain "-->": ${JSON.stringify(value)}`);
	}

	if (quote === '"' && !value.includes('"')) {
		return `"${value}"`;
	}
	if (quote === "'" && !value.includes("'")) {
		return `'${value}'`;
	}
	if (quote === undefined && isUnquotedValue(value)) {
		return value;
	}
	if (!value.includes('"')) {
		return `"${value}"`;
	}
	if (!value.includes("'")) {
		return `'${value}'`;
	}

	throw new Error(`[comment-mark] Attribute value cannot be quoted: ${JSON.stringify(value)}`);
};

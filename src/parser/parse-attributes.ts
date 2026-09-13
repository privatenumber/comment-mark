import {
	isNameChar,
	isNameStart,
	isWhitespace,
	skipWhitespace,
} from './characters.js';

const isValueChar = (char: string) => (
	!isWhitespace(char) && char !== '"' && char !== "'"
);

export const parseAttributes = (source: string, start: number, end: number) => {
	const attributes: Record<string, string> = Object.create(null);
	let index = start;

	while (index < end) {
		index = skipWhitespace(source, index, end);
		if (index >= end) {
			break;
		}

		const nameStart = index;
		if (!isNameStart(source[index])) {
			const attribute = source.slice(index, index + 16);
			throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(attribute)}`);
		}
		index += 1;
		while (index < end && isNameChar(source[index])) {
			index += 1;
		}
		const name = source.slice(nameStart, index);

		index = skipWhitespace(source, index, end);
		if (source[index] !== '=') {
			throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(name)}`);
		}
		index += 1;
		index = skipWhitespace(source, index, end);

		let value: string;
		const quote = source[index];
		if (quote === '"' || quote === "'") {
			const valueEnd = source.indexOf(quote, index + 1);
			if (valueEnd === -1 || valueEnd >= end) {
				throw new Error(
					`[comment-mark] Unterminated attribute value for ${JSON.stringify(name)}`,
				);
			}

			value = source.slice(index + 1, valueEnd);
			index = valueEnd + 1;

			// Attributes must be separated by whitespace so `a="1"b="2"` is
			// rejected instead of silently merging into one token.
			if (index < end && !isWhitespace(source[index])) {
				throw new Error('[comment-mark] Expected whitespace between attributes');
			}
		} else {
			const valueStart = index;
			while (index < end && isValueChar(source[index])) {
				index += 1;
			}
			if (index === valueStart) {
				throw new Error(`[comment-mark] Missing value for attribute ${JSON.stringify(name)}`);
			}
			value = source.slice(valueStart, index);
		}

		if (name in attributes) {
			throw new Error(`[comment-mark] Duplicate marker attribute: ${JSON.stringify(name)}`);
		}
		attributes[name] = value;
	}

	return attributes;
};

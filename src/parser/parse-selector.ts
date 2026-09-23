import {
	isNameChar, isNameStart, isWhitespace, skipWhitespace,
} from './characters.ts';

export type SelectorAttribute = {
	name: string;
	// undefined means the attribute only has to be present.
	value: string | undefined;
};

export type Selector = {
	tagName: string;
	attributes: SelectorAttribute[];
};

const isSelectorValueChar = (char: string) => (
	!isWhitespace(char)
	&& char !== ']'
	&& char !== '"'
	&& char !== "'"
	&& char !== '='
);

const readName = (source: string, index: number, end: number) => {
	if (index >= end || !isNameStart(source[index])) {
		return undefined;
	}

	const start = index;
	index += 1;
	while (index < end && isNameChar(source[index])) {
		index += 1;
	}
	return {
		name: source.slice(start, index),
		end: index,
	};
};

const invalidSelector = (selector: string): never => {
	throw new Error(`[comment-mark] Invalid selector: ${JSON.stringify(selector)}`);
};

/**
 * Reads a CSS-style selector: a tag name followed by attribute predicates.
 *
 *   item
 *   item[kind]
 *   item[kind='fruit']
 *   item[kind="fruit"][lang='en']
 *
 * Combinators, selector lists, and operators other than `=` are rejected, so an
 * unsupported selector fails loudly instead of quietly matching nothing.
 */
export const parseSelector = (selector: string): Selector => {
	const end = selector.length;
	const tag = readName(selector, 0, end);
	if (!tag) {
		return invalidSelector(selector);
	}

	const attributes: SelectorAttribute[] = [];
	let index = tag.end;

	while (index < end) {
		// Whitespace between the tag name and a predicate, or between two
		// predicates, would read as a descendant combinator in CSS.
		if (selector[index] !== '[') {
			return invalidSelector(selector);
		}
		index += 1;

		index = skipWhitespace(selector, index, end);
		const name = readName(selector, index, end);
		if (!name) {
			return invalidSelector(selector);
		}
		index = skipWhitespace(selector, name.end, end);

		let value: string | undefined;
		if (selector[index] === '=') {
			index = skipWhitespace(selector, index + 1, end);

			const quote = selector[index];
			if (quote === '"' || quote === "'") {
				const valueEnd = selector.indexOf(quote, index + 1);
				if (valueEnd === -1) {
					return invalidSelector(selector);
				}
				value = selector.slice(index + 1, valueEnd);
				index = valueEnd + 1;
			} else {
				const valueStart = index;
				while (index < end && isSelectorValueChar(selector[index])) {
					index += 1;
				}
				if (index === valueStart) {
					return invalidSelector(selector);
				}
				value = selector.slice(valueStart, index);
			}

			index = skipWhitespace(selector, index, end);
		}

		if (selector[index] !== ']') {
			return invalidSelector(selector);
		}
		index += 1;
		attributes.push({
			name: name.name,
			value,
		});
	}

	return {
		tagName: tag.name,
		attributes,
	};
};

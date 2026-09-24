export const isWhitespace = (char: string) => (
	char === ' '
	|| char === '\t'
	|| char === '\n'
	|| char === '\r'
	|| char === '\f'
);

export const skipWhitespace = (source: string, index: number, end: number) => {
	while (index < end && isWhitespace(source[index])) {
		index += 1;
	}
	return index;
};

export const isNameStart = (char: string) => (
	(char >= 'a' && char <= 'z')
	|| (char >= 'A' && char <= 'Z')
	|| char === '_'
);

export const isNameChar = (char: string) => (
	isNameStart(char)
	|| (char >= '0' && char <= '9')
	|| char === '-'
);

/**
 * Reads a name starting at `index`, or undefined when it does not start with
 * one. Returns the name and the index just after it.
 */
export const readName = (source: string, index: number, end: number) => {
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

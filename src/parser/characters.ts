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

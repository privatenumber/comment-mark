export type CodeRange = [start: number, end: number];

type Fence = {
	char: string;
	length: number;
	start: number;
};

/**
 * Matches a fenced code block line. Blockquote prefixes (`>`, `> >`) are
 * allowed, but the fence itself may be indented by at most three spaces.
 */
const matchFence = (line: string) => {
	let index = 0;

	for (;;) {
		let cursor = index;
		let spaces = 0;
		while (line[cursor] === ' ' && spaces < 3) {
			cursor += 1;
			spaces += 1;
		}

		if (line[cursor] !== '>') {
			break;
		}

		cursor += 1;
		if (line[cursor] === ' ') {
			cursor += 1;
		}
		index = cursor;
	}

	let spaces = 0;
	while (line[index] === ' ' && spaces < 3) {
		index += 1;
		spaces += 1;
	}

	const char = line[index];
	if (char !== '`' && char !== '~') {
		return undefined;
	}

	let length = 0;
	while (line[index + length] === char) {
		length += 1;
	}
	if (length < 3) {
		return undefined;
	}

	return {
		char,
		length,
		remainder: line.slice(index + length),
	};
};

// Inline code: a backtick run closes on the next unescaped run of equal length.
const findInlineCodeRanges = (line: string, lineStart: number, ranges: CodeRange[]) => {
	let index = 0;
	while (index < line.length) {
		if (line[index] !== '`' || (index > 0 && line[index - 1] === '\\')) {
			index += 1;
			continue;
		}

		let run = 0;
		while (line[index + run] === '`') {
			run += 1;
		}

		let cursor = index + run;
		let closeIndex = -1;
		while (cursor < line.length) {
			if (line[cursor] !== '`') {
				cursor += 1;
				continue;
			}

			let closeRun = 0;
			while (line[cursor + closeRun] === '`') {
				closeRun += 1;
			}

			if (line[cursor - 1] !== '\\' && closeRun === run) {
				closeIndex = cursor;
				break;
			}

			cursor += closeRun;
		}

		if (closeIndex === -1) {
			index += run;
			continue;
		}

		ranges.push([lineStart + index, lineStart + closeIndex + run]);
		index = closeIndex + run;
	}
};

export const findCodeRanges = (source: string): CodeRange[] => {
	const ranges: CodeRange[] = [];
	let offset = 0;
	let fence: Fence | undefined;

	for (const line of source.split('\n')) {
		const lineStart = offset;
		const lineEnd = offset + line.length;
		offset = lineEnd + 1;

		if (fence) {
			const match = matchFence(line);
			if (match
				&& match.char === fence.char
				&& match.length >= fence.length
				&& match.remainder.trim() === '') {
				ranges.push([fence.start, lineEnd]);
				fence = undefined;
			}
			continue;
		}

		const match = matchFence(line);
		if (match) {
			fence = {
				char: match.char,
				length: match.length,
				start: lineStart,
			};
			continue;
		}

		findInlineCodeRanges(line, lineStart, ranges);
	}

	if (fence) {
		ranges.push([fence.start, source.length]);
	}

	return ranges;
};

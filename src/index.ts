import { parseMarks } from './parser/parse-markers.js';

export const commentMark = (
	input: string | Buffer,
	data: Record<string, string | null | undefined>,
) => {
	if (
		!input
		|| data === null
		|| data === undefined
		|| typeof data !== 'object'
	) {
		return input;
	}

	const source = Buffer.isBuffer(input) ? input.toString() : input;

	let output = '';
	let cursor = 0;
	parseMarks(source, (mark, contentStart, contentEnd) => {
		const value = mark.id !== undefined && Object.hasOwn(data, mark.id) ? data[mark.id] : undefined;

		output += source.slice(cursor, contentStart);
		if (value === null || value === undefined) {
			output += mark.content;
		} else {
			output += value.includes('\n') ? `\n${value}\n` : value;
		}
		cursor = contentEnd;
	});

	return output + source.slice(cursor);
};

export const getCommentMarks = (input: string | Buffer): Record<string, string> => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;
	// Null-prototype dictionary so marker ids never collide with inherited properties.
	const commentMarks: Record<string, string> = Object.create(null);

	parseMarks(source, (mark) => {
		if (mark.id !== undefined) {
			commentMarks[mark.id] = mark.content;
		}
	});

	return commentMarks;
};

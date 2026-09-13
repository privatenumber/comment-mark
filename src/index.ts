import { type CommentMark, parseMarks } from './parse.js';

export type { CommentMark } from './parse.js';

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
	for (const mark of parseMarks(source)) {
		const value = mark.id !== undefined && Object.hasOwn(data, mark.id) ? data[mark.id] : undefined;

		output += source.slice(cursor, mark.contentStart);
		if (value === null || value === undefined) {
			output += mark.content;
		} else {
			output += value.includes('\n') ? `\n${value}\n` : value;
		}
		cursor = mark.contentEnd;
	}

	return output + source.slice(cursor);
};

export const getCommentMarks = (input: string | Buffer): Record<string, string> => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;
	// Null-prototype dictionary so marker ids never collide with inherited properties.
	const commentMarks: Record<string, string> = Object.create(null);

	for (const mark of parseMarks(source)) {
		if (mark.id !== undefined) {
			commentMarks[mark.id] = mark.content;
		}
	}

	return commentMarks;
};

export const getCommentMarkers = (input: string | Buffer): CommentMark[] => {
	const source = Buffer.isBuffer(input) ? input.toString() : input;

	return parseMarks(source).map((mark) => {
		const marker: CommentMark = {
			attributes: mark.attributes,
			content: mark.content,
		};
		if (mark.id !== undefined) {
			marker.id = mark.id;
		}
		return marker;
	});
};

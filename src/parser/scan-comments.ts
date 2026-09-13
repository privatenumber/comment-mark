export type CommentVisitor = (
	start: number,
	innerStart: number,
	innerEnd: number,
) => void;

/**
 * Visits every HTML comment's boundaries in document order.
 *
 * `innerStart` is the first character after `<!--` and `innerEnd` is the index
 * of the closing `-->`. Scanning stops at the first unterminated comment.
 */
export const scanComments = (source: string, visit: CommentVisitor) => {
	let position = 0;

	while (position < source.length) {
		const start = source.indexOf('<!--', position);
		if (start === -1) {
			return;
		}

		const innerStart = start + 4;
		const innerEnd = source.indexOf('-->', innerStart);
		if (innerEnd === -1) {
			return;
		}

		visit(start, innerStart, innerEnd);
		position = innerEnd + 3;
	}
};

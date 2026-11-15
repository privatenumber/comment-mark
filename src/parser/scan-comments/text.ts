/** Joins block segments as cmark's inline parser sees them. */
export const joinText = (
	source: string, segments: number[], starts?: number[], unescapePipes = false, removed?: number[],
) => {
	let text = '';
	for (let index = 0; index < segments.length; index += 2) {
		if (index > 0) {
			text += '\n';
		}
		starts?.push(text.length);
		const start = segments[index];
		const end = segments[index + 1];
		const segment = source.slice(start, end);
		// The table extension removes each backslash before a pipe before inlines:
		// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/table.c#L150-L168
		let escape = unescapePipes ? segment.indexOf(String.raw`\|`) : -1;
		if (escape === -1) {
			text += segment;
			continue;
		}
		let cursor = 0;
		while (escape !== -1) {
			text += segment.slice(cursor, escape);
			removed?.push(text.length);
			cursor = escape + 1;
			escape = segment.indexOf(String.raw`\|`, cursor + 1);
		}
		text += segment.slice(cursor);
	}
	return text;
};

/** Advances a source-mapping cursor to the first removal at or after the offset. */
export const advanceRemoved = (removed: number[], cursor: number, offset: number) => {
	while (cursor < removed.length && removed[cursor] < offset) {
		cursor += 1;
	}
	return cursor;
};

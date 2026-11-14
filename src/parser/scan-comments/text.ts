/** Joins block segments as cmark's inline parser sees them. */
export const joinText = (source: string, segments: number[], starts?: number[]) => {
	let text = '';
	for (let index = 0; index < segments.length; index += 2) {
		if (index > 0) {
			text += '\n';
		}
		starts?.push(text.length);
		text += source.slice(segments[index], segments[index + 1]);
	}
	return text;
};

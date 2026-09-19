export const createMarker = (id: string, content = '') => (
	`<!--comment-mark id="${id}"-->${content}<!--/comment-mark-->`
);

const prose = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';

export const longAttributeId = 'a'.repeat(50_000);

export const fixtures = {
	'prose only': prose.repeat(20_000),
	'sparse markers': prose.repeat(20_000) + createMarker('x', 'value') + prose.repeat(5000),
	'dense markers': `${createMarker('x', 'value')}\n`.repeat(10_000),
	'ordinary comments': `<!-- note -->${prose.repeat(100)}\n`.repeat(1000),
	'code fences': `# Title\n\n\`\`\`js\nconst value = 1;\n\`\`\`\n\n${createMarker('a', 'value')}\n\n`.repeat(1000),
	'long attribute': createMarker(longAttributeId, 'value'),
};

/**
 * Builds one line of backtick runs where every run length is unique, so no run
 * finds a partner and every one stays literal text. This is the worst case for
 * inline span matching.
 */
export const distinctBacktickRuns = (count: number) => {
	const runs: string[] = [];
	for (let length = 1; length <= count; length += 1) {
		runs.push('`'.repeat(length));
	}
	return `${runs.join(' ')} ${createMarker('x', 'value')}`;
};

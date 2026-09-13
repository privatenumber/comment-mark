export const marker = (id: string, content = '') => (
	`<!--comment-mark id="${id}"-->${content}<!--/comment-mark-->`
);

const prose = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';

export const fixtures = {
	'prose only': prose.repeat(20_000),
	'sparse markers': prose.repeat(20_000) + marker('x', 'value') + prose.repeat(5000),
	'dense markers': `${marker('x', 'value')}\n`.repeat(10_000),
	'ordinary comments': `<!-- note -->${prose.repeat(100)}\n`.repeat(1000),
	'code fences': `# Title\n\n\`\`\`js\nconst value = 1;\n\`\`\`\n\n${marker('a', 'value')}\n\n`.repeat(1000),
	'long attribute': marker('a'.repeat(50_000), 'value'),
};

/**
 * Builds one line of backtick runs where every run length is unique, so each
 * run searches the rest of the line for a match that never arrives. This is
 * the inline code scanner's worst case.
 */
export const distinctBacktickRuns = (count: number) => {
	const runs: string[] = [];
	for (let length = 1; length <= count; length += 1) {
		runs.push('`'.repeat(length));
	}
	return `${runs.join(' ')} ${marker('x', 'value')}`;
};

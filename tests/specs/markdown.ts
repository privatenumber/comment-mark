import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('comment and code boundaries', () => {
	test('a fenced example containing <!-- does not hide the next marker', async () => {
		const content = ['```html', '<!--', '```', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(await commentMark(content, { x: 'NEW' })).toBe(
			['```html', '<!--', '```', createMarker('x', '\nNEW\n')].join('\n'),
		);
	});

	test('an inline example containing <!-- does not hide the next marker', async () => {
		const content = `\`<!--\` ${createMarker('x', 'old')}`;

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(await commentMark(content, { x: 'NEW' })).toBe(`\`<!--\` ${createMarker('x', 'NEW')}`);
	});

	test('a backtick in an attribute value does not hide the closing comment', () => {
		const content = '<!-- a note="`" -->old<!-- /a -->`';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: { note: '`' },
				content: 'old',
			},
		]);
	});

	test('a fence-looking line inside an HTML comment does not hide later markers', async () => {
		const content = ['<!--', '```', '-->', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(await commentMark(content, { x: 'NEW' })).toBe(
			['<!--', '```', '-->', createMarker('x', '\nNEW\n')].join('\n'),
		);
	});
});

describe('block comments', () => {
	test('a standalone comment does not expose a following list fence', () => {
		const content = ['<!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('an indented standalone comment does not expose a following list fence', () => {
		const content = ['  <!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a multiline standalone comment does not expose a following list fence', () => {
		const content = ['<!--', 'note', '-->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a block comment interrupts an open paragraph', () => {
		const content = ['paragraph', '<!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a comment inside a paragraph does not end it', () => {
		// The comment is paragraph text, so `2.` cannot start a list and the
		// fence-looking line stays paragraph text.
		const content = ['text <!-- note -->', '2. ~~~', `   ${createMarker('x', 'real')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});
});

describe('empty comments', () => {
	test('an empty comment does not hide the next marker', () => {
		// `<!-->` and `<!--->` are complete comments, so they do not run to the
		// next marker's `-->`.
		for (const empty of ['<!-->', '<!--->']) {
			for (const source of [`x ${empty} ${createMarker('a', 'old')}`, `${empty}\n${createMarker('a', 'old')}`]) {
				expect(getCommentMarkAll(source)).toStrictEqual([
					{
						tagName: 'a',
						attributes: {},
						content: 'old',
					},
				]);
			}
		}
	});
});

describe('comments that span lines', () => {
	// An unclosed `<!--` inside a paragraph continues only while the paragraph
	// does. Each source would hide the marker if the comment stayed open.
	const endingLines: [string, string][] = [
		['a blank line', ''],
		['an ATX heading', '# Heading'],
		['a setext underline', '==='],
		['a thematic break', '***'],
		['a blockquote', '> quote'],
		['a bullet list item', '- item'],
		['a fence', '~~~\n~~~'],
		['an HTML block', '<div>\n'],
	];

	for (const [name, line] of endingLines) {
		test(`a comment in a paragraph ends at ${name}`, () => {
			const source = `text <!-- note\n${line}\n${createMarker('a', 'old')}`;

			expect(getCommentMarkAll(source)).toStrictEqual([
				{
					tagName: 'a',
					attributes: {},
					content: 'old',
				},
			]);
		});
	}

	// Each source opens a comment and continues its paragraph on a second line.
	const continuingParagraphs: [string, string][] = [
		['a paragraph line', 'text <!-- note\nmore'],
		['a lazy blockquote line', '> text <!-- note\nmore'],
		['an ordered item that cannot interrupt a paragraph', 'text <!-- note\n2. more'],
	];

	for (const [name, paragraph] of continuingParagraphs) {
		test(`a comment in a paragraph continues on ${name}`, () => {
			// The comment ends at the opening comment's `-->`, so no marker opens.
			const source = `${paragraph} ${createMarker('a', 'old')}`;

			expect(getCommentMarkAll(source)).toStrictEqual([]);
		});
	}

	test('a comment in a heading ends with the heading', () => {
		const source = `# Title <!-- note\ntext ${createMarker('a', 'old')}`;

		expect(getCommentMarkAll(source)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'old',
			},
		]);
	});

	test('a comment opened on an HTML block line continues past a blank line', () => {
		// The line is raw HTML, where a comment runs to the next `-->`. GitHub also
		// ends a tag name at a form feed.
		for (const tag of ['<div>', '<div\f>']) {
			const source = `${tag}<!-- note\n\n${createMarker('a', 'old')}`;

			expect(getCommentMarkAll(source)).toStrictEqual([]);
		}
	});

	test('a comment opened on a later line of an HTML block is raw HTML', () => {
		// The block runs to the blank line, so `# heading` is raw HTML, not a
		// heading, and the comment runs to the next `-->`.
		const source = `<div>\nx <!-- note\n# heading\n${createMarker('a', 'old')}\n</div>`;

		expect(getCommentMarkAll(source)).toStrictEqual([]);
	});

	test('a blockquote prefix does not close an HTML block that ends at >', () => {
		// A `<!DOCTYPE` block ends at a `>` in its content, not in the `>` prefix.
		const source = `> <!DOCTYPE\n> x <!-- note\n> # heading\n> ${createMarker('a', 'old')}`;

		expect(getCommentMarkAll(source)).toStrictEqual([]);
	});

	// Each HTML block ends before the paragraph that opens the comment, so the
	// comment is paragraph text and ends at the blank line.
	const endedBlocks: [string, string][] = [
		['a blank line', '<div>\n'],
		['its closing tag', '<pre>\n</pre>'],
		['the end of its list item', '- <div>\n-'],
	];

	for (const [name, block] of endedBlocks) {
		test(`an HTML block ends at ${name}`, () => {
			const source = `${block}\ntext <!-- note\n\n${createMarker('a', 'old')}`;

			expect(getCommentMarkAll(source)).toStrictEqual([
				{
					tagName: 'a',
					attributes: {},
					content: 'old',
				},
			]);
		});
	}
});

describe('fenced code blocks', () => {
	test('ignores markers inside fenced code blocks', () => {
		const content = ['```md', createMarker('a', 'example'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers inside tilde fences', () => {
		const content = ['~~~', createMarker('a', 'example'), '~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers inside an unterminated fence', () => {
		const content = `\`\`\`\n${createMarker('a', 'example')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a closing marker inside a fence does not close a marker', async () => {
		const content = '<!-- a -->\n```md\n<!-- /a -->\n```\nKEEP\n<!-- /a -->';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '\n```md\n<!-- /a -->\n```\nKEEP\n',
			},
		]);
		expect(await commentMark(content, { a: 'NEW' })).toBe('<!-- a -->\nNEW\n<!-- /a -->');
	});

	test('a closing fence with trailing text does not close the fence', () => {
		const content = `\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`not-a-close\n${createMarker('b', 'real')}\n\`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a longer fence contains shorter fences', () => {
		const content = `\`\`\`\`\n\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`\n\`\`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers in blockquote fences', () => {
		const content = `> \`\`\`md\n> ${createMarker('a', 'example')}\n> \`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a blockquote fence line inside a top-level fence does not close it', () => {
		const content = ['```md', '> ```', createMarker('x', 'example'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a blockquote that ends before its unclosed fence does not hide later markers', () => {
		const content = ['> ```', '> code', '', createMarker('x', 'real')].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('a backtick in a fence info string does not open a fence', () => {
		const content = ['``` `', createMarker('x', 'real'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('a fence indented to a list item content column is recognized', () => {
		const content = ['1. item', '', '    ```', `    ${createMarker('x', 'example')}`, '    ```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a thematic break does not create list context for a following fence', () => {
		const content = ['* * *', '  ~~~md', createMarker('x', 'example'), '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a tab-indented line continues a list fence', () => {
		const content = ['- item', '', '  ~~~md', `\t${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a tab after a blockquote marker still opens a fence', () => {
		const content = ['>\t~~~md', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a tab can satisfy indentation for nested list levels', () => {
		const content = ['- outer', '  - inner', '    ~~~md', `\t${createMarker('x', 'example')}`, '    ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('indentation from a blockquote tab cannot close a fence', () => {
		const content = ['> ~~~md', '>\t  ~~~', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('indentation from a list tab cannot close a fence', () => {
		const content = ['- item', '  ~~~md', '\t  ~~~', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a fence with mixed space and tab padding is recognized', () => {
		const content = ['- \t~~~md', `\t${createMarker('x', 'example')}`, '\t~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a blank line ends a fence inside a blockquote', () => {
		const content = ['> ~~~', '', '> ~~~', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a blank line continues a fence inside a list item', () => {
		const content = ['- ~~~md', '', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a quote-prefixed blank line keeps a list fence open', () => {
		const content = ['> - ~~~', '>', `>   ${createMarker('x', 'example')}`, '>   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a list padding tab that overshoots five columns does not open a fence', () => {
		const content = ['-\t  ~~~', '', '  ~~~', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});
});

describe('inline code', () => {
	test('ignores markers inside inline code', () => {
		const content = `See \`${createMarker('a', 'example')}\` for details`;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('parses markers outside of code', () => {
		const content = `\`${createMarker('a', 'inline')}\`\n${createMarker('b', 'real')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'b',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('an escaped backtick does not open inline code', () => {
		const content = `\\\`${createMarker('a', 'real')}\``;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('an unterminated inline code span does not hide later markers', () => {
		const content = `\`unclosed\n${createMarker('a', 'real')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('two backslashes before an opening backtick do not escape it', () => {
		// The backslashes escape each other, so the backtick still opens a span.
		const content = `\\\\\`${createMarker('x', 'example')}\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a backslash before a closing backtick does not escape it inside a span', () => {
		const content = `\`${createMarker('x', 'example')}\\\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('an escaped multi-backtick run cannot close an existing span', () => {
		const content = ['`example \\', '`` ', createMarker('x', 'example'), '`'].join('');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});
});

describe('links and images', () => {
	test('reference labels use cmark case folding and replacement characters', async () => {
		const content = 'x <!-- a -->outer ![<!-- a -->inner][ı] tail<!-- /a -->\n\n[I]: /u';
		expect(getCommentMarkAll(content)).toStrictEqual([{
			tagName: 'a',
			attributes: {},
			content: 'inner][ı] tail',
		}]);
		expect(await commentMark(content, { a: 'NEW' })).toBe(
			'x <!-- a -->outer ![<!-- a -->NEW<!-- /a -->\n\n[I]: /u',
		);
		for (const label of ['\u0000', '\uD800', '\uDC00']) {
			expect(getCommentMarkAll(`![<!-- a -->old<!-- /a -->][\uFFFD]\n\n[${label}]: /url`)).toStrictEqual([]);
		}
		expect(getCommentMarkAll('![<!-- a -->old<!-- /a -->][SS]\n\n[ß]: /url')).toStrictEqual([]);
	});

	test('reference links preserve nested marker boundaries', async () => {
		for (const [content, old, updated] of [
			['x <!-- a -->old [outer [ref]](<!-- /a -->) PRESERVE <!-- /a -->\n\n[ref]: /u', 'old [outer [ref]](', 'x <!-- a -->NEW<!-- /a -->) PRESERVE <!-- /a -->\n\n[ref]: /u'],
			['x <!-- a -->outer [a [b][r]](<!-- a -->) tail<!-- /a -->\n\n[r]: /url', ') tail', 'x <!-- a -->outer [a [b][r]](<!-- a -->NEW<!-- /a -->\n\n[r]: /url'],
		] as const) {
			expect(getCommentMarkAll(content)).toStrictEqual([{
				tagName: 'a',
				attributes: {},
				content: old,
			}]);
			expect(await commentMark(content, { a: 'NEW' })).toBe(updated);
		}
	});

	test('reference links and images resolve definitions after their use', () => {
		const marker = '<!-- a -->old<!-- /a -->';
		for (const suffix of ['[r]', '[]', '[ ]', '']) {
			const label = suffix === '[r]' ? 'r' : marker;
			for (const image of [false, true]) {
				const prefix = image ? '!' : '';
				const content = `x ${prefix}[${marker}]${suffix}`;
				const literal = [{
					tagName: 'a',
					attributes: {},
					content: 'old',
				}];
				expect(getCommentMarkAll(content)).toStrictEqual(literal);
				expect(getCommentMarkAll(`${content}\n\n[${label}]: /u`)).toStrictEqual(image ? [] : literal);
			}
		}
		for (const content of [
			'![<!-- a -->old<!-- /a -->][r]\n\n[r]: /url',
			'![<!-- a -->old<!-- /a -->][SS]\n\n[ß]: /url',
			'x [text][<!-- a -->old<!-- /a -->]\n\n[<!-- a -->old<!-- /a -->]: /u',
		]) {
			expect(getCommentMarkAll(content)).toStrictEqual([]);
		}
	});

	test('destinations and titles do not render comments', async () => {
		const sources = [
			'[x](<!-- a -->)<!-- /a -->',
			'[x](u<!--a-->)<!-- /a -->',
			'[x](u(a(b))<!--a-->)<!-- /a -->',
			String.raw`[x](u\)<!--a-->)<!-- /a -->`,
			String.raw`[x](u\(<!--a-->)<!-- /a -->`,
			'[x](u "<!-- a -->")<!-- /a -->',
			"[x](u '<!-- a -->')<!-- /a -->",
			'[x](u (<!-- a -->))<!-- /a -->',
			'[x](\v<!-- a -->)<!-- /a -->',
			'[x](u\v<!--a-->)<!-- /a -->',
			'[x](u\f<!--a-->)<!-- /a -->',
			'[a [b]](<!-- a -->)<!-- /a -->',
			'[a `]` b](<!-- a -->)<!-- /a -->',
		];
		for (const content of sources) {
			expect(getCommentMarkAll(content)).toStrictEqual([]);
		}
		await expect(commentMark(sources[0], { a: 'NEW' }))
			.rejects.toThrow('[comment-mark] Selector "a" matched no markers');
	});

	test('link text and literal links retain comments', () => {
		for (const content of [
			'[x <!-- a -->old<!-- /a -->](u)',
			'[x](u <!-- a -->old<!-- /a -->)',
			String.raw`\[x](<!-- a -->old<!-- /a -->)`,
			'![<!-- a -->old<!-- /a -->',
		]) {
			expect(getCommentMarkAll(content)).toStrictEqual([{
				tagName: 'a',
				attributes: {},
				content: 'old',
			}]);
		}
	});

	test('a link disables older link openers', () => {
		const content = '[a [b](u)](<!-- a -->)<!-- /a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([{
			tagName: 'a',
			attributes: {},
			content: ')',
		}]);
	});

	test('image alt text escapes comments, including nested links and images', () => {
		for (const content of [
			'![<!-- a -->old<!-- /a -->](u)',
			'[a ![<!-- a -->old<!-- /a -->](u)](v)',
			'![a [<!-- a -->old<!-- /a -->](u)](v)',
			'![before ![<!-- a -->old<!-- /a -->](u) after',
			'![before ![<!-- a -->old<!-- /a -->] after](u)',
		]) {
			expect(getCommentMarkAll(content)).toStrictEqual([]);
		}
	});

	test('a bracket followed by a caret is not an image opener', () => {
		const content = 'x <!-- a -->outer ![^<!-- a -->inner](u) tail<!-- /a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([{
			tagName: 'a',
			attributes: {},
			content: 'inner](u) tail',
		}]);
	});

	test('image spans are emitted in order when an image is literal', () => {
		const content = '![<!-- a -->old<!-- /a -->] nope <!-- b -->yes<!-- /b -->';
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'old',
			},
			{
				tagName: 'b',
				attributes: {},
				content: 'yes',
			},
		]);
	});

	test('reference destinations include vertical tab and form feed', () => {
		for (const control of ['\v', '\f']) {
			const content = `[r]: u${control}<!--a-->\n\n[r]\n<!-- /a -->`;
			expect(getCommentMarkAll(content)).toStrictEqual([]);
		}
	});

	test('labels keep vertical tab and form feed', () => {
		// cmark trims and collapses labels with `cmark_isspace`, which excludes
		// `\v` and `\f`, so a label of only `\v` is not blank and can resolve.
		expect(getCommentMarkAll('[\v]: <!-- a -->\n\n<!-- /a -->')).toStrictEqual([]);
		expect(getCommentMarkAll('[a\vb]: <!-- a -->\n\n[a b]\n<!-- /a -->')).toStrictEqual([]);
		for (const control of ['\v', '\f']) {
			const content = `![x <!-- a -->][${control}]<!-- /a -->\n\n[x <!-- a -->]: /u`;
			expect(getCommentMarkAll(content).map(marker => marker.content)).toStrictEqual([`][${control}]`]);
		}
	});
});

describe('paragraph interruption', () => {
	test('an ordered marker other than one does not interrupt a paragraph', async () => {
		const content = ['paragraph', '2. ~~~', `   ${createMarker('x', 'real')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
		expect(await commentMark(content, { x: 'NEW' })).toBe(
			['paragraph', '2. ~~~', `   ${createMarker('x', '\nNEW\n')}`, '   ~~~'].join('\n'),
		);
	});

	test('a marker after a dropped container is not treated as paragraph text', () => {
		// The list item ends before `2.`, so the ordered marker is a real list
		// and hides the fenced example that follows.
		const content = ['- item', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('an ordered marker inside a blockquote paragraph does not interrupt it', () => {
		const content = ['> paragraph', '> 2. ~~~', `>    ${createMarker('x', 'real')}`, '>    ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});
});

describe('heading context', () => {
	test('an ATX heading does not leave a paragraph open', () => {
		// The heading ends the paragraph, so `2.` starts a real list and its
		// fence hides the example that follows.
		const content = ['# Heading', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a setext heading does not leave a paragraph open', () => {
		const content = ['Heading', '===', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a setext dash underline does not leave a paragraph open', () => {
		const content = ['Heading', '---', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});
});

describe('markers in headings', () => {
	test('finds a marker on an ATX heading line', async () => {
		const content = '# <!-- title -->Old<!-- /title -->';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'title',
				attributes: {},
				content: 'Old',
			},
		]);
		expect(await commentMark(content, { title: 'New' })).toBe('# <!-- title -->New<!-- /title -->');
	});

	test('ignores a marker example in inline code on a heading line', () => {
		const content = `# \`${createMarker('title', 'example')}\``;

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('finds a marker on a heading inside a blockquote', () => {
		expect(getCommentMark('# <!-- title -->Old<!-- /title -->', 'title')?.content).toBe('Old');
	});

	test('finds a marker on a heading inside a list item', () => {
		expect(getCommentMark('- # <!-- title -->Old<!-- /title -->', 'title')?.content).toBe('Old');
	});
});

describe('GitHub rendering', () => {
	// Each expectation was checked against GitHub's renderer, cmark-gfm
	// 0.29.0.gfm.13, followed by a browser's HTML parser.
	const marker = createMarker('a', 'old');
	const cases: [name: string, source: string, rendered: boolean][] = [
		['indented code holds no markers', `    ${marker}`, false],
		['a tab-indented line is code', `\t${marker}`, false],
		['an escaped <!-- does not open a comment', String.raw`\<!-- note ${marker}`, true],
		['a processing instruction block hides a marker until its >', `<?x ${marker}`, false],
		['a declaration block hides a marker until its >', `<!X x ${marker}`, false],
		['a bogus comment continues into the next HTML block', `<div>\n<?x\n\n${marker}`, false],
		['a paragraph between HTML blocks ends a bogus comment', `<div>\n<?x\n\ntext\n\n${marker}`, true],
		['a link reference definition renders nothing', '[x]: <!-- a -->\n\nold\n\n<!-- /a -->', false],
		['text after a link reference definition is a paragraph', `[x]: /url\ntext ${marker}`, true],
		// The paragraph stays open, so the indented line continues it instead of
		// opening indented code.
		['an underline after only definitions is paragraph text', `[x]: /url\n===\n    ${marker}`, true],
		['a table drops body cells past its header', `| a |\n| - |\n| x | ${marker} |`, false],
		['a pipe after any backslash stays in its table cell', `| a | b |\n| - | - |\n| \`\\\\|${marker}\` | x |`, false],
		// cmark-gfm limits a label to 1,000 bytes, and each character here is 3.
		['a reference label over 1,000 UTF-8 bytes is text', `[${'あ'.repeat(334)}]: /u "${marker}"`, true],
		['a run of more than 80 backticks is literal', `x ${'`'.repeat(81)}${marker}${'`'.repeat(81)}`, true],
		// cmark-gfm stores a fence length of at most 255.
		['a fence longer than 255 closes at 255', ['~'.repeat(256), 'code', '~'.repeat(255), '~'.repeat(256), marker, '~'.repeat(256)].join('\n'), false],
		// cmark-gfm reads NUL as U+FFFD, which an autolink allows.
		['NUL does not end an autolink', `x <ab:\0\`y> ${marker} \``, true],
		// GitHub escapes the `<` of `<title>`, so its quote opens no attribute value.
		['a filtered tag is text', `<div>\n<title a="\n\n${marker}`, true],
		['an open attribute value continues into the next HTML block', `<div>\n<span a="\n\n${marker}`, false],
		['noscript content is raw text', `<noscript>${marker}</noscript>`, false],
	];

	for (const [name, source, rendered] of cases) {
		test(name, () => {
			expect(getCommentMarkAll(source)).toStrictEqual(rendered
				? [{
					tagName: 'a',
					attributes: {},
					content: 'old',
				}]
				: []);
		});
	}

	test('a comment-like line inside an attribute does not start the line', async () => {
		const source = `<pre>\n<span title="\n    <!-- note -->">Value: ${marker}!</span>\n</pre>`;

		expect(await commentMark(source, { a: 'new' })).toBe(source.replace(marker, createMarker('a', 'new')));
	});

	test('an indented comment on an HTML block line starts its line', async () => {
		// The line is raw HTML, so indentation does not make it code.
		const source = `<div>\n\t${marker}\n</div>`;

		expect(await commentMark(source, { a: 'new' })).toBe(`<div>\n\t${createMarker('a', '\nnew\n')}\n</div>`);
	});
});

describe('line endings', () => {
	test('a marker after a closed fence is recognized in a CR-only document', async () => {
		const content = ['~~~', 'code', '~~~', createMarker('x', 'real')].join('\r');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
		expect(await commentMark(content, { x: 'NEW' })).toBe(
			['~~~', 'code', '~~~', createMarker('x', '\rNEW\r')].join('\r'),
		);
	});

	test('a marker after a closed fence is recognized in a CRLF document', () => {
		const content = ['~~~', 'code', '~~~', createMarker('x', 'real')].join('\r\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('preserves the line endings around a replaced section', async () => {
		const content = ['before', '<!-- a -->old<!-- /a -->', 'after'].join('\r\n');
		expect(await commentMark(content, { a: 'new' })).toBe(
			['before', '<!-- a -->\r\nnew\r\n<!-- /a -->', 'after'].join('\r\n'),
		);
	});
});

import { describe, test, expect } from 'manten';
import { commentMark, getCommentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('marker position layout', () => {
	test('recognizes a tab within blockquote indentation', async () => {
		expect(await commentMark('> \t<!-- a --><!-- /a -->', { a: '**bold**' })).toBe(
			'> \t<!-- a -->\n> **bold**\n> <!-- /a -->',
		);
	});
	test('keeps a four-space paragraph continuation inline', async () => {
		const input = 'Before\n    <!-- a --><!-- /a --> after';
		expect(await commentMark(input, { a: 'value' })).toBe('Before\n    <!-- a -->value<!-- /a --> after');
	});

	test('uses external line endings for stable updates', async () => {
		const input = 'x <!-- a --><!-- /a -->\n<!-- b --><!-- /b -->';
		const replacements = {
			a: 'value\r\n',
			b: 'new',
		};
		const output = await commentMark(input, replacements);
		expect(output).toBe('x <!-- a -->value\r\n<!-- /a -->\n<!-- b -->\nnew\n<!-- /b -->');
		expect(await commentMark(output, replacements)).toBe(output);
		const afterContent = '<!-- a -->old\r\ncontent<!-- /a -->\r<!-- b --><!-- /b -->';
		expect(await commentMark(afterContent, { b: 'new' })).toBe(
			'<!-- a -->old\r\ncontent<!-- /a -->\r<!-- b -->\rnew\r<!-- /b -->',
		);
		for (const ending of ['\r', '\n', '\r\n']) {
			const source = `before${ending}<!-- a --><!-- /a -->`;
			expect(await commentMark(source, { a: 'value' })).toBe(`before${ending}<!-- a -->${ending}value${ending}<!-- /a -->`);
			expect(await commentMark(source, { a: `${ending}value${ending}` })).toBe(`before${ending}<!-- a -->${ending}value${ending}<!-- /a -->`);
		}
		const quote = await commentMark('> <!-- a --><!-- /a -->\r', { a: 'one\rtwo' });
		expect(quote).toBe('> <!-- a -->\r> one\r> two\r> <!-- /a -->\r');
		expect(getCommentMark(quote, 'a')?.content).toBe('\rone\rtwo\r');
		expect(await commentMark(quote, { a: ({ content }) => content })).toBe(quote);
	});
	test('ignores line breaks in an opening comment that an update rewrites', async () => {
		const input = '<!-- a\n  id="foo" --><!-- /a -->\r\n';
		const replacement = {
			a: {
				attributes: {},
				content: 'value',
			},
		};
		const output = await commentMark(input, replacement);
		expect(output).toBe('<!-- a -->\r\nvalue\r\n<!-- /a -->\r\n');
		expect(await commentMark(output, replacement)).toBe(output);
	});
	test('treats a comment after a leading byte order mark as starting its line', async () => {
		expect(await commentMark('\uFEFF<!-- a --><!-- /a -->', { a: '# H' })).toBe('\uFEFF<!-- a -->\n# H\n<!-- /a -->');
	});
	test('inherits line context after a multiline comment closes', async () => {
		expect(await commentMark('<!-- note\n--> <!-- a --><!-- /a -->', { a: '**bold**' })).toBe(
			'<!-- note\n--> <!-- a -->\n**bold**\n<!-- /a -->',
		);
		expect(await commentMark('text <!-- note\n--> <!-- a --><!-- /a -->', { a: '**bold**' })).toBe(
			'text <!-- note\n--> <!-- a -->**bold**<!-- /a -->',
		);
	});
	test('all markers on a comment-started line use line-start layout', async () => {
		expect(await commentMark('<!-- ordinary --><!-- a --><!-- /a -->', { a: '# Heading' })).toBe(
			'<!-- ordinary --><!-- a -->\n# Heading\n<!-- /a -->',
		);
		expect(await commentMark('<!-- a -->x<!-- /a --><!-- b -->y<!-- /b -->', {
			a: 'A',
			b: 'B',
		})).toBe(
			'<!-- a -->\nA\n<!-- /a --><!-- b -->\nB\n<!-- /b -->',
		);
		expect(await commentMark('text <!-- ordinary --><!-- a --><!-- /a -->', { a: '# Heading' })).toBe(
			'text <!-- ordinary --><!-- a --># Heading<!-- /a -->',
		);
	});
	const contents = ['value', '**bold**', 'value\n', 'a\nb', '# Heading', '- item', '```js\nx\n```', ''];
	const positions = [
		{
			name: 'top level',
			before: '',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'after blank line',
			before: 'intro\n\n',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'blockquote',
			before: '> ',
			after: '',
			lineStart: true,
			continuation: '> ',
		},
		{
			name: 'list item',
			before: '- ',
			after: '',
			lineStart: true,
			continuation: '  ',
		},
		{
			name: 'one space',
			before: ' ',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'two spaces',
			before: '  ',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'three spaces',
			before: '   ',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'sentence',
			before: 'Version: ',
			after: '.',
			lineStart: false,
			continuation: '',
		},
		{
			name: 'heading',
			before: '# ',
			after: '',
			lineStart: false,
			continuation: '',
		},
		{
			name: 'table cell',
			before: '| ',
			after: ' |',
			lineStart: false,
			continuation: '',
		},
	];

	for (const position of positions) {
		for (const content of contents) {
			test(`${position.name}: ${JSON.stringify(content)}`, async () => {
				const input = `${position.before}${createMarker('a')}${position.after}`;
				if (!position.lineStart && content.startsWith('```')) {
					await expect(commentMark(input, { a: content })).rejects.toThrow('would change the document\'s markers');
					return;
				}
				const padded = position.lineStart && content
					? `\n${content}${content.endsWith('\n') ? '' : '\n'}`
					: content;
				const written = padded.replaceAll('\n', `\n${position.continuation}`);
				expect(await commentMark(input, { a: content })).toBe(
					`${position.before}${createMarker('a', written)}${position.after}`,
				);
			});
		}
	}

	test('uses the start of a multiline opening comment', async () => {
		expect(await commentMark('<!-- a\n -->old<!-- /a -->', { a: 'value' })).toBe('<!-- a\n -->\nvalue\n<!-- /a -->');
		expect(await commentMark('x <!-- a\n -->old<!-- /a -->', { a: 'value' })).toBe('x <!-- a\n -->value<!-- /a -->');
	});

	test('static updates and resolvers returning content are idempotent', async () => {
		for (const input of [createMarker('a'), `> ${createMarker('a')}`, `x ${createMarker('a')}`]) {
			const once = await commentMark(input, { a: 'value' });
			expect(await commentMark(once, { a: 'value' })).toBe(once);
			expect(await commentMark(once, { a: ({ content }) => content })).toBe(once);
			if (!input.startsWith('x')) {
				expect(getCommentMark(once, 'a')?.content).toBe('\nvalue\n');
			}
		}
	});
});

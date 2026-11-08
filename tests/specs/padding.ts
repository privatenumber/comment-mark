import { describe, test, expect } from 'manten';
import { commentMark, getCommentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('marker position layout', () => {
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
			name: 'four spaces',
			before: '    ',
			after: '',
			lineStart: true,
			continuation: '',
		},
		{
			name: 'tab',
			before: '\t',
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

	test('keeps existing boundaries and uses the document line ending', async () => {
		const input = `before\r\n${createMarker('a')}\r\n`;
		expect(await commentMark(input, { a: '\r\nvalue\r\n' })).toBe(`before\r\n${createMarker('a', '\r\nvalue\r\n')}\r\n`);
		expect(await commentMark(input, { a: 'value' })).toBe(`before\r\n${createMarker('a', '\r\nvalue\r\n')}\r\n`);
	});

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

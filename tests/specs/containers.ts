import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { commentMark, getCommentMark, getCommentMarkAll } from '#comment-mark';
import { commentMarkCli } from '../utils/comment-mark-cli.ts';

describe('container continuation', () => {
	const cases = [
		{
			name: 'list item',
			source: '- item\n  <!-- a --><!-- /a -->\n',
			prefix: '  ',
		},
		{
			name: 'blockquote',
			source: '> <!-- a --><!-- /a -->\n',
			prefix: '> ',
		},
		{
			name: 'nested blockquote and list',
			source: '> - <!-- a --><!-- /a -->\n',
			prefix: '>   ',
		},
		{
			name: 'ordered list',
			source: '12. <!-- a --><!-- /a -->\n',
			prefix: '    ',
		},
		{
			name: 'tab-indented list',
			source: '-\t<!-- a --><!-- /a -->\n',
			prefix: '    ',
		},
	];

	for (const { name, source, prefix } of cases) {
		test(`writes and reads ${name} idempotently`, async () => {
			const expected = source.replace('<!-- a --><!-- /a -->', `<!-- a -->\n${prefix}foo\n${prefix}bar\n${prefix}<!-- /a -->`);
			const result = await commentMark(source, { a: 'foo\nbar' });
			expect(result).toBe(expected);
			expect(getCommentMark(result, 'a')?.content).toBe('\nfoo\nbar\n');
			expect(getCommentMarkAll(result)[0].content).toBe('\nfoo\nbar\n');
			expect(await commentMark(result, { a: 'foo\nbar' })).toBe(result);
			expect(await commentMark(result, { a: ({ content }) => content })).toBe(result);

			await using fixture = await createFixture({ 'README.md': source });
			const path = fixture.getPath('README.md');
			await commentMarkCli(path, '--a=foo\nbar');
			const { stderr } = await commentMarkCli(path, '--a=foo\nbar');
			expect(stderr).toContain('Unchanged: a');
			expect(await fixture.readFile('README.md', 'utf8')).toBe(expected);
			const { stdout } = await commentMarkCli(path);
			expect(JSON.parse(stdout)[0].content).toBe('\nfoo\nbar\n');
		});
	}

	test('keeps empty lines free of trailing spaces and preserves CRLF content', async () => {
		const source = '> - <!-- a --><!-- /a -->\r\n';
		const expected = '> - <!-- a -->\r\n>   foo\r\n>\r\n>   bar\r\n>   <!-- /a -->\r\n';
		const result = await commentMark(source, { a: 'foo\r\n\r\nbar' });
		expect(result).toBe(expected);
		expect(getCommentMark(result, 'a')?.content).toBe('\r\nfoo\r\n\r\nbar\r\n');
		expect(await commentMark(result, { a: ({ content }) => content })).toBe(result);
	});

	test('leaves lazy continuation text without the prefix as written', () => {
		expect(getCommentMark('> <!-- a -->\nlazy\n> <!-- /a -->\n', 'a')?.content).toBe('\nlazy\n');
	});

	test('moves a closer outside the container into the opener container', async () => {
		const source = '> <!-- a -->\n\noutside\n<!-- /a -->\n';
		const result = await commentMark(source, { a: 'foo\nbar' });
		expect(result).toBe('> <!-- a -->\n> foo\n> bar\n> <!-- /a -->\n');
		expect(await commentMark(result, { a: 'foo\nbar' })).toBe(result);
	});
});

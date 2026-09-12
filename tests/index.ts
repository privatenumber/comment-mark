import { readFile } from 'node:fs/promises';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { commentMark, getCommentMarks } from '#comment-mark';
import { commentMarkCli } from './utils/comment-mark-cli.js';

describe('edge cases', () => {
	test('no arguments', () => {
		// @ts-expect-error No arguments passed in
		const output = commentMark();
		expect(output).toBe(undefined);
	});

	test('empty str', () => {
		const output = commentMark('', {});
		expect(output).toBe('');
	});

	test('invalid obj', () => {
		// @ts-expect-error Invalid argument passed in
		const output = commentMark('', 1);
		expect(output).toBe('');
	});

	test('no end-tag', () => {
		const inp = '<!-- a:start -->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrow('[comment-mark] No end comment found for key "a"');
	});

	test('reversed end-tag', () => {
		const inp = '<!--a:end--><!--a:start -->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrow('[comment-mark] No end comment found for key "a"');
	});
});

describe('valid', () => {
	test('basic', () => {
		const output = commentMark('<!-- a:start --><!-- a:end -->', {
			a: 'hello world',
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});

	test('skip nullish properties', () => {
		const output = commentMark('<!-- a:start -->hello world<!-- a:end -->', {
			a: undefined,
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});

	test('multi-line', () => {
		const output = commentMark(`
			# multiline
			<!-- a:start -->hello world<!-- a:end -->
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!-- a:start -->\nhello world\n\ngoogbye world\nhello again\n<!-- a:end -->\n\t\t');
	});

	test('multiple', () => {
		const output = commentMark(`
			<!-- a:start --><!-- a:end -->
			<!-- b:start --><!-- b:end -->
			<!-- ba:start --><!-- ba:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});
		expect(output).toBe('\n\t\t\t<!-- a:start -->hello world<!-- a:end -->\n\t\t\t<!-- b:start -->goodbye world<!-- b:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end -->\n\t\t');
	});

	test('duplicate', () => {
		const output = commentMark(`
			<!-- a:start--><!-- a:end -->
			<!--ba:start --><!--ba:end -->
			<!-- b:start --><!-- b:end -->
			<!-- ba:start --><!-- ba:end -->
			<!--a:start --><!-- a:end -->
			<!-- b:start --><!--b:end -->
			<!-- ba:start --><!--ba:end -->
			<!--a:start --><!-- a:end -->
			<!-- ba:start --><!-- ba:end-->
			<!-- b:start--><!-- b:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});
		expect(output).toBe('\n\t\t\t<!-- a:start-->hello world<!-- a:end -->\n\t\t\t<!--ba:start -->something world<!--ba:end -->\n\t\t\t<!-- b:start -->goodbye world<!-- b:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end -->\n\t\t\t<!--a:start -->hello world<!-- a:end -->\n\t\t\t<!-- b:start -->goodbye world<!--b:end -->\n\t\t\t<!-- ba:start -->something world<!--ba:end -->\n\t\t\t<!--a:start -->hello world<!-- a:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end-->\n\t\t\t<!-- b:start-->goodbye world<!-- b:end -->\n\t\t');
	});

	test('intersecting', () => {
		const output = commentMark(`
			<!-- a:start --><!-- b:start --><!-- a:end --><<!-- b:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
		});
		// console.log(3, JSON.stringify(output));
		expect(output).toBe('\n\t\t\t<!-- a:start -->hello world<!-- a:end --><<!-- b:end -->\n\t\t');
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from('<!-- a:start --><!-- a:end -->'), {
			a: 'hello world',
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});
});

describe('getCommentMarks', () => {
	test('returns marked contents', () => {
		const commentMarks = getCommentMarks(`
			<!-- a:start -->hello world<!-- a:end -->
			<!-- b:start -->
goodbye world
<!-- b:end -->
		`);

		expect(commentMarks).toEqual({
			a: 'hello world',
			b: '\ngoodbye world\n',
		});
	});

	test('returns an empty object when no sections exist', () => {
		expect(getCommentMarks('<!-- ordinary comment -->')).toEqual({});
	});

	test('returns empty marked contents', () => {
		expect(getCommentMarks('<!-- a:start --><!-- a:end -->')).toEqual({ a: '' });
	});

	test('throws when an end comment is absent', () => {
		expect(() => getCommentMarks('<!-- a:start -->')).toThrow('[comment-mark] No end comment found for key "a"');
	});

	test('throws when an end comment appears before its start comment', () => {
		expect(() => getCommentMarks('<!-- a:end --><!-- a:start -->')).toThrow('[comment-mark] No end comment found for key "a"');
	});

	test('uses the last duplicate section', () => {
		expect(getCommentMarks('<!-- a:start -->first<!-- a:end --><!--a:start-->last<!--a:end-->')).toEqual({ a: 'last' });
	});

	test('supports keys with special characters', () => {
		expect(getCommentMarks('<!-- a.b:c:start -->value<!-- a.b:c:end -->')).toEqual({ 'a.b:c': 'value' });
	});

	test('supports Buffer input', () => {
		expect(getCommentMarks(Buffer.from('<!-- a:start -->hello world<!-- a:end -->'))).toEqual({ a: 'hello world' });
	});

	test('round trips marked values', () => {
		const data = {
			a: 'hello world',
			b: 'goodbye world\nhello again',
		};
		const output = commentMark('<!-- a:start --><!-- a:end --><!-- b:start --><!-- b:end -->', data);

		expect(getCommentMarks(output)).toEqual({
			a: 'hello world',
			b: '\ngoodbye world\nhello again\n',
		});
	});

	test('round trips whitespace marker variants', () => {
		const output = commentMark('<!--  a:start   --><!--a:end-->', {
			a: 'hello world',
		});

		expect(getCommentMarks(output)).toEqual({ a: 'hello world' });
	});

	test('returned object has no inherited properties', () => {
		expect(getCommentMarks('<!-- a:start -->hello world<!-- a:end -->').toString).toBe(undefined);
	});

	test('supports keys named like Object properties', () => {
		const commentMarks = getCommentMarks('<!-- __proto__:start -->hello world<!-- __proto__:end -->');

		expect(Object.hasOwn(commentMarks, '__proto__')).toBe(true);
		expect(Object.entries(commentMarks)).toEqual([['__proto__', 'hello world']]);
	});

	test('treats whitespace around the marker key as formatting', () => {
		const output = commentMark('<!-- a:start --><!-- a:end -->', {
			' a': 'hello world',
		});

		expect(getCommentMarks(output)).toEqual({ a: 'hello world' });
	});
});

describe('CLI', () => {
	test('sources name, description, and version from package.json', async () => {
		const packageJson = JSON.parse(
			await readFile(new URL('../package.json', import.meta.url), 'utf8'),
		) as {
			name: string;
			description: string;
			version: string;
		};

		const { stdout: versionOutput } = await commentMarkCli('--version');
		expect(versionOutput).toBe(packageJson.version);

		const { stdout: helpOutput } = await commentMarkCli('--help');
		expect(helpOutput).toContain(packageJson.name);
		expect(helpOutput).toContain(packageJson.description);

		const { stdout: shortHelpOutput } = await commentMarkCli('-h');
		expect(shortHelpOutput).toBe(helpOutput);
	});

	test('lists detected values as JSON when no marker flags are passed', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- a:start -->hello world<!-- a:end -->\n<!-- b:start -->\nmulti\nline\n<!-- b:end -->\n',
		});

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual({
			a: 'hello world',
			b: '\nmulti\nline\n',
		});
	});

	test('prints an empty JSON object in get mode when no markers exist', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- ordinary comment -->\n' });

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual({});
	});

	test('allows setting markers named like control flags', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- help:start -->stale<!-- help:end -->\n<!-- version:start -->1.0.0<!-- version:end -->\n',
		});

		await commentMarkCli(fixture.getPath('README.md'), '--help=docs', '--version=2.0.0');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'<!-- help:start -->docs<!-- help:end -->\n<!-- version:start -->2.0.0<!-- version:end -->\n',
		);
	});

	test('updates a marked section in place', async () => {
		await using fixture = await createFixture({
			'README.md': '## Contributors\n<!-- contributors:start -->stale<!-- contributors:end -->\n',
		});

		await commentMarkCli(fixture.getPath('README.md'), '--contributors=Jane Doe');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'## Contributors\n<!-- contributors:start -->Jane Doe<!-- contributors:end -->\n',
		);
	});

	test('updates multiple markers with multiline values', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- a:start --><!-- a:end -->\n<!-- b:start --><!-- b:end -->\n',
		});

		await commentMarkCli(fixture.getPath('README.md'), '--a=first', '--b=second\nline');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'<!-- a:start -->first<!-- a:end -->\n<!-- b:start -->\nsecond\nline\n<!-- b:end -->\n',
		);
	});

	test('reports per-key outcomes and exits non-zero when markers are missing', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- a:start -->stale<!-- a:end -->\n<!-- b:start -->same<!-- b:end -->\n',
		});

		const invocation = commentMarkCli(fixture.getPath('README.md'), '--a=fresh', '--b=same', '--nope=x');

		await expect(invocation).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(/Updated: a[\s\S]*Unchanged: b[\s\S]*Missing: nope/),
		});
		await expect(invocation).rejects.toMatchObject({
			stderr: expect.stringMatching(/Saved .*\. Updated 1 key; 1 unchanged; 1 missing\./),
		});

		// Valid updates are still saved when other keys are missing.
		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'<!-- a:start -->fresh<!-- a:end -->\n<!-- b:start -->same<!-- b:end -->\n',
		);
	});

	test('exits successfully when all requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start -->same<!-- a:end -->' });

		const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--a=same');

		expect(stderr).toContain('is unchanged. All 1 requested values already match.');
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start -->same<!-- a:end -->');
	});

	test('exits non-zero without writing when every requested marker is missing', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start -->value<!-- a:end -->' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--nope1=x', '--nope2=y')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 2 requested keys'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start -->value<!-- a:end -->');
	});

	test('clears a section when the value is empty', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start -->gone<!-- a:end -->' });

		await commentMarkCli(fixture.getPath('README.md'), '--a=');

		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
	});

	test('exits non-zero when a valueless flag is passed', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start --><!-- a:end -->' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No value provided for flag "--a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
	});

	test('exits non-zero when the same flag is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start --><!-- a:end -->' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=1', '--a=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--a" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
	});

	test('exits non-zero on unexpected extra positional arguments', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start --><!-- a:end -->' });

		await expect(commentMarkCli(fixture.getPath('README.md'), 'extra', '--a=1')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unexpected extra arguments: extra'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
	});

	test('exits non-zero and leaves the file untouched when a marker is unterminated', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a:start -->never closed\n' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No end comment found for key "a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a:start -->never closed\n');
	});

	test('exits non-zero when the file does not exist', async () => {
		await expect(commentMarkCli('/nonexistent/path/README.md', '--a=hi')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('ENOENT'),
		});
	});
});

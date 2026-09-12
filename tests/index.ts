import { readFile } from 'node:fs/promises';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { commentMark, getCommentMarks, getCommentMarkers } from '#comment-mark';
import { commentMarkCli } from './utils/comment-mark-cli.js';

const marker = (id: string, content = '') => `<!--comment-mark id="${id}"-->${content}<!--/comment-mark-->`;

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

	test('no closing comment', () => {
		const inp = '<!--comment-mark id="a"-->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrow('[comment-mark] No closing comment found for marker "a"');
	});

	test('closing comment before opening comment', () => {
		const inp = '<!--/comment-mark--><!--comment-mark id="a"-->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrow('[comment-mark] No closing comment found for marker "a"');
	});

	test('no closing comment for an unnamed marker', () => {
		expect(() => getCommentMarkers('<!--comment-mark file="./a.md"-->')).toThrow(
			'[comment-mark] No closing comment found for marker without an id',
		);
	});
});

describe('valid', () => {
	test('basic', () => {
		const output = commentMark(marker('a'), {
			a: 'hello world',
		});
		expect(output).toBe(marker('a', 'hello world'));
	});

	test('skip nullish properties', () => {
		const output = commentMark(marker('a', 'hello world'), {
			a: undefined,
		});
		expect(output).toBe(marker('a', 'hello world'));
	});

	test('multi-line', () => {
		const output = commentMark(`
			# multiline
			${marker('a', 'hello world')}
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!--comment-mark id="a"-->\nhello world\n\ngoogbye world\nhello again\n<!--/comment-mark-->\n\t\t');
	});

	test('multiple', () => {
		const output = commentMark(`
			${marker('a')}
			${marker('b')}
			${marker('ba')}
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});

		expect(output).toBe(`\n\t\t\t${marker('a', 'hello world')}\n\t\t\t${marker('b', 'goodbye world')}\n\t\t\t${marker('ba', 'something world')}\n\t\t`);
	});

	test('updates every occurrence', () => {
		const output = commentMark(`${marker('a', 'one')}\n${marker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${marker('a', 'hello world')}\n${marker('a', 'hello world')}`);
	});

	test('leaves markers without a matching key untouched', () => {
		const output = commentMark(marker('a', 'hello world'), {
			b: 'goodbye world',
		});
		expect(output).toBe(marker('a', 'hello world'));
	});

	test('leaves markers without an id untouched', () => {
		const content = '<!--comment-mark file="./LICENSE.md"-->cached<!--/comment-mark-->';
		expect(commentMark(content, { license: 'x' })).toBe(content);
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from(marker('a')), {
			a: 'hello world',
		});
		expect(output).toBe(marker('a', 'hello world'));
	});
});

describe('attributes', () => {
	test('parses single-quoted values', () => {
		expect(getCommentMarkers("<!--comment-mark id='a b'-->x<!--/comment-mark-->")).toStrictEqual([
			{
				id: 'a b',
				attributes: {},
				content: 'x',
			},
		]);
	});

	test('parses unquoted values', () => {
		expect(getCommentMarkers('<!--comment-mark id=a-->x<!--/comment-mark-->')).toStrictEqual([
			{
				id: 'a',
				attributes: {},
				content: 'x',
			},
		]);
	});

	test('tolerates whitespace inside the tags', () => {
		const output = commentMark('<!-- comment-mark id = "a" -->x<!-- / comment-mark -->', {
			a: 'y',
		});
		expect(output).toBe('<!-- comment-mark id = "a" -->y<!-- / comment-mark -->');
	});

	test('preserves additional attributes', () => {
		expect(getCommentMarkers('<!--comment-mark id="license" file="./LICENSE.md"-->cached<!--/comment-mark-->')).toStrictEqual([
			{
				id: 'license',
				attributes: { file: './LICENSE.md' },
				content: 'cached',
			},
		]);
	});

	test('allows values containing = and /', () => {
		expect(getCommentMarkers('<!--comment-mark id="a" query="x=1&y=/z"-->x<!--/comment-mark-->')).toStrictEqual([
			{
				id: 'a',
				attributes: { query: 'x=1&y=/z' },
				content: 'x',
			},
		]);
	});

	test('supports markers without attributes', () => {
		expect(getCommentMarkers('<!--comment-mark-->x<!--/comment-mark-->')).toStrictEqual([
			{
				attributes: {},
				content: 'x',
			},
		]);
	});

	test('rejects duplicate attributes', () => {
		expect(() => getCommentMarkers('<!--comment-mark id="a" id="b"-->x<!--/comment-mark-->')).toThrow(
			'[comment-mark] Duplicate marker attribute: "id"',
		);
	});

	test('rejects malformed attributes', () => {
		expect(() => getCommentMarkers('<!--comment-mark id-->x<!--/comment-mark-->')).toThrow(
			'[comment-mark] Invalid marker attribute: "id"',
		);
	});
});

describe('code blocks', () => {
	test('ignores markers inside fenced code blocks', () => {
		const content = ['```md', marker('a', 'example'), '```'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'hello world' })).toBe(content);
	});

	test('ignores markers inside tilde fences', () => {
		const content = ['~~~', marker('a', 'example'), '~~~'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('ignores markers inside an unterminated fence', () => {
		const content = `\`\`\`\n${marker('a', 'example')}`;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('ignores markers inside inline code', () => {
		const content = `See \`${marker('a', 'example')}\` for details`;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('parses markers outside of code', () => {
		const content = `\`${marker('a', 'inline')}\`\n${marker('b', 'real')}`;
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'b',
				attributes: {},
				content: 'real',
			},
		]);
	});
});

describe('getCommentMarks', () => {
	test('returns marked contents', () => {
		const commentMarks = getCommentMarks(`
			${marker('a', 'hello world')}
			<!--comment-mark id="b"-->
goodbye world
<!--/comment-mark-->
		`);

		expect(commentMarks).toEqual({
			a: 'hello world',
			b: '\ngoodbye world\n',
		});
	});

	test('returns an empty object when no markers exist', () => {
		expect(getCommentMarks('<!-- ordinary comment -->')).toEqual({});
	});

	test('returns empty marked contents', () => {
		expect(getCommentMarks(marker('a'))).toEqual({ a: '' });
	});

	test('omits markers without an id', () => {
		expect(getCommentMarks('<!--comment-mark file="./a.md"-->x<!--/comment-mark-->')).toEqual({});
	});

	test('throws when a closing comment is absent', () => {
		expect(() => getCommentMarks('<!--comment-mark id="a"-->')).toThrow('[comment-mark] No closing comment found for marker "a"');
	});

	test('uses the last duplicate marker', () => {
		expect(getCommentMarks(`${marker('a', 'first')}${marker('a', 'last')}`)).toEqual({ a: 'last' });
	});

	test('supports ids with special characters', () => {
		expect(getCommentMarks('<!--comment-mark id="a.b:c"-->value<!--/comment-mark-->')).toEqual({ 'a.b:c': 'value' });
	});

	test('supports Buffer input', () => {
		expect(getCommentMarks(Buffer.from(marker('a', 'hello world')))).toEqual({ a: 'hello world' });
	});

	test('round trips marked values', () => {
		const data = {
			a: 'hello world',
			b: 'goodbye world\nhello again',
		};
		const output = commentMark(`${marker('a')}${marker('b')}`, data);

		expect(getCommentMarks(output)).toEqual({
			a: 'hello world',
			b: '\ngoodbye world\nhello again\n',
		});
	});

	test('returned object has no inherited properties', () => {
		expect(getCommentMarks(marker('a', 'hello world')).toString).toBe(undefined);
	});

	test('supports ids named like Object properties', () => {
		const commentMarks = getCommentMarks(marker('__proto__', 'hello world'));

		expect(Object.hasOwn(commentMarks, '__proto__')).toBe(true);
		expect(Object.entries(commentMarks)).toEqual([['__proto__', 'hello world']]);
	});
});

describe('getCommentMarkers', () => {
	test('returns markers in document order', () => {
		expect(getCommentMarkers(`${marker('a', 'first')}\n${marker('b', 'second')}`)).toStrictEqual([
			{
				id: 'a',
				attributes: {},
				content: 'first',
			},
			{
				id: 'b',
				attributes: {},
				content: 'second',
			},
		]);
	});

	test('includes markers without an id', () => {
		expect(getCommentMarkers('<!--comment-mark file="./LICENSE.md"-->cached<!--/comment-mark-->')).toStrictEqual([
			{
				attributes: { file: './LICENSE.md' },
				content: 'cached',
			},
		]);
	});

	test('returns an empty array when no markers exist', () => {
		expect(getCommentMarkers('<!-- ordinary comment -->')).toStrictEqual([]);
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

	test('lists detected markers as JSON when no marker flags are passed', async () => {
		await using fixture = await createFixture({
			'README.md': `${marker('a', 'hello world')}\n<!--comment-mark id="b"-->\nmulti\nline\n<!--/comment-mark-->\n`,
		});

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([
			{
				id: 'a',
				attributes: {},
				content: 'hello world',
			},
			{
				id: 'b',
				attributes: {},
				content: '\nmulti\nline\n',
			},
		]);
	});

	test('prints an empty JSON array in get mode when no markers exist', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- ordinary comment -->\n' });

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([]);
	});

	test('allows setting markers named like control flags', async () => {
		await using fixture = await createFixture({
			'README.md': `${marker('help', 'stale')}\n${marker('version', '1.0.0')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--help=docs', '--version=2.0.0');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${marker('help', 'docs')}\n${marker('version', '2.0.0')}\n`,
		);
	});

	test('updates a marked section in place', async () => {
		await using fixture = await createFixture({
			'README.md': `## Contributors\n${marker('contributors', 'stale')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--contributors=Jane Doe');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`## Contributors\n${marker('contributors', 'Jane Doe')}\n`,
		);
	});

	test('updates multiple markers with multiline values', async () => {
		await using fixture = await createFixture({
			'README.md': `${marker('a')}\n${marker('b')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--a=first', '--b=second\nline');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${marker('a', 'first')}\n<!--comment-mark id="b"-->\nsecond\nline\n<!--/comment-mark-->\n`,
		);
	});

	test('reports per-key outcomes and exits non-zero when markers are missing', async () => {
		await using fixture = await createFixture({
			'README.md': `${marker('a', 'stale')}\n${marker('b', 'same')}\n`,
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
			`${marker('a', 'fresh')}\n${marker('b', 'same')}\n`,
		);
	});

	test('exits successfully when all requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a', 'same') });

		const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--a=same');

		expect(stderr).toContain('is unchanged. All 1 requested values already match.');
		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a', 'same'));
	});

	test('exits non-zero without writing when every requested marker is missing', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a', 'value') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--nope1=x', '--nope2=y')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 2 requested keys'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a', 'value'));
	});

	test('clears a section when the value is empty', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a', 'gone') });

		await commentMarkCli(fixture.getPath('README.md'), '--a=');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a'));
	});

	test('exits non-zero when a valueless flag is passed', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No value provided for flag "--a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a'));
	});

	test('exits non-zero when the same flag is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=1', '--a=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--a" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a'));
	});

	test('exits non-zero on unexpected extra positional arguments', async () => {
		await using fixture = await createFixture({ 'README.md': marker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), 'extra', '--a=1')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unexpected extra arguments: extra'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(marker('a'));
	});

	test('exits non-zero and leaves the file untouched when a marker is unterminated', async () => {
		await using fixture = await createFixture({ 'README.md': '<!--comment-mark id="a"-->never closed\n' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No closing comment found for marker "a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!--comment-mark id="a"-->never closed\n');
	});

	test('exits non-zero when the file does not exist', async () => {
		await expect(commentMarkCli('/nonexistent/path/README.md', '--a=hi')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('ENOENT'),
		});
	});
});

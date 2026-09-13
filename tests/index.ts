import { readFile } from 'node:fs/promises';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { commentMark, getCommentMarks, getCommentMarkers } from '#comment-mark';
import { commentMarkCli } from './utils/comment-mark-cli.js';

const createMarker = (id: string, content = '') => `<!--comment-mark id="${id}"-->${content}<!--/comment-mark-->`;

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

	test('rejects nested markers', () => {
		expect(() => getCommentMarkers(
			'<!--comment-mark id="a"-->outer<!--comment-mark id="b"-->inner<!--/comment-mark-->',
		)).toThrow('[comment-mark] Nested marker "b" is not supported');
	});

	test('rejects nested markers without an id', () => {
		expect(() => getCommentMarkers(
			'<!--comment-mark id="a"-->outer<!--comment-mark file="./b.md"-->inner<!--/comment-mark-->',
		)).toThrow('[comment-mark] Nested marker without an id is not supported');
	});

	test('ignores an unmatched closing comment', () => {
		expect(getCommentMarkers(`${createMarker('a', 'value')}<!--/comment-mark-->`)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: 'value',
			},
		]);
	});

	test('scans many unterminated openers without rescanning', () => {
		// A document with a long run of `<!--` and no `-->` must not trigger a
		// terminator search at every opener.
		expect(getCommentMarkers('<!--comment-mark '.repeat(50_000))).toStrictEqual([]);
	});
});

describe('valid', () => {
	test('basic', () => {
		const output = commentMark(createMarker('a'), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('skip nullish properties', () => {
		const output = commentMark(createMarker('a', 'hello world'), {
			a: undefined,
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('multi-line', () => {
		const output = commentMark(`
			# multiline
			${createMarker('a', 'hello world')}
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!--comment-mark id="a"-->\nhello world\n\ngoogbye world\nhello again\n<!--/comment-mark-->\n\t\t');
	});

	test('multiple', () => {
		const output = commentMark(`
			${createMarker('a')}
			${createMarker('b')}
			${createMarker('ba')}
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});

		expect(output).toBe(`\n\t\t\t${createMarker('a', 'hello world')}\n\t\t\t${createMarker('b', 'goodbye world')}\n\t\t\t${createMarker('ba', 'something world')}\n\t\t`);
	});

	test('updates every occurrence', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${createMarker('a', 'hello world')}\n${createMarker('a', 'hello world')}`);
	});

	test('leaves markers without a matching key untouched', () => {
		const output = commentMark(createMarker('a', 'hello world'), {
			b: 'goodbye world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('leaves markers without an id untouched', () => {
		const content = '<!--comment-mark file="./LICENSE.md"-->cached<!--/comment-mark-->';
		expect(commentMark(content, { license: 'x' })).toBe(content);
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from(createMarker('a')), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});
});

describe('attributes', () => {
	test('parses single-quoted values', () => {
		expect(getCommentMarkers("<!--comment-mark id='a b'-->x<!--/comment-mark-->")).toStrictEqual([
			{
				id: 'a b',
				attrs: {},
				content: 'x',
			},
		]);
	});

	test('parses unquoted values', () => {
		expect(getCommentMarkers('<!--comment-mark id=a-->x<!--/comment-mark-->')).toStrictEqual([
			{
				id: 'a',
				attrs: {},
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
				attrs: { file: './LICENSE.md' },
				content: 'cached',
			},
		]);
	});

	test('allows values containing = and /', () => {
		expect(getCommentMarkers('<!--comment-mark id="a" query="x=1&y=/z"-->x<!--/comment-mark-->')).toStrictEqual([
			{
				id: 'a',
				attrs: { query: 'x=1&y=/z' },
				content: 'x',
			},
		]);
	});

	test('supports markers without attributes', () => {
		expect(getCommentMarkers('<!--comment-mark-->x<!--/comment-mark-->')).toStrictEqual([
			{
				attrs: {},
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

	test('requires whitespace between attributes', () => {
		expect(() => getCommentMarkers('<!--comment-mark id="a"file="./b.md"-->x<!--/comment-mark-->')).toThrow(
			'[comment-mark] Expected whitespace between attributes',
		);
	});

	test('rejects an unterminated attribute value', () => {
		expect(() => getCommentMarkers('<!--comment-mark id="a-->x<!--/comment-mark-->')).toThrow(
			'[comment-mark] Unterminated attribute value for "id"',
		);
	});

	test('rejects a quote inside an unquoted value', () => {
		expect(() => getCommentMarkers('<!--comment-mark id=a"b"-->x<!--/comment-mark-->')).toThrow(
			'Invalid marker attribute',
		);
	});

	test('treats an empty id as absent', () => {
		expect(getCommentMarkers('<!--comment-mark id=""-->x<!--/comment-mark-->')).toStrictEqual([
			{
				attrs: {},
				content: 'x',
			},
		]);
		expect(getCommentMarks('<!--comment-mark id=""-->x<!--/comment-mark-->')).toEqual({});
	});
});

describe('comment and code boundaries', () => {
	test('a fenced example containing <!-- does not hide the next marker', () => {
		const content = ['```html', '<!--', '```', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['```html', '<!--', '```', createMarker('x', 'NEW')].join('\n'),
		);
	});

	test('an inline example containing <!-- does not hide the next marker', () => {
		const content = `\`<!--\` ${createMarker('x', 'old')}`;

		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(`\`<!--\` ${createMarker('x', 'NEW')}`);
	});

	test('a backtick in an attribute value does not hide the closing comment', () => {
		const content = '<!--comment-mark id="x" note="`"-->old<!--/comment-mark-->`';

		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: { note: '`' },
				content: 'old',
			},
		]);
	});

	test('a fence-looking line inside an HTML comment does not hide later markers', () => {
		const content = ['<!--', '```', '-->', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['<!--', '```', '-->', createMarker('x', 'NEW')].join('\n'),
		);
	});
});

describe('code blocks', () => {
	test('ignores markers inside fenced code blocks', () => {
		const content = ['```md', createMarker('a', 'example'), '```'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'hello world' })).toBe(content);
	});

	test('ignores markers inside tilde fences', () => {
		const content = ['~~~', createMarker('a', 'example'), '~~~'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('ignores markers inside an unterminated fence', () => {
		const content = `\`\`\`\n${createMarker('a', 'example')}`;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('ignores markers inside inline code', () => {
		const content = `See \`${createMarker('a', 'example')}\` for details`;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('parses markers outside of code', () => {
		const content = `\`${createMarker('a', 'inline')}\`\n${createMarker('b', 'real')}`;
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'b',
				attrs: {},
				content: 'real',
			},
		]);
	});

	test('a closing marker inside a fence does not close a marker', () => {
		const content = '<!--comment-mark id="a"-->\n```md\n<!--/comment-mark-->\n```\nKEEP\n<!--/comment-mark-->';

		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: '\n```md\n<!--/comment-mark-->\n```\nKEEP\n',
			},
		]);
		expect(commentMark(content, { a: 'NEW' })).toBe('<!--comment-mark id="a"-->NEW<!--/comment-mark-->');
	});

	test('a closing fence with trailing text does not close the fence', () => {
		const content = `\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`not-a-close\n${createMarker('b', 'real')}\n\`\`\``;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('a longer fence contains shorter fences', () => {
		const content = `\`\`\`\`\n\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`\n\`\`\`\``;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('ignores markers in blockquote fences', () => {
		const content = `> \`\`\`md\n> ${createMarker('a', 'example')}\n> \`\`\``;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('an escaped backtick does not open inline code', () => {
		const content = `\\\`${createMarker('a', 'real')}\``;
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: 'real',
			},
		]);
	});

	test('an unterminated inline code span does not hide later markers', () => {
		const content = `\`unclosed\n${createMarker('a', 'real')}`;
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: 'real',
			},
		]);
	});

	test('two backslashes before an opening backtick do not escape it', () => {
		// The backslashes escape each other, so the backtick still opens a span.
		const content = `\\\\\`${createMarker('x', 'example')}\``;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('a backslash before a closing backtick does not escape it inside a span', () => {
		const content = `\`${createMarker('x', 'example')}\\\``;
		expect(getCommentMarkers(content)).toStrictEqual([]);
	});

	test('a blockquote fence line inside a top-level fence does not close it', () => {
		const content = ['```md', '> ```', createMarker('x', 'example'), '```'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a blockquote that ends before its unclosed fence does not hide later markers', () => {
		const content = ['> ```', '> code', '', createMarker('x', 'real')].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'real',
			},
		]);
	});

	test('a backtick in a fence info string does not open a fence', () => {
		const content = ['``` `', createMarker('x', 'real'), '```'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'real',
			},
		]);
	});

	test('a fence indented to a list item content column is recognized', () => {
		const content = ['1. item', '', '    ```', `    ${createMarker('x', 'example')}`, '    ```'].join('\n');
		expect(getCommentMarkers(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});
});

describe('parser scaling', () => {
	test('parses adversarial backtick runs within a linear-time budget', () => {
		// A line whose backtick runs all have distinct lengths forces the
		// inline scanner to search the rest of the line for each run.
		const runs: string[] = [];
		for (let length = 1; length <= 2048; length += 1) {
			runs.push('`'.repeat(length));
		}
		const content = `${runs.join(' ')} ${createMarker('x', 'value')}`;

		const start = performance.now();
		const markers = getCommentMarkers(content);
		const elapsed = performance.now() - start;

		expect(markers).toStrictEqual([
			{
				id: 'x',
				attrs: {},
				content: 'value',
			},
		]);
		expect(elapsed).toBeLessThan(1500);
	});
});

describe('getCommentMarks', () => {
	test('returns marked contents', () => {
		const commentMarks = getCommentMarks(`
			${createMarker('a', 'hello world')}
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
		expect(getCommentMarks(createMarker('a'))).toEqual({ a: '' });
	});

	test('omits markers without an id', () => {
		expect(getCommentMarks('<!--comment-mark file="./a.md"-->x<!--/comment-mark-->')).toEqual({});
	});

	test('throws when a closing comment is absent', () => {
		expect(() => getCommentMarks('<!--comment-mark id="a"-->')).toThrow('[comment-mark] No closing comment found for marker "a"');
	});

	test('uses the last duplicate marker', () => {
		expect(getCommentMarks(`${createMarker('a', 'first')}${createMarker('a', 'last')}`)).toEqual({ a: 'last' });
	});

	test('supports ids with special characters', () => {
		expect(getCommentMarks('<!--comment-mark id="a.b:c"-->value<!--/comment-mark-->')).toEqual({ 'a.b:c': 'value' });
	});

	test('supports Buffer input', () => {
		expect(getCommentMarks(Buffer.from(createMarker('a', 'hello world')))).toEqual({ a: 'hello world' });
	});

	test('round trips marked values', () => {
		const data = {
			a: 'hello world',
			b: 'goodbye world\nhello again',
		};
		const output = commentMark(`${createMarker('a')}${createMarker('b')}`, data);

		expect(getCommentMarks(output)).toEqual({
			a: 'hello world',
			b: '\ngoodbye world\nhello again\n',
		});
	});

	test('returned object has no inherited properties', () => {
		expect(getCommentMarks(createMarker('a', 'hello world')).toString).toBe(undefined);
	});

	test('supports ids named like Object properties', () => {
		const commentMarks = getCommentMarks(createMarker('__proto__', 'hello world'));

		expect(Object.hasOwn(commentMarks, '__proto__')).toBe(true);
		expect(Object.entries(commentMarks)).toEqual([['__proto__', 'hello world']]);
	});
});

describe('getCommentMarkers', () => {
	test('returns markers in document order', () => {
		expect(getCommentMarkers(`${createMarker('a', 'first')}\n${createMarker('b', 'second')}`)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: 'first',
			},
			{
				id: 'b',
				attrs: {},
				content: 'second',
			},
		]);
	});

	test('includes markers without an id', () => {
		expect(getCommentMarkers('<!--comment-mark file="./LICENSE.md"-->cached<!--/comment-mark-->')).toStrictEqual([
			{
				attrs: { file: './LICENSE.md' },
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
			'README.md': `${createMarker('a', 'hello world')}\n<!--comment-mark id="b"-->\nmulti\nline\n<!--/comment-mark-->\n`,
		});

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([
			{
				id: 'a',
				attrs: {},
				content: 'hello world',
			},
			{
				id: 'b',
				attrs: {},
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
			'README.md': `${createMarker('help', 'stale')}\n${createMarker('version', '1.0.0')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--help=docs', '--version=2.0.0');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('help', 'docs')}\n${createMarker('version', '2.0.0')}\n`,
		);
	});

	test('updates a marked section in place', async () => {
		await using fixture = await createFixture({
			'README.md': `## Contributors\n${createMarker('contributors', 'stale')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--contributors=Jane Doe');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`## Contributors\n${createMarker('contributors', 'Jane Doe')}\n`,
		);
	});

	test('updates multiple markers with multiline values', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a')}\n${createMarker('b')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--a=first', '--b=second\nline');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('a', 'first')}\n<!--comment-mark id="b"-->\nsecond\nline\n<!--/comment-mark-->\n`,
		);
	});

	test('reports per-key outcomes and exits non-zero when markers are missing', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a', 'stale')}\n${createMarker('b', 'same')}\n`,
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
			`${createMarker('a', 'fresh')}\n${createMarker('b', 'same')}\n`,
		);
	});

	test('exits successfully when all requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'same') });

		const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--a=same');

		expect(stderr).toContain('is unchanged. All 1 requested values already match.');
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'same'));
	});

	test('exits non-zero without writing when every requested marker is missing', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'value') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--nope1=x', '--nope2=y')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 2 requested keys'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'value'));
	});

	test('clears a section when the value is empty', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'gone') });

		await commentMarkCli(fixture.getPath('README.md'), '--a=');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('exits non-zero when a valueless flag is passed', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No value provided for flag "--a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('exits non-zero when the same flag is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=1', '--a=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--a" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('exits non-zero on unexpected extra positional arguments', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), 'extra', '--a=1')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unexpected extra arguments: extra'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
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

	test('reports missing keys when the remaining requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'same') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=same', '--nope=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(/Unchanged: a[\s\S]*Missing: nope/),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'same'));
	});

	test('updates a marker named like an Object prototype property', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('__proto__', 'old') });

		await commentMarkCli(fixture.getPath('README.md'), '--__proto__=NEW');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('__proto__', 'NEW'));
	});

	test('exits non-zero when a reserved marker name is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('__proto__') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--__proto__=1', '--__proto__=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--__proto__" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('__proto__'));
	});
});

import {
	mkdtemp, rm, writeFile, readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, test, expect } from 'manten';
import { commentMark, getCommentMarks } from '#comment-mark';

const execFileAsync = promisify(execFile);
const cliPath = new URL('../dist/cli.mjs', import.meta.url).pathname;

const runCli = (...args: string[]) => execFileAsync('node', [cliPath, ...args], {
	encoding: 'utf8',
});

const createMarkdownFile = async (content: string) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'comment-mark-cli-'));
	const filePath = path.join(directory, 'README.md');
	await writeFile(filePath, content, 'utf8');
	return {
		filePath,
		cleanup: async () => {
			await rm(directory, {
				recursive: true,
				force: true,
			});
		},
	};
};

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
	test('updates a marked section in place', async () => {
		const file = await createMarkdownFile(
			'## Contributors\n<!-- contributors:start -->stale<!-- contributors:end -->\n',
		);

		try {
			await runCli(file.filePath, '--contributors=Jane Doe');

			expect(await readFile(file.filePath, 'utf8')).toBe(
				'## Contributors\n<!-- contributors:start -->Jane Doe<!-- contributors:end -->\n',
			);
		} finally {
			await file.cleanup();
		}
	});

	test('updates multiple markers with multiline values', async () => {
		const file = await createMarkdownFile(
			'<!-- a:start --><!-- a:end -->\n<!-- b:start --><!-- b:end -->\n',
		);

		try {
			await runCli(file.filePath, '--a=first', '--b=second\nline');

			expect(await readFile(file.filePath, 'utf8')).toBe(
				'<!-- a:start -->first<!-- a:end -->\n<!-- b:start -->\nsecond\nline\n<!-- b:end -->\n',
			);
		} finally {
			await file.cleanup();
		}
	});

	test('prints updated content to stdout without a marker flag', async () => {
		const file = await createMarkdownFile('<!-- a:start -->value<!-- a:end -->');

		try {
			const { stdout } = await runCli(file.filePath);

			expect(stdout).toBe('<!-- a:start -->value<!-- a:end -->');
			expect(await readFile(file.filePath, 'utf8')).toBe('<!-- a:start -->value<!-- a:end -->');
		} finally {
			await file.cleanup();
		}
	});

	test('exits non-zero when a valueless flag is passed', async () => {
		const file = await createMarkdownFile('<!-- a:start --><!-- a:end -->');

		try {
			await expect(runCli(file.filePath, '--a')).rejects.toThrow(/No value provided for flag "--a"/);
			expect(await readFile(file.filePath, 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
		} finally {
			await file.cleanup();
		}
	});

	test('leaves the file untouched when a marker is missing from the file', async () => {
		const file = await createMarkdownFile('<!-- a:start --><!-- a:end -->');

		try {
			await runCli(file.filePath, '--missing=hi');

			// commentMark ignores data keys with no matching marker, so the CLI
			// succeeds while the file stays as-is.
			expect(await readFile(file.filePath, 'utf8')).toBe('<!-- a:start --><!-- a:end -->');
		} finally {
			await file.cleanup();
		}
	});

	test('exits non-zero when the file does not exist', async () => {
		await expect(runCli('/nonexistent/path/README.md', '--a=hi')).rejects.toThrow(/ENOENT/);
	});
});

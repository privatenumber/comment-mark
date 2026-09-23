import { readFile } from 'node:fs/promises';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { createMarker } from '../utils/create-marker.ts';
import { commentMarkCli } from '../utils/comment-mark-cli.ts';

describe('CLI', () => {
	test('sources name, description, and version from package.json', async () => {
		const packageJson = JSON.parse(
			await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
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

	test('lists detected markers as JSON when no selector flags are passed', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a', 'hello world')}\n<!-- b -->\nmulti\nline\n<!-- /b -->\n`,
		});

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'hello world',
			},
			{
				tagName: 'b',
				attributes: {},
				content: '\nmulti\nline\n',
			},
		]);
	});

	test('prints an empty JSON array in read mode when no markers exist', async () => {
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

	test('selects a marker by attribute', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
		});

		await commentMarkCli(fixture.getPath('README.md'), "--item[kind='fruit']=pear");

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'<!-- item kind="fruit" -->pear<!-- /item -->\n',
		);
	});

	test('updates multiple markers with multiline values', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a')}\n${createMarker('b')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--a=first', '--b=second\nline');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('a', 'first')}\n<!-- b -->\nsecond\nline\n<!-- /b -->\n`,
		);
	});

	test('reports per-selector outcomes and exits non-zero when markers are missing', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a', 'stale')}\n${createMarker('b', 'same')}\n`,
		});

		const invocation = commentMarkCli(fixture.getPath('README.md'), '--a=fresh', '--b=same', '--nope=x');

		await expect(invocation).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(/Updated: a[\s\S]*Unchanged: b[\s\S]*Missing: nope/),
		});
		await expect(invocation).rejects.toMatchObject({
			stderr: expect.stringMatching(/Saved .*\. Updated 1 selector; 1 unchanged; 1 missing\./),
		});

		// Valid updates are still saved when other selectors are missing.
		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('a', 'fresh')}\n${createMarker('b', 'same')}\n`,
		);
	});

	test('exits successfully when all requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'same') });

		const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--a=same');

		expect(stderr).toContain('is unchanged. All 1 requested selectors already match.');
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'same'));
	});

	test('exits non-zero without writing when every requested marker is missing', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'value') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--nope1=x', '--nope2=y')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 2 requested selectors'),
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

	test('rejects a single-dash flag instead of reading the file', async () => {
		// cleye would split `-a=new` into short flags and the selector would
		// disappear, leaving read mode to exit 0 without updating anything.
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'old') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '-a=new')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unknown flag "-a=new"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'old'));
	});

	test('exits non-zero when a control flag is repeated', async () => {
		// A repeated `--help` must not fall through to read mode.
		await expect(commentMarkCli('--help', '--help')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--help" was specified 2 times'),
		});
	});

	test('counts the short help alias toward the duplicate check', async () => {
		await expect(commentMarkCli('-h', '-h')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--help" was specified 2 times'),
		});
	});

	test('rejects a duplicate control flag before showing help', async () => {
		// The bare flag and the valued flag are the same name, so the outcome
		// must not depend on which one comes first.
		await expect(commentMarkCli('--help', '--help=docs')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--help" was specified 2 times'),
		});
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

	test('reports an unterminated marker as missing and leaves the file untouched', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a -->never closed\n' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 1 requested selectors'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a -->never closed\n');
	});

	test('exits non-zero when the file does not exist', async () => {
		await expect(commentMarkCli('/nonexistent/path/README.md', '--a=hi')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('ENOENT'),
		});
	});

	test('reports missing selectors when the remaining requested values already match', async () => {
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

	describe('attribute updates', () => {
		test('updates an attribute and preserves the other attributes and content', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" size="small" -->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), '--item.kind=vegetable');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="vegetable" size="small" -->apple<!-- /item -->\n',
			);
		});

		test('adds an attribute the marker did not have', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), '--item.updated=2026-09-23');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" updated="2026-09-23" -->apple<!-- /item -->\n',
			);
		});

		test('sets an empty attribute value', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), '--item.kind=');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="" -->apple<!-- /item -->\n',
			);
		});

		test('updates content and attributes together, independent of flag order', async () => {
			const content = '<!-- item kind="fruit" -->apple<!-- /item -->\n';
			const expected = '<!-- item kind="vegetable" -->pear<!-- /item -->\n';

			await using first = await createFixture({ 'README.md': content });
			await commentMarkCli(first.getPath('README.md'), '--item=pear', '--item.kind=vegetable');
			expect(await first.readFile('README.md', 'utf8')).toBe(expected);

			await using second = await createFixture({ 'README.md': content });
			await commentMarkCli(second.getPath('README.md'), '--item.kind=vegetable', '--item=pear');
			expect(await second.readFile('README.md', 'utf8')).toBe(expected);
		});

		test('narrows by an attribute predicate and updates another attribute', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), "--item[kind='fruit'].size=large");

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" size="large" -->apple<!-- /item -->\n',
			);
		});

		test('treats a dot inside a predicate value as part of the selector', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item file="package.json" -->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), "--item[file='package.json'].kind=metadata");

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item file="package.json" kind="metadata" -->apple<!-- /item -->\n',
			);
		});

		test('updates only the first match', async () => {
			await using fixture = await createFixture({
				'README.md': `${createMarker('item', 'one')}\n${createMarker('item', 'two')}\n`,
			});

			await commentMarkCli(fixture.getPath('README.md'), '--item.role=first');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				`<!-- item role="first" -->one<!-- /item -->\n${createMarker('item', 'two')}\n`,
			);
		});

		test('preserves the written attribute formatting', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item\n  kind\n    =\n    "fruit"\n-->apple<!-- /item -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), '--item.kind=vegetable');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item\n  kind\n    =\n    "vegetable"\n-->apple<!-- /item -->\n',
			);
		});

		test('adds the CLI newline padding to multiline content with an attribute', async () => {
			await using fixture = await createFixture({ 'README.md': createMarker('item') });

			await commentMarkCli(fixture.getPath('README.md'), '--item=first\nline', '--item.role=note');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item role="note" -->\nfirst\nline\n<!-- /item -->',
			);
		});

		test('keeps markers named like control flags attribute-settable', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- help kind="old" -->docs<!-- /help -->\n',
			});

			await commentMarkCli(fixture.getPath('README.md'), '--help.kind=new');

			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- help kind="new" -->docs<!-- /help -->\n',
			);
		});

		test('counts several fields under one selector as one result', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			const { stderr } = await commentMarkCli(
				fixture.getPath('README.md'),
				'--item.kind=vegetable',
				'--item.size=small',
			);

			expect(stderr).toMatch(/Updated: item/);
			expect(stderr).toContain('Updated 1 selector.');
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="vegetable" size="small" -->apple<!-- /item -->\n',
			);
		});

		test('reports an already-matching attribute as unchanged', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--item.kind=fruit');

			expect(stderr).toContain('is unchanged. All 1 requested selectors already match.');
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" -->apple<!-- /item -->\n',
			);
		});

		test('saves matched attribute updates while reporting a missing selector', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await expect(commentMarkCli(
				fixture.getPath('README.md'),
				'--item.kind=vegetable',
				'--nope.kind=x',
			)).rejects.toMatchObject({
				exitCode: 1,
				stderr: expect.stringMatching(/Updated: item[\s\S]*Missing: nope/),
			});
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="vegetable" -->apple<!-- /item -->\n',
			);
		});

		test('rejects an invalid attribute name before writing', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await expect(commentMarkCli(fixture.getPath('README.md'), '--item.=x')).rejects.toMatchObject({
				exitCode: 1,
				stderr: expect.stringContaining('Invalid attribute name'),
			});
			await expect(commentMarkCli(fixture.getPath('README.md'), '--item.kind.extra=x')).rejects.toMatchObject({
				exitCode: 1,
				stderr: expect.stringContaining('Invalid attribute name'),
			});
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" -->apple<!-- /item -->\n',
			);
		});

		test('rejects a repeated assignment to the same attribute', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await expect(commentMarkCli(
				fixture.getPath('README.md'),
				'--item.kind=a',
				'--item.kind=b',
			)).rejects.toMatchObject({
				exitCode: 1,
				stderr: expect.stringContaining('Flag "--item.kind" was specified 2 times'),
			});
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" -->apple<!-- /item -->\n',
			);
		});

		test('leaves the file unchanged when an attribute value cannot be written', async () => {
			await using fixture = await createFixture({
				'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
			});

			await expect(commentMarkCli(fixture.getPath('README.md'), '--item.kind=x-->y')).rejects.toMatchObject({
				exitCode: 1,
				stderr: expect.stringContaining('cannot contain'),
			});
			expect(await fixture.readFile('README.md', 'utf8')).toBe(
				'<!-- item kind="fruit" -->apple<!-- /item -->\n',
			);
		});
	});
});

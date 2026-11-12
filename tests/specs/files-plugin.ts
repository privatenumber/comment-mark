import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import { commentMark } from '#comment-mark';
import { files } from '#comment-mark/plugins/files';

describe('files plugin', () => {
	test('rejects a file that hides a marker behind an unclosed fence', async () => {
		await using fixture = await createFixture({ 'bad.md': '\n```js\nx' });
		await expect(commentMark('Example: <!-- file path="bad.md" --><!-- /file -->', files({ baseDirectory: fixture.path })))
			.rejects.toThrow('[comment-mark] Replacement for "file" would change the document\'s markers');
	});
	test('inserts the file contents on their own lines', async () => {
		await using fixture = await createFixture({
			'hello.txt': 'Hello\nWorld\n',
		});

		const output = await commentMark(
			'<!-- file path="./hello.txt" -->\n<!-- /file -->',
			files({ baseDirectory: fixture.path }),
		);

		expect(output).toBe('<!-- file path="./hello.txt" -->\nHello\nWorld\n<!-- /file -->');
	});

	test('fills every matching marker', async () => {
		await using fixture = await createFixture({
			'a.txt': 'AAA',
			'b.txt': 'BBB',
		});

		const output = await commentMark(
			'<!-- file path="a.txt" --><!-- /file -->\n<!-- file path="b.txt" --><!-- /file -->',
			files({ baseDirectory: fixture.path }),
		);

		expect(output).toBe('<!-- file path="a.txt" -->\nAAA\n<!-- /file -->\n<!-- file path="b.txt" -->\nBBB\n<!-- /file -->');
	});

	test('resolves the path against baseDirectory', async () => {
		await using fixture = await createFixture({
			'nested/hello.txt': 'Hello',
		});

		const output = await commentMark(
			'<!-- file path="nested/hello.txt" --><!-- /file -->',
			files({ baseDirectory: fixture.path }),
		);

		expect(output).toBe('<!-- file path="nested/hello.txt" -->\nHello\n<!-- /file -->');
	});

	test('reads markers under a configured tag name', async () => {
		await using fixture = await createFixture({
			'hello.txt': 'Hello',
		});

		const output = await commentMark(
			'<!-- snippet path="hello.txt" --><!-- /snippet -->',
			files({
				baseDirectory: fixture.path,
				tagName: 'snippet',
			}),
		);

		expect(output).toBe('<!-- snippet path="hello.txt" -->\nHello\n<!-- /snippet -->');
	});

	test('leaves markers with another tag name alone', async () => {
		await using fixture = await createFixture({
			'hello.txt': 'Hello',
		});

		const document = '<!-- snippet path="hello.txt" --><!-- /snippet -->';

		expect(await commentMark(document, files({ baseDirectory: fixture.path }))).toBe(document);
	});

	test('composes with other replacements', async () => {
		await using fixture = await createFixture({
			'hello.txt': 'Hello',
		});

		const output = await commentMark(
			'<!-- file path="hello.txt" --><!-- /file -->\n<!-- version -->1.0.0<!-- /version -->',
			{
				...files({ baseDirectory: fixture.path }),
				version: '2.0.0',
			},
		);

		expect(output).toBe('<!-- file path="hello.txt" -->\nHello\n<!-- /file -->\n<!-- version -->\n2.0.0\n<!-- /version -->');
	});

	test('keeps a marker in the included file inside the section', async () => {
		await using fixture = await createFixture({
			'nested.md': '<!-- inner -->kept<!-- /inner -->',
		});

		const output = await commentMark(
			'<!-- file path="nested.md" --><!-- /file -->',
			files({ baseDirectory: fixture.path }),
		);

		expect(output).toBe('<!-- file path="nested.md" -->\n<!-- inner -->kept<!-- /inner -->\n<!-- /file -->');

		// The included marker is part of the section's content, so it is not a
		// marker to select, while the section itself can still be refreshed.
		await expect(commentMark(output, { inner: 'new' }))
			.rejects.toThrow('[comment-mark] Selector "inner" matched no markers');
		expect(await commentMark(output, files({ baseDirectory: fixture.path }))).toBe(output);
	});

	test('rejects a marker without a path attribute', async () => {
		await using fixture = await createFixture({});

		await expect(commentMark('<!-- file --><!-- /file -->', files({ baseDirectory: fixture.path })))
			.rejects.toThrow('[comment-mark] The "file" marker has no "path" attribute');
	});

	test('rejects when the file cannot be read', async () => {
		await using fixture = await createFixture({});

		await expect(commentMark('<!-- file path="missing.txt" --><!-- /file -->', files({ baseDirectory: fixture.path })))
			.rejects.toThrow('[comment-mark] Cannot read "missing.txt" for the "file" marker');
	});

	test('rejects when baseDirectory is missing', () => {
		// A JavaScript caller can omit the required option.
		expect(() => files({} as never)).toThrow('[comment-mark] files() requires a baseDirectory');
	});
});

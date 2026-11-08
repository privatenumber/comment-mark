import { describe, test, expect } from 'manten';
import { commentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('input handling', () => {
	test('no arguments', async () => {
		// @ts-expect-error No arguments passed in
		const output = await commentMark();
		expect(output).toBe(undefined);
	});

	test('empty str', async () => {
		const output = await commentMark('', {});
		expect(output).toBe('');
	});

	test('invalid obj', async () => {
		// @ts-expect-error Invalid argument passed in
		const output = await commentMark('', 1);
		expect(output).toBe('');
	});

	test('validates an empty string like any other input', async () => {
		// An empty string is valid input, so it parses and validates instead of
		// short-circuiting as a JavaScript-invalid argument.
		await expect(commentMark('', { 'a b': 'new' })).rejects.toThrow(
			'[comment-mark] Invalid selector: "a b"',
		);
		await expect(commentMark('', { x: ['new'] })).rejects.toThrow(
			'[comment-mark] Selector "x" matched 0 markers but received 1 values',
		);
	});
});

describe('replacement', () => {
	test('rejects changes to another marker\'s line context', async () => {
		await expect(commentMark('x <!-- a --><!-- /a --><!-- b --><!-- /b -->', {
			a: '\n',
			b: '**bold**',
		})).rejects.toThrow('would change the document\'s markers');
		await expect(commentMark('x <!-- a -->\n<!-- /a --><!-- b --><!-- /b -->', {
			a: 'text',
		})).rejects.toThrow('would change the document\'s markers');
		expect(await commentMark('x <!-- a --><!-- /a --><!-- b --><!-- /b -->', {
			a: 'first',
			b: 'second',
		})).toBe('x <!-- a -->first<!-- /a --><!-- b -->second<!-- /b -->');
	});
	test('rejects adding or removing a newline that changes later marker discovery', async () => {
		const tail = '\n2. ~~~\n   <!-- b -->old<!-- /b -->\n   ~~~';
		await expect(commentMark(`x <!-- a --><!-- /a -->${tail}`, { a: '\n' }))
			.rejects.toThrow('[comment-mark] Replacement for "a" would change the document\'s markers');
		await expect(commentMark(`x <!-- a -->\n<!-- /a -->${tail}`, { a: '' }))
			.rejects.toThrow('[comment-mark] Replacement for "a" would change the document\'s markers');
	});

	test('reports changed selectors but excludes no-op updates', async () => {
		const input = 'Example: <!-- a --><!-- /a -->\n\n<!-- b -->\nsame\n<!-- /b -->\n<!-- c -->old<!-- /c -->';
		await expect(commentMark(input, {
			a: '\n```js\nx',
			b: 'same',
			c: 'new',
		}))
			.rejects.toThrow('[comment-mark] Replacement for "a", "c" would change the document\'s markers');
	});
	test('rejects content that changes marker boundaries', async () => {
		const input = 'Example: <!-- a --><!-- /a -->\n\n<!-- b -->old<!-- /b -->';
		for (const content of ['```js\nx\n```', '\n```js\nx', '<!-- a -->', '<!-- note']) {
			await expect(commentMark(input, { a: content })).rejects.toThrow('[comment-mark] Replacement for "a" would change the document\'s markers');
		}
		expect(await commentMark(input, { b: 'new' })).toBe('Example: <!-- a --><!-- /a -->\n\n<!-- b -->\nnew\n<!-- /b -->');
	});

	test('accepts scanner-sensitive content that preserves marker boundaries', async () => {
		const input = 'Example: <!-- a --><!-- /a -->';
		for (const content of ['<br>', '`code`', '<!-- b -->inner<!-- /b -->']) {
			expect(await commentMark(input, { a: content })).toBe(`Example: <!-- a -->${content}<!-- /a -->`);
		}
	});
	test('returns a string for valid input', async () => {
		// The annotation is the contract: the resolved value is a string for
		// every supported call, not a document or a buffer.
		const output: string = await commentMark(createMarker('a', 'old'), { a: 'new' });
		expect(output).toBe(createMarker('a', '\nnew\n'));
	});

	test('basic', async () => {
		const output = await commentMark(createMarker('a'), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', '\nhello world\n'));
	});

	test('skip nullish properties', async () => {
		const output = await commentMark(createMarker('a', 'hello world'), {
			a: undefined,
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('multi-line', async () => {
		const output = await commentMark(`
			# multiline
			${createMarker('a', 'hello world')}
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!-- a -->\nhello world\n\ngoogbye world\nhello again\n<!-- /a -->\n\t\t');
	});

	test('multiple', async () => {
		const output = await commentMark(`
			${createMarker('a')}
			${createMarker('b')}
			${createMarker('ba')}
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});

		expect(output).toBe(`\n\t\t\t${createMarker('a', '\nhello world\n')}\n\t\t\t${createMarker('b', '\ngoodbye world\n')}\n\t\t\t${createMarker('ba', '\nsomething world\n')}\n\t\t`);
	});

	test('updates the first match for a scalar value', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${createMarker('a', '\nhello world\n')}\n${createMarker('a', 'two')}`);
	});

	test('updates matches by position for an array value', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first', 'second'],
		});
		expect(output).toBe(`${createMarker('a', '\nfirst\n')}\n${createMarker('a', '\nsecond\n')}`);
	});

	test('leaves matches beyond the array untouched', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first'],
		});
		expect(output).toBe(`${createMarker('a', '\nfirst\n')}\n${createMarker('a', 'two')}`);
	});

	test('lets a nullish entry skip a match', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [null, 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'one')}\n${createMarker('a', '\nsecond\n')}`);
	});

	test('an empty array changes nothing', async () => {
		const content = `${createMarker('a', 'one')}\n${createMarker('a', 'two')}`;
		expect(await commentMark(content, { a: [] })).toBe(content);
	});

	test('rejects more values than matches', async () => {
		await expect(commentMark(createMarker('a'), {
			a: ['one', 'two'],
		})).rejects.toThrow('[comment-mark] Selector "a" matched 1 marker but received 2 values');
	});

	test('rejects a function as an array entry', async () => {
		await expect(commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			// @ts-expect-error A function is the selector's value, not an array entry
			a: [null, () => 'new'],
		})).rejects.toThrow('[comment-mark] Selector "a" received a function at position 1; a function must be the selector value, not an array entry');
	});

	test('rejects two selectors targeting the same marker', async () => {
		const selector = 'a[id="x"]';

		await expect(commentMark('<!-- a id="x" -->v<!-- /a -->', {
			a: 'one',
			[selector]: 'two',
		})).rejects.toThrow(`[comment-mark] Selectors "a" and ${JSON.stringify(selector)} both target the marker "a"`);
	});

	test('rejects a selector that matches no markers', async () => {
		await expect(commentMark(createMarker('a', 'hello world'), {
			b: 'goodbye world',
		})).rejects.toThrow('[comment-mark] Selector "b" matched no markers');
	});

	test('rejects a nullish scalar whose selector matches no markers', async () => {
		await expect(commentMark(createMarker('a', 'hello world'), {
			b: undefined,
		})).rejects.toThrow('[comment-mark] Selector "b" matched no markers');
	});

	test('an empty array is a no-op even when nothing matches', async () => {
		const content = createMarker('a', 'hello world');
		expect(await commentMark(content, { b: [] })).toBe(content);
	});

	test('validates every selector before running a resolver', async () => {
		const calls: string[] = [];
		await expect(commentMark(`${createMarker('a', 'one')}\n${createMarker('b', 'two')}`, {
			a: () => {
				calls.push('a');
				return 'updated';
			},
			// A static value rejects a selector that matches nothing, so the
			// call fails before the `a` resolver runs.
			missing: 'updated',
		})).rejects.toThrow('[comment-mark] Selector "missing" matched no markers');
		expect(calls).toStrictEqual([]);
	});

	test('round trips source with no replacements byte for byte', async () => {
		const content = '<!-- a\n\tid = "x"  -->\r\nline\r\n<!-- /a -->\n';
		expect(await commentMark(content, {})).toBe(content);
	});

	test('Buffer', async () => {
		const output = await commentMark(Buffer.from(createMarker('a')), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', '\nhello world\n'));
	});
});

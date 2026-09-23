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
	test('returns a string for valid input', async () => {
		// The annotation is the contract: the resolved value is a string for
		// every supported call, not a document or a buffer.
		const output: string = await commentMark(createMarker('a', 'old'), { a: 'new' });
		expect(output).toBe(createMarker('a', 'new'));
	});

	test('basic', async () => {
		const output = await commentMark(createMarker('a'), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
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

		expect(output).toBe(`\n\t\t\t${createMarker('a', 'hello world')}\n\t\t\t${createMarker('b', 'goodbye world')}\n\t\t\t${createMarker('ba', 'something world')}\n\t\t`);
	});

	test('updates the first match for a scalar value', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${createMarker('a', 'hello world')}\n${createMarker('a', 'two')}`);
	});

	test('updates matches by position for an array value', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first', 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'second')}`);
	});

	test('leaves matches beyond the array untouched', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'two')}`);
	});

	test('lets a nullish entry skip a match', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [null, 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'one')}\n${createMarker('a', 'second')}`);
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
		expect(output).toBe(createMarker('a', 'hello world'));
	});
});

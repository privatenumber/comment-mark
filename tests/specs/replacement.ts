import { describe, test, expect } from 'manten';
import { commentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('input handling', () => {
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

	test('validates an empty string like any other input', () => {
		// An empty string is valid input, so it parses and validates instead of
		// short-circuiting as a JavaScript-invalid argument.
		expect(() => commentMark('', { 'a b': 'new' })).toThrow(
			'[comment-mark] Invalid selector: "a b"',
		);
		expect(() => commentMark('', { x: ['new'] })).toThrow(
			'[comment-mark] Selector "x" matched 0 markers but received 1 values',
		);
	});
});

describe('replacement', () => {
	test('returns a string for valid input', () => {
		// The annotation is the contract: the return type is a string for every
		// supported call, not a document or a buffer.
		const output: string = commentMark(createMarker('a', 'old'), { a: 'new' });
		expect(output).toBe(createMarker('a', 'new'));
	});

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

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!-- a -->\nhello world\n\ngoogbye world\nhello again\n<!-- /a -->\n\t\t');
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

	test('updates the first match for a scalar value', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${createMarker('a', 'hello world')}\n${createMarker('a', 'two')}`);
	});

	test('updates matches by position for an array value', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first', 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'second')}`);
	});

	test('leaves matches beyond the array untouched', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'two')}`);
	});

	test('lets a nullish entry skip a match', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [null, 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'one')}\n${createMarker('a', 'second')}`);
	});

	test('an empty array changes nothing', () => {
		const content = `${createMarker('a', 'one')}\n${createMarker('a', 'two')}`;
		expect(commentMark(content, { a: [] })).toBe(content);
	});

	test('rejects more values than matches', () => {
		expect(() => commentMark(createMarker('a'), {
			a: ['one', 'two'],
		})).toThrow('[comment-mark] Selector "a" matched 1 marker but received 2 values');
	});

	test('rejects two selectors targeting the same marker', () => {
		const selector = 'a[id="x"]';

		expect(() => commentMark('<!-- a id="x" -->v<!-- /a -->', {
			a: 'one',
			[selector]: 'two',
		})).toThrow(`[comment-mark] Selectors "a" and ${JSON.stringify(selector)} both target the marker "a"`);
	});

	test('rejects a selector that matches no markers', () => {
		expect(() => commentMark(createMarker('a', 'hello world'), {
			b: 'goodbye world',
		})).toThrow('[comment-mark] Selector "b" matched no markers');
	});

	test('rejects a nullish scalar whose selector matches no markers', () => {
		expect(() => commentMark(createMarker('a', 'hello world'), {
			b: undefined,
		})).toThrow('[comment-mark] Selector "b" matched no markers');
	});

	test('an empty array is a no-op even when nothing matches', () => {
		const content = createMarker('a', 'hello world');
		expect(commentMark(content, { b: [] })).toBe(content);
	});

	test('validates every selector before running a resolver', () => {
		const calls: string[] = [];
		expect(() => commentMark(`${createMarker('a', 'one')}\n${createMarker('b', 'two')}`, {
			a: () => {
				calls.push('a');
				return 'updated';
			},
			missing: () => {
				calls.push('missing');
				return 'updated';
			},
		})).toThrow('[comment-mark] Selector "missing" matched no markers');
		expect(calls).toStrictEqual([]);
	});

	test('round trips source with no replacements byte for byte', () => {
		const content = '<!-- a\n\tid = "x"  -->\r\nline\r\n<!-- /a -->\n';
		expect(commentMark(content, {})).toBe(content);
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from(createMarker('a')), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});
});

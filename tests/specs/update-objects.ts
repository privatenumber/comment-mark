import { describe, test, expect } from 'manten';
import { commentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('update objects', () => {
	test('accepts an update object as a replacement value', async () => {
		const output = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: {
				attributes: { kind: 'vegetable' },
				content: 'carrot',
			},
		});

		expect(output).toBe('<!-- item kind="vegetable" -->carrot<!-- /item -->');
	});

	test('matches the result of the equivalent resolver', async () => {
		const content = '<!-- item kind="fruit" id="a" -->apple<!-- /item -->';
		const update = {
			attributes: { kind: 'vegetable' },
			content: 'carrot',
		};

		expect(await commentMark(content, { item: update })).toBe(
			await commentMark(content, { item: () => update }),
		);
	});

	test('replaces the complete attribute set', async () => {
		const output = await commentMark('<!-- item kind="fruit" size="small" -->apple<!-- /item -->', {
			item: { attributes: { size: 'small' } },
		});

		expect(output).toBe('<!-- item size="small" -->apple<!-- /item -->');
	});

	test('removes every attribute for an empty attribute map', async () => {
		const output = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: { attributes: {} },
		});

		expect(output).toBe('<!-- item -->apple<!-- /item -->');
	});

	test('keeps the part the object omits', async () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';

		expect(await commentMark(content, { item: { content: 'pear' } })).toBe(
			'<!-- item kind="fruit" -->pear<!-- /item -->',
		);
		expect(await commentMark(content, { item: { attributes: { kind: 'vegetable' } } })).toBe(
			'<!-- item kind="vegetable" -->apple<!-- /item -->',
		);
	});

	test('an empty content clears the section', async () => {
		expect(await commentMark(createMarker('a', 'old'), { a: { content: '' } })).toBe(createMarker('a'));
	});

	test('undefined fields and an empty object leave the marker unchanged', async () => {
		// The fixture has attributes, so an accidental attribute removal shows up.
		const content = '<!-- item kind="fruit" size="small" -->apple<!-- /item -->';
		const noFields = {
			attributes: undefined,
			content: undefined,
		};

		expect(await commentMark(content, { item: noFields })).toBe(content);
		expect(await commentMark(content, { item: {} })).toBe(content);
	});

	test('inserts object content verbatim while a bare string keeps its padding', async () => {
		expect(await commentMark(createMarker('a'), { a: { content: 'first\nsecond' } })).toBe(
			createMarker('a', 'first\nsecond'),
		);
		expect(await commentMark(createMarker('a'), { a: 'first\nsecond' })).toBe(
			createMarker('a', '\nfirst\nsecond\n'),
		);
	});

	test('updates the first match for a scalar object', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: { content: 'first' },
		});

		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'two')}`);
	});

	test('updates matches by position in an array', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [{ content: 'first' }, 'second'],
		});

		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'second')}`);
	});

	test('a nullish array entry skips a match', async () => {
		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [null, { content: 'second' }],
		});

		expect(output).toBe(`${createMarker('a', 'one')}\n${createMarker('a', 'second')}`);
	});

	test('mixes object, string, and async resolver entries by position', async () => {
		const content = `${createMarker('a', 'one')}\n${createMarker('a', 'two')}\n${createMarker('a', 'three')}`;

		const output = await commentMark(content, {
			a: [
				{ content: 'first' },
				'second',
				async () => ({ content: 'third' }),
			],
		});

		expect(output).toBe(
			`${createMarker('a', 'first')}\n${createMarker('a', 'second')}\n${createMarker('a', 'third')}`,
		);
	});

	test('rejects a selector that matches no markers', async () => {
		await expect(commentMark(createMarker('a', 'old'), {
			b: { content: 'new' },
		})).rejects.toThrow('[comment-mark] Selector "b" matched no markers');
	});

	test('rejects two selectors targeting the same marker', async () => {
		const selector = 'a[id="x"]';

		await expect(commentMark('<!-- a id="x" -->v<!-- /a -->', {
			a: { content: 'one' },
			[selector]: { content: 'two' },
		})).rejects.toThrow(`[comment-mark] Selectors "a" and ${JSON.stringify(selector)} both target the marker "a"`);
	});

	test('validates attributes from a direct object', async () => {
		await expect(commentMark(createMarker('a'), {
			a: { attributes: { note: 'x-->y' } },
		})).rejects.toThrow('[comment-mark] Attribute value cannot contain "-->"');
	});
});

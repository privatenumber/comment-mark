import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('attribute updates', () => {
	test('replaces only the value, keeping the written formatting', async () => {
		const content = [
			'<!-- item',
			'  kind',
			'    =',
			'    "fruit"',
			'-->apple<!-- /item -->',
		].join('\n');

		const output = await commentMark(content, {
			item: ({ attributes }) => ({
				attributes: {
					...attributes,
					kind: 'vegetable',
				},
			}),
		});

		expect(output).toBe([
			'<!-- item',
			'  kind',
			'    =',
			'    "vegetable"',
			'-->apple<!-- /item -->',
		].join('\n'));
	});

	test('keeps the opening comment as written when only the content changes', async () => {
		const content = '<!-- item\n\tkind = "fruit"   size=\'small\'\n-->apple<!-- /item -->';

		expect(await commentMark(content, { item: 'pear' })).toBe(
			'<!-- item\n\tkind = "fruit"   size=\'small\'\n-->pear<!-- /item -->',
		);
	});

	test('keeps the line endings around a changed value', async () => {
		const content = '<!-- item\r\n\tkind\r\n\t\t=\r\n\t\t"fruit"\r\n-->apple<!-- /item -->';

		expect(await commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe('<!-- item\r\n\tkind\r\n\t\t=\r\n\t\t"vegetable"\r\n-->apple<!-- /item -->');
	});

	test('keeps the written quoting when a changed value still fits it', async () => {
		const content = "<!-- item kind='fruit' -->apple<!-- /item -->";

		expect(await commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe("<!-- item kind='vegetable' -->apple<!-- /item -->");
	});

	test('keeps an unquoted value unquoted', async () => {
		const content = '<!-- item kind=fruit -->apple<!-- /item -->';

		expect(await commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe('<!-- item kind=vegetable -->apple<!-- /item -->');
	});

	test('re-quotes a value the written quoting cannot hold', async () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';

		expect(await commentMark(content, {
			item: () => ({ attributes: { kind: 'a "b"' } }),
		})).toBe('<!-- item kind=\'a "b"\' -->apple<!-- /item -->');
	});

	test('appends an attribute the marker did not have', async () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';

		expect(await commentMark(content, {
			item: ({ attributes }) => ({
				attributes: {
					...attributes,
					updated: '2026-09-20',
				},
			}),
		})).toBe('<!-- item kind="fruit" updated="2026-09-20" -->apple<!-- /item -->');
	});

	test('appends an attribute to a marker without attributes', async () => {
		const content = '<!--item-->apple<!--/item-->';

		expect(await commentMark(content, {
			item: () => ({ attributes: { kind: 'fruit' } }),
		})).toBe('<!--item kind="fruit"-->apple<!--/item-->');
	});

	test('leaves an unchanged marker exactly as written', async () => {
		const content = "<!-- comment-mark id = 'a'  file='b' -->old<!-- / comment-mark -->";

		expect(await commentMark(content, {
			"comment-mark[id='a']": ({ attributes }) => ({ attributes: { ...attributes } }),
		})).toBe(content);
	});

	test('drops a leading attribute and the whitespace written before it', async () => {
		const output = await commentMark('<!-- item kind="fruit" size="small" -->apple<!-- /item -->', {
			item: () => ({ attributes: { size: 'small' } }),
		});

		expect(output).toBe('<!-- item size="small" -->apple<!-- /item -->');
	});

	test('replaces the attribute set, so an omitted attribute is removed', async () => {
		const output = await commentMark('<!-- item kind="fruit" size="small" -->apple<!-- /item -->', {
			item: () => ({ attributes: { kind: 'fruit' } }),
		});

		expect(output).toBe('<!-- item kind="fruit" -->apple<!-- /item -->');
	});

	test('replaces or drops an id like any other attribute', async () => {
		const content = '<!-- item id="a" -->apple<!-- /item -->';

		expect(await commentMark(content, {
			item: () => ({ attributes: { id: 'b' } }),
		})).toBe('<!-- item id="b" -->apple<!-- /item -->');

		expect(await commentMark(content, {
			item: () => ({ attributes: {} }),
		})).toBe('<!-- item -->apple<!-- /item -->');
	});

	test('rejects an unwritable attribute from a resolver', async () => {
		const reject = (attributes: Record<string, string>) => commentMark(createMarker('a'), {
			a: () => ({ attributes }),
		});

		await expect(reject({ note: 'x-->y' })).rejects.toThrow(
			'[comment-mark] Attribute value cannot contain "-->"',
		);
		await expect(reject({ 'not a name': 'x' })).rejects.toThrow(
			'[comment-mark] Invalid attribute name',
		);
		await expect(reject({ note: 'both " and \'' })).rejects.toThrow(
			'[comment-mark] Attribute value cannot be quoted',
		);
	});

	test('a rejected replacement does not leak into a later call', async () => {
		const content = '<!-- item a="1" b="2" -->x<!-- /item -->';

		await expect(commentMark(content, {
			item: () => ({
				content: 'new',
				attributes: { a: 'x-->y' },
			}),
		})).rejects.toThrow('[comment-mark] Attribute value cannot contain "-->"');

		// The rejected call produced no output, so the source still reads and
		// updates from its original attributes and content.
		expect(getCommentMark(content, 'item')?.attributes).toStrictEqual({
			a: '1',
			b: '2',
		});
		expect(await commentMark(content, { item: 'y' })).toBe('<!-- item a="1" b="2" -->y<!-- /item -->');
	});
});

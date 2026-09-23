import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('attribute updates', () => {
	test('replaces only the value, keeping the written formatting', () => {
		const content = [
			'<!-- item',
			'  kind',
			'    =',
			'    "fruit"',
			'-->apple<!-- /item -->',
		].join('\n');

		const output = commentMark(content, {
			item: attributes => ({
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

	test('keeps the line endings around a changed value', () => {
		const content = '<!-- item\r\n\tkind\r\n\t\t=\r\n\t\t"fruit"\r\n-->apple<!-- /item -->';

		expect(commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe('<!-- item\r\n\tkind\r\n\t\t=\r\n\t\t"vegetable"\r\n-->apple<!-- /item -->');
	});

	test('keeps the written quoting when a changed value still fits it', () => {
		const content = "<!-- item kind='fruit' -->apple<!-- /item -->";

		expect(commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe("<!-- item kind='vegetable' -->apple<!-- /item -->");
	});

	test('keeps an unquoted value unquoted', () => {
		const content = '<!-- item kind=fruit -->apple<!-- /item -->';

		expect(commentMark(content, {
			item: () => ({ attributes: { kind: 'vegetable' } }),
		})).toBe('<!-- item kind=vegetable -->apple<!-- /item -->');
	});

	test('re-quotes a value the written quoting cannot hold', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';

		expect(commentMark(content, {
			item: () => ({ attributes: { kind: 'a "b"' } }),
		})).toBe('<!-- item kind=\'a "b"\' -->apple<!-- /item -->');
	});

	test('appends an attribute the marker did not have', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';

		expect(commentMark(content, {
			item: attributes => ({
				attributes: {
					...attributes,
					updated: '2026-09-20',
				},
			}),
		})).toBe('<!-- item kind="fruit" updated="2026-09-20" -->apple<!-- /item -->');
	});

	test('appends an attribute to a marker without attributes', () => {
		const content = '<!--item-->apple<!--/item-->';

		expect(commentMark(content, {
			item: () => ({ attributes: { kind: 'fruit' } }),
		})).toBe('<!--item kind="fruit"-->apple<!--/item-->');
	});

	test('leaves an unchanged marker exactly as written', () => {
		const content = "<!-- comment-mark id = 'a'  file='b' -->old<!-- / comment-mark -->";

		expect(commentMark(content, {
			"comment-mark[id='a']": attributes => ({ attributes: { ...attributes } }),
		})).toBe(content);
	});

	test('drops a leading attribute and the whitespace written before it', () => {
		const output = commentMark('<!-- item kind="fruit" size="small" -->apple<!-- /item -->', {
			item: () => ({ attributes: { size: 'small' } }),
		});

		expect(output).toBe('<!-- item size="small" -->apple<!-- /item -->');
	});

	test('replaces the attribute set, so an omitted attribute is removed', () => {
		const output = commentMark('<!-- item kind="fruit" size="small" -->apple<!-- /item -->', {
			item: () => ({ attributes: { kind: 'fruit' } }),
		});

		expect(output).toBe('<!-- item kind="fruit" -->apple<!-- /item -->');
	});

	test('keeps the attributes a resolver spreads', () => {
		const output = commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: attributes => ({
				attributes: {
					...attributes,
					updated: '2026-09-20',
				},
			}),
		});

		expect(output).toBe('<!-- item kind="fruit" updated="2026-09-20" -->apple<!-- /item -->');
	});

	test('replaces or drops an id like any other attribute', () => {
		const content = '<!-- item id="a" -->apple<!-- /item -->';

		expect(commentMark(content, {
			item: () => ({ attributes: { id: 'b' } }),
		})).toBe('<!-- item id="b" -->apple<!-- /item -->');

		expect(commentMark(content, {
			item: () => ({ attributes: {} }),
		})).toBe('<!-- item -->apple<!-- /item -->');
	});

	test('rejects an unwritable attribute from a resolver', () => {
		const reject = (attributes: Record<string, string>) => commentMark(createMarker('a'), {
			a: () => ({ attributes }),
		});

		expect(() => reject({ note: 'x-->y' })).toThrow(
			'[comment-mark] Attribute value cannot contain "-->"',
		);
		expect(() => reject({ 'not a name': 'x' })).toThrow(
			'[comment-mark] Invalid attribute name',
		);
		expect(() => reject({ note: 'both " and \'' })).toThrow(
			'[comment-mark] Attribute value cannot be quoted',
		);
	});

	test('a rejected replacement does not leak into a later call', () => {
		const content = '<!-- item a="1" b="2" -->x<!-- /item -->';

		expect(() => commentMark(content, {
			item: () => ({
				content: 'new',
				attributes: { a: 'x-->y' },
			}),
		})).toThrow('[comment-mark] Attribute value cannot contain "-->"');

		// The rejected call produced no output, so the source still reads and
		// updates from its original attributes and content.
		expect(getCommentMark(content, 'item')?.attributes).toStrictEqual({
			a: '1',
			b: '2',
		});
		expect(commentMark(content, { item: 'y' })).toBe('<!-- item a="1" b="2" -->y<!-- /item -->');
	});
});

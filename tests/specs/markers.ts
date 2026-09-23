import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('marker pairing', () => {
	test('ignores an unmatched opening comment', () => {
		const content = '<!-- a -->never closed\n';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores a closing comment with no opening comment', () => {
		const content = '<!-- /a -->text<!-- a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('does not pair a closing comment with a different tag', () => {
		const content = '<!-- a -->text<!-- /b -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores comments that are not tags', () => {
		const content = [
			'<!-- TODO: fix this -->',
			'<!-- 1 + 1 -->',
			'<!-- -->',
			'<!--a/b-->',
			'<!--a:b-->',
		].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores an unmatched comment with malformed attributes', () => {
		// Only a matched pair is a marker, so an ordinary comment is never
		// parsed as a marker with broken attributes.
		const content = '<!-- see id -->\n';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('reads only the outermost marker', () => {
		expect(getCommentMarkAll(
			'<!-- a -->outer<!-- b -->inner<!-- /b -->x<!-- /a -->',
		)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'outer<!-- b -->inner<!-- /b -->x',
			},
		]);
	});

	test('keeps a nested marker out of selectors', () => {
		const content = '<!-- a -->outer<!-- b -->inner<!-- /b -->x<!-- /a -->';

		expect(getCommentMarkAll(content, 'b')).toStrictEqual([]);
		expect(getCommentMark(content, 'b')).toBe(null);
	});

	test('pairs a nested marker with the same tag name to the outer closer', () => {
		// The first closing comment closes the innermost `a`, so the outer
		// marker's content spans the inner pair.
		expect(getCommentMarkAll(
			'<!-- a -->outer<!-- a -->inner<!-- /a --><!-- /a -->',
		)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'outer<!-- a -->inner<!-- /a -->',
			},
		]);
	});

	test('keeps markers a replacement introduced inside the outer marker', async () => {
		const inner = '<!-- b -->inner<!-- /b -->';
		const output = await commentMark(createMarker('a', 'old'), { a: inner });

		expect(output).toBe(createMarker('a', inner));
		expect(getCommentMarkAll(output).map(mark => mark.tagName)).toStrictEqual(['a']);

		// `b` sits inside `a`'s content, so it is not a marker to update, while
		// the outer marker can still be replaced on a later run.
		await expect(commentMark(output, { b: 'changed' }))
			.rejects.toThrow('[comment-mark] Selector "b" matched no markers');
		expect(await commentMark(output, { a: 'new' })).toBe(createMarker('a', 'new'));
	});

	test('allows an unmatched opening comment inside a marker', () => {
		// `<!-- TODO -->` has no closing comment, so it is not a marker and the
		// outer marker is not nested.
		const content = '<!-- a --><!-- TODO -->text<!-- /a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '<!-- TODO -->text',
			},
		]);
	});

	test('ignores a closing comment with trailing text', () => {
		// Only `<!-- /a -->` closes `a`. `<!-- /a extra -->` is ordinary text,
		// so it cannot silently pair with the opener and leave `extra` unread.
		const content = '<!-- a -->x<!-- /a extra -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('skips a matched pair inside a marker behind an unmatched comment', () => {
		// `<!-- x -->` is never closed, so it is not a marker, and `b` opens and
		// closes inside `a`, which makes `b` part of `a`'s content.
		expect(getCommentMarkAll(
			'<!-- a --><!-- x --><!-- b -->inner<!-- /b --><!-- /a -->',
		)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '<!-- x --><!-- b -->inner<!-- /b -->',
			},
		]);
	});
});

describe('attributes', () => {
	test('parses single-quoted values', () => {
		expect(getCommentMarkAll("<!-- a id='a b' -->x<!-- /a -->")).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: 'a b' },
				content: 'x',
			},
		]);
	});

	test('parses unquoted values', () => {
		expect(getCommentMarkAll('<!-- a id=a -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: 'a' },
				content: 'x',
			},
		]);
	});

	test('tolerates whitespace inside the tags', async () => {
		const output = await commentMark('<!-- comment-mark id = "a" -->x<!-- / comment-mark -->', {
			"comment-mark[id='a']": 'y',
		});
		expect(output).toBe('<!-- comment-mark id = "a" -->y<!-- / comment-mark -->');
	});

	test('preserves additional attributes', () => {
		expect(getCommentMarkAll('<!-- license file="./LICENSE.md" -->cached<!-- /license -->')).toStrictEqual([
			{
				tagName: 'license',
				attributes: { file: './LICENSE.md' },
				content: 'cached',
			},
		]);
	});

	test('allows values containing = and /', () => {
		expect(getCommentMarkAll('<!-- a query="x=1&y=/z" -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { query: 'x=1&y=/z' },
				content: 'x',
			},
		]);
	});

	test('supports markers without attributes', () => {
		expect(getCommentMarkAll('<!--a-->x<!--/a-->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'x',
			},
		]);
	});

	test('keeps an empty attribute value', () => {
		expect(getCommentMarkAll('<!-- a id="" -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: '' },
				content: 'x',
			},
		]);
	});

	test('rejects duplicate attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id="a" id="b" -->x<!-- /a -->')).toThrow(
			'[comment-mark] Duplicate marker attribute: "id"',
		);
	});

	test('rejects malformed attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id -->x<!-- /a -->')).toThrow(
			'[comment-mark] Invalid marker attribute: "id"',
		);
	});

	test('requires whitespace between attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id="a"file="./b.md" -->x<!-- /a -->')).toThrow(
			'[comment-mark] Expected whitespace between attributes',
		);
	});

	test('rejects an unterminated attribute value', () => {
		expect(() => getCommentMarkAll('<!-- a id="a -->x<!-- /a -->')).toThrow(
			'[comment-mark] Unterminated attribute value for "id"',
		);
	});

	test('rejects a quote inside an unquoted value', () => {
		expect(() => getCommentMarkAll('<!-- a id=a"b" -->x<!-- /a -->')).toThrow(
			'Invalid marker attribute',
		);
	});
});

describe('getCommentMark and getCommentMarkAll', () => {
	test('returns markers in document order', () => {
		expect(getCommentMarkAll(`${createMarker('a', 'first')}\n${createMarker('b', 'second')}`)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'first',
			},
			{
				tagName: 'b',
				attributes: {},
				content: 'second',
			},
		]);
	});

	test('filters by selector', () => {
		const content = [
			'<!-- item kind="fruit" -->apple<!-- /item -->',
			'<!-- item kind="vegetable" -->carrot<!-- /item -->',
		].join('\n');

		expect(getCommentMarkAll(content, "item[kind='fruit']").map(mark => mark.content)).toStrictEqual(['apple']);
		expect(getCommentMark(content, "item[kind='vegetable']")?.content).toBe('carrot');
	});

	test('returns an empty array when no markers exist', () => {
		expect(getCommentMarkAll('<!-- ordinary comment -->')).toStrictEqual([]);
	});

	test('keeps every occurrence of a duplicate tag name', () => {
		const content = [
			'<!-- item kind="fruit" -->apple<!-- /item -->',
			'<!-- item kind="fruit" -->pear<!-- /item -->',
		].join('\n');

		expect(getCommentMarkAll(content).map(mark => [mark.tagName, mark.content])).toStrictEqual([
			['item', 'apple'],
			['item', 'pear'],
		]);
		expect(getCommentMark(content, 'item')?.content).toBe('apple');
	});

	test('returns empty content for an empty marker', () => {
		expect(getCommentMarkAll(createMarker('a'))).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '',
			},
		]);
	});

	test('supports Buffer input', () => {
		expect(getCommentMarkAll(Buffer.from(createMarker('a', 'hello world')))).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'hello world',
			},
		]);
	});

	test('supports tag names named like Object properties', () => {
		expect(getCommentMarkAll(createMarker('__proto__', 'hello world'))).toStrictEqual([
			{
				tagName: '__proto__',
				attributes: {},
				content: 'hello world',
			},
		]);
	});
});

describe('public API', () => {
	test('exposes the update and reader functions', async () => {
		const module = await import('#comment-mark');

		expect(Object.keys(module).sort()).toStrictEqual([
			'commentMark',
			'getCommentMark',
			'getCommentMarkAll',
		]);
	});
});

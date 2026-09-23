import { describe, test, expect } from 'manten';
import {
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('selectors', () => {
	test('matches a tag name', () => {
		expect(getCommentMark(createMarker('a', 'value'), 'a')?.content).toBe('value');
		expect(getCommentMark(createMarker('a', 'value'), 'b')).toBe(null);
	});

	test('matches an attribute that exists', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, 'item[kind]')?.content).toBe('apple');
		expect(getCommentMark(content, 'item[missing]')).toBe(null);
	});

	test('matches an attribute value', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[kind='fruit']")?.content).toBe('apple');
		expect(getCommentMark(content, 'item[kind="fruit"]')?.content).toBe('apple');
		expect(getCommentMark(content, 'item[kind=fruit]')?.content).toBe('apple');
		expect(getCommentMark(content, "item[kind='vegetable']")).toBe(null);
	});

	test('matches every predicate', () => {
		const content = '<!-- item kind="fruit" lang="en" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[kind='fruit'][lang='en']")?.content).toBe('apple');
		expect(getCommentMark(content, "item[kind='fruit'][lang='fr']")).toBe(null);
	});

	test('matches the parsed value regardless of how it was quoted', () => {
		expect(getCommentMark('<!-- a id=x -->v<!-- /a -->', "a[id='x']")?.content).toBe('v');
		expect(getCommentMark("<!-- a id='x' -->v<!-- /a -->", 'a[id="x"]')?.content).toBe('v');
	});

	test('matches a value containing spaces and punctuation', () => {
		const content = '<!-- a query="x=1&y=/z" -->v<!-- /a -->';
		expect(getCommentMark(content, 'a[query="x=1&y=/z"]')?.content).toBe('v');
	});

	test('matches values with special characters', () => {
		const content = '<!-- a key="a.b:c" -->v<!-- /a -->';
		expect(getCommentMark(content, "a[key='a.b:c']")?.content).toBe('v');
	});

	test('tolerates whitespace inside the predicate', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[ kind = 'fruit' ]")?.content).toBe('apple');
	});

	test('rejects an unsupported operator', () => {
		const selector = 'a[kind^="f"]';

		expect(() => getCommentMarkAll(createMarker('a'), selector)).toThrow(
			`[comment-mark] Invalid selector: ${JSON.stringify(selector)}`,
		);
	});

	test('rejects a descendant combinator', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a b')).toThrow('[comment-mark] Invalid selector: "a b"');
	});

	test('rejects a selector list', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a, b')).toThrow('[comment-mark] Invalid selector: "a, b"');
	});

	test('rejects a pseudo-class', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a:hover')).toThrow('[comment-mark] Invalid selector: "a:hover"');
	});

	test('rejects an unterminated predicate', () => {
		expect(() => getCommentMarkAll(createMarker('a'), "a[kind='fruit'")).toThrow('[comment-mark] Invalid selector');
	});

	test('rejects an empty selector', () => {
		expect(() => getCommentMarkAll(createMarker('a'), '')).toThrow('[comment-mark] Invalid selector: ""');
	});
});

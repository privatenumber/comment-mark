import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('resolvers', () => {
	test('computes content from the current value and attributes', () => {
		const output = commentMark('<!-- views source="analytics" -->40<!-- /views -->', {
			views: (attributes, content) => String(Number(content) + 1),
		});

		expect(output).toBe('<!-- views source="analytics" -->41<!-- /views -->');
	});

	test('receives every attribute and the current content', () => {
		const seen: Array<[Record<string, string>, string]> = [];

		commentMark('<!-- item id="a" kind="fruit" -->apple<!-- /item -->', {
			item: (attributes, content) => {
				seen.push([attributes, content]);
				return null;
			},
		});

		expect(seen).toStrictEqual([[{
			id: 'a',
			kind: 'fruit',
		}, 'apple']]);
	});

	test('runs each resolver for its own occurrence in document order', () => {
		const calls: string[] = [];
		const resolver = (attributes: Record<string, string>, content: string) => {
			calls.push(content);
			return content.toUpperCase();
		};

		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [resolver, resolver],
		});

		expect(calls).toStrictEqual(['one', 'two']);
		expect(output).toBe(`${createMarker('a', 'ONE')}\n${createMarker('a', 'TWO')}`);
	});

	test('runs resolvers in document order regardless of key order', () => {
		const calls: string[] = [];
		const resolver = (label: string) => () => {
			calls.push(label);
			return label;
		};

		commentMark(`${createMarker('a', 'one')}\n${createMarker('b', 'two')}`, {
			b: resolver('b'),
			a: resolver('a'),
		});

		expect(calls).toStrictEqual(['a', 'b']);
	});

	test('inserts a resolver string verbatim', () => {
		expect(commentMark(createMarker('a', 'old'), {
			a: () => 'first\nsecond',
		})).toBe(createMarker('a', 'first\nsecond'));
	});

	test('a nullish resolver result preserves the section', () => {
		expect(commentMark(createMarker('a', 'old'), {
			a: () => null,
		})).toBe(createMarker('a', 'old'));
	});

	test('propagates an error thrown by a resolver', () => {
		expect(() => commentMark(createMarker('a'), {
			a: () => {
				throw new Error('resolver failed');
			},
		})).toThrow('resolver failed');
	});

	test('updates content and attributes together', () => {
		const output = commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: attributes => ({
				attributes: {
					...attributes,
					kind: 'vegetable',
				},
				content: 'carrot',
			}),
		});

		expect(output).toBe('<!-- item kind="vegetable" -->carrot<!-- /item -->');
	});

	test('resolves selectors against the state at the start of the call', () => {
		// The first resolver gives `b` a `kind`, but every selector is resolved
		// before any replacement runs, so the second selector matches nothing
		// and the call is rejected before the first resolver runs.
		const selector = "b[kind='fruit']";
		expect(() => commentMark('<!-- b -->apple<!-- /b -->', {
			b: () => ({ attributes: { kind: 'fruit' } }),
			[selector]: 'unexpected',
		})).toThrow(`[comment-mark] Selector ${JSON.stringify(selector)} matched no markers`);
	});
});

describe('resolver reentrancy', () => {
	test('a resolver can parse another document', () => {
		const output = commentMark(createMarker('a', 'old'), {
			a: () => getCommentMarkAll(createMarker('b', 'nested')).map(mark => mark.content).join(''),
		});

		expect(output).toBe(createMarker('a', 'nested'));
	});

	test('a resolver can update another document', () => {
		const inner = createMarker('b', 'old');

		const output = commentMark(createMarker('a', 'old'), {
			a: () => getCommentMark(commentMark(inner, { b: 'new' }), 'b')?.content ?? '',
		});

		expect(output).toBe(createMarker('a', 'new'));
	});

	test('a resolver can catch an error from a nested parse', () => {
		const output = commentMark(createMarker('a', 'old'), {
			a: () => {
				try {
					getCommentMarkAll('<!-- a -->x<!-- b -->y<!-- /b -->z<!-- /a -->');
				} catch {
					return 'recovered';
				}
				return 'no error';
			},
		});

		expect(output).toBe(createMarker('a', 'recovered'));
	});
});

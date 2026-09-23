import { setTimeout } from 'node:timers/promises';
import { describe, test, expect } from 'manten';
import {
	type CommentMarkData,
	commentMark,
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('resolvers', () => {
	test('computes content from the current value and attributes', async () => {
		const output = await commentMark('<!-- views source="analytics" -->40<!-- /views -->', {
			views: ({ content }) => String(Number(content) + 1),
		});

		expect(output).toBe('<!-- views source="analytics" -->41<!-- /views -->');
	});

	test('receives every attribute and the current content', async () => {
		const seen: Array<[Record<string, string>, string]> = [];

		await commentMark('<!-- item id="a" kind="fruit" -->apple<!-- /item -->', {
			item: ({ attributes, content }) => {
				seen.push([attributes, content]);
				return null;
			},
		});

		expect(seen).toStrictEqual([[{
			id: 'a',
			kind: 'fruit',
		}, 'apple']]);
	});

	test('receives the marker data', async () => {
		const seen: CommentMarkData[] = [];

		await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: (marker) => {
				seen.push(marker);
				return null;
			},
		});

		expect(seen).toStrictEqual([{
			tagName: 'item',
			attributes: { kind: 'fruit' },
			content: 'apple',
		}]);
	});

	test('runs each resolver for its own occurrence in document order', async () => {
		const calls: string[] = [];
		const resolver = ({ content }: CommentMarkData) => {
			calls.push(content);
			return content.toUpperCase();
		};

		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [resolver, resolver],
		});

		expect(calls).toStrictEqual(['one', 'two']);
		expect(output).toBe(`${createMarker('a', 'ONE')}\n${createMarker('a', 'TWO')}`);
	});

	test('runs resolvers in document order regardless of key order', async () => {
		const calls: string[] = [];
		const resolver = (label: string) => () => {
			calls.push(label);
			return label;
		};

		await commentMark(`${createMarker('a', 'one')}\n${createMarker('b', 'two')}`, {
			b: resolver('b'),
			a: resolver('a'),
		});

		expect(calls).toStrictEqual(['a', 'b']);
	});

	test('inserts a resolver string verbatim', async () => {
		expect(await commentMark(createMarker('a', 'old'), {
			a: () => 'first\nsecond',
		})).toBe(createMarker('a', 'first\nsecond'));
	});

	test('a nullish resolver result preserves the section', async () => {
		expect(await commentMark(createMarker('a', 'old'), {
			a: () => null,
		})).toBe(createMarker('a', 'old'));
	});

	test('propagates an error thrown by a resolver', async () => {
		await expect(commentMark(createMarker('a'), {
			a: () => {
				throw new Error('resolver failed');
			},
		})).rejects.toThrow('resolver failed');
	});

	test('updates content and attributes together', async () => {
		const output = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: ({ attributes }) => ({
				attributes: {
					...attributes,
					kind: 'vegetable',
				},
				content: 'carrot',
			}),
		});

		expect(output).toBe('<!-- item kind="vegetable" -->carrot<!-- /item -->');
	});

	test('resolves selectors against the state at the start of the call', async () => {
		// The first resolver gives `b` a `kind`, but every selector is resolved
		// before any replacement runs, so the second selector matches nothing
		// and the call is rejected before the first resolver runs.
		const selector = "b[kind='fruit']";
		await expect(commentMark('<!-- b -->apple<!-- /b -->', {
			b: () => ({ attributes: { kind: 'fruit' } }),
			[selector]: 'unexpected',
		})).rejects.toThrow(`[comment-mark] Selector ${JSON.stringify(selector)} matched no markers`);
	});
});

describe('resolver targeting', () => {
	test('runs a scalar resolver for every match', async () => {
		const calls: string[] = [];

		const output = await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ({ content }) => {
				calls.push(content);
				return content.toUpperCase();
			},
		});

		expect(calls).toStrictEqual(['one', 'two']);
		expect(output).toBe(`${createMarker('a', 'ONE')}\n${createMarker('a', 'TWO')}`);
	});

	test('claims every match, so another selector cannot target one', async () => {
		const selector = 'a[id="two"]';

		await expect(commentMark(
			'<!-- a id="one" -->1<!-- /a -->\n<!-- a id="two" -->2<!-- /a -->',
			{
				a: () => 'new',
				[selector]: 'other',
			},
		)).rejects.toThrow(`[comment-mark] Selectors "a" and ${JSON.stringify(selector)} both target the marker "a"`);
	});

	test('passes the zero-based position among the selector matches', async () => {
		const positions: Array<[string, number]> = [];

		await commentMark(
			`${createMarker('a', 'one')}\n${createMarker('b', 'skip')}\n${createMarker('a', 'two')}`,
			{
				a: ({ content }, index) => {
					positions.push([content, index]);
					return content;
				},
			},
		);

		// `b` is not an `a` match, so the two `a` markers are positions 0 and 1.
		expect(positions).toStrictEqual([['one', 0], ['two', 1]]);
	});

	test('is a no-op when the selector matches nothing', async () => {
		const content = createMarker('a', 'old');
		expect(await commentMark(content, { b: () => 'new' })).toBe(content);
	});

	test('passes the position of a skipped array entry', async () => {
		const positions: Array<[string, number]> = [];

		await commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [
				null,
				({ content }, index) => {
					positions.push([content, index]);
					return content;
				},
			],
		});

		// The `null` entry skips the first match, so the second is position 1.
		expect(positions).toStrictEqual([['two', 1]]);
	});
});

describe('async resolvers', () => {
	test('awaits a promise result', async () => {
		const output = await commentMark(createMarker('a', 'old'), {
			a: async () => {
				await setTimeout(0);
				return 'new';
			},
		});

		expect(output).toBe(createMarker('a', 'new'));
	});

	test('awaits a promise resolving to an update object', async () => {
		const output = await commentMark('<!-- item kind="fruit" -->apple<!-- /item -->', {
			item: async ({ attributes }) => ({
				attributes: {
					...attributes,
					kind: 'vegetable',
				},
				content: 'carrot',
			}),
		});

		expect(output).toBe('<!-- item kind="vegetable" -->carrot<!-- /item -->');
	});

	test('propagates a rejection from a resolver', async () => {
		await expect(commentMark(createMarker('a'), {
			a: async () => {
				throw new Error('async resolver failed');
			},
		})).rejects.toThrow('async resolver failed');
	});

	test('finishes each resolver before starting the next', async () => {
		const order: string[] = [];
		const resolver = (label: string) => async () => {
			order.push(`${label}:start`);
			await setTimeout(5);
			order.push(`${label}:end`);
			return label;
		};

		await commentMark(`${createMarker('a', 'one')}\n${createMarker('b', 'two')}`, {
			a: resolver('a'),
			b: resolver('b'),
		});

		expect(order).toStrictEqual(['a:start', 'a:end', 'b:start', 'b:end']);
	});
});

describe('resolver reentrancy', () => {
	test('a resolver can parse another document', async () => {
		const output = await commentMark(createMarker('a', 'old'), {
			a: () => getCommentMarkAll(createMarker('b', 'nested')).map(mark => mark.content).join(''),
		});

		expect(output).toBe(createMarker('a', 'nested'));
	});

	test('a resolver can update another document', async () => {
		const inner = createMarker('b', 'old');

		const output = await commentMark(createMarker('a', 'old'), {
			a: async () => getCommentMark(await commentMark(inner, { b: 'new' }), 'b')?.content ?? '',
		});

		expect(output).toBe(createMarker('a', 'new'));
	});

	test('a resolver can catch an error from a nested parse', async () => {
		const output = await commentMark(createMarker('a', 'old'), {
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

import { describe, test, expect } from 'manten';
import { commentMark } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('content padding', () => {
	test('inserts inline content as written', async () => {
		expect(await commentMark(createMarker('a'), { a: '1.2.3' })).toBe(createMarker('a', '1.2.3'));
		expect(await commentMark(createMarker('a'), { a: '**important**' })).toBe(createMarker('a', '**important**'));
		expect(await commentMark(createMarker('a'), { a: '[link](https://example.com)' })).toBe(
			createMarker('a', '[link](https://example.com)'),
		);
		expect(await commentMark(createMarker('a'), { a: 'Jane Doe' })).toBe(createMarker('a', 'Jane Doe'));
	});

	test('pads a single-line block so it starts its own line', async () => {
		expect(await commentMark(createMarker('a'), { a: '# Heading' })).toBe(createMarker('a', '\n# Heading\n'));
		expect(await commentMark(createMarker('a'), { a: '> quoted' })).toBe(createMarker('a', '\n> quoted\n'));
		expect(await commentMark(createMarker('a'), { a: '---' })).toBe(createMarker('a', '\n---\n'));
		expect(await commentMark(createMarker('a'), { a: '    indented code' })).toBe(
			createMarker('a', '\n    indented code\n'),
		);
	});

	test('pads multiline content', async () => {
		expect(await commentMark(createMarker('a'), { a: '- one\n- two' })).toBe(createMarker('a', '\n- one\n- two\n'));
		expect(await commentMark(createMarker('a'), { a: '```js\nconst x = 1\n```' })).toBe(
			createMarker('a', '\n```js\nconst x = 1\n```\n'),
		);
		expect(await commentMark(createMarker('a'), { a: '| a | b |\n| - | - |' })).toBe(
			createMarker('a', '\n| a | b |\n| - | - |\n'),
		);
		expect(await commentMark(createMarker('a'), { a: 'one\n\ntwo' })).toBe(createMarker('a', '\none\n\ntwo\n'));
		expect(await commentMark(createMarker('a'), { a: 'Heading\n=======' })).toBe(
			createMarker('a', '\nHeading\n=======\n'),
		);
	});

	test('keeps existing boundary newlines instead of adding more', async () => {
		expect(await commentMark(createMarker('a'), { a: '\n# Heading\n' })).toBe(createMarker('a', '\n# Heading\n'));
	});

	test('leaves escaped block syntax as inline content', async () => {
		const escaped = String.raw`\# not a heading`;
		expect(await commentMark(createMarker('a'), { a: escaped })).toBe(createMarker('a', escaped));
	});

	test('clears the section for empty content', async () => {
		expect(await commentMark(createMarker('a', 'old'), { a: '' })).toBe(createMarker('a'));
	});

	test('applies the same rule to object content and resolver results', async () => {
		expect(await commentMark(createMarker('a'), { a: { content: '# Heading' } })).toBe(
			createMarker('a', '\n# Heading\n'),
		);
		expect(await commentMark(createMarker('a'), { a: () => '# Heading' })).toBe(
			createMarker('a', '\n# Heading\n'),
		);
		expect(await commentMark(createMarker('a'), { a: () => 'value' })).toBe(createMarker('a', 'value'));
	});
});

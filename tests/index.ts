import { describe, expect } from 'manten';
import { commentMark } from '#comment-mark';

describe('edge cases', ({ test }) => {
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

	test('no end-tag', () => {
		const inp = '<!-- a:start -->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrowError('[comment-mark] No end comment found for key "a"');
	});

	test('reversed end-tag', () => {
		const inp = '<!--a:end--><!--a:start -->';
		expect(() => commentMark(inp, {
			a: 'hello world',
		})).toThrowError('[comment-mark] No end comment found for key "a"');
	});
});

describe('valid', ({ test }) => {
	test('basic', () => {
		const output = commentMark('<!-- a:start --><!-- a:end -->', {
			a: 'hello world',
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});

	test('skip nullish properties', () => {
		const output = commentMark('<!-- a:start -->hello world<!-- a:end -->', {
			a: undefined,
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});

	test('multi-line', () => {
		const output = commentMark(`
			# multiline
			<!-- a:start -->hello world<!-- a:end -->
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!-- a:start -->\nhello world\n\ngoogbye world\nhello again\n<!-- a:end -->\n\t\t');
	});

	test('multiple', () => {
		const output = commentMark(`
			<!-- a:start --><!-- a:end -->
			<!-- b:start --><!-- b:end -->
			<!-- ba:start --><!-- ba:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});
		expect(output).toBe('\n\t\t\t<!-- a:start -->hello world<!-- a:end -->\n\t\t\t<!-- b:start -->goodbye world<!-- b:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end -->\n\t\t');
	});

	test('duplicate', () => {
		const output = commentMark(`
			<!-- a:start--><!-- a:end -->
			<!--ba:start --><!--ba:end -->
			<!-- b:start --><!-- b:end -->
			<!-- ba:start --><!-- ba:end -->
			<!--a:start --><!-- a:end -->
			<!-- b:start --><!--b:end -->
			<!-- ba:start --><!--ba:end -->
			<!--a:start --><!-- a:end -->
			<!-- ba:start --><!-- ba:end-->
			<!-- b:start--><!-- b:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});
		expect(output).toBe('\n\t\t\t<!-- a:start-->hello world<!-- a:end -->\n\t\t\t<!--ba:start -->something world<!--ba:end -->\n\t\t\t<!-- b:start -->goodbye world<!-- b:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end -->\n\t\t\t<!--a:start -->hello world<!-- a:end -->\n\t\t\t<!-- b:start -->goodbye world<!--b:end -->\n\t\t\t<!-- ba:start -->something world<!--ba:end -->\n\t\t\t<!--a:start -->hello world<!-- a:end -->\n\t\t\t<!-- ba:start -->something world<!-- ba:end-->\n\t\t\t<!-- b:start-->goodbye world<!-- b:end -->\n\t\t');
	});

	test('intersecting', () => {
		const output = commentMark(`
			<!-- a:start --><!-- b:start --><!-- a:end --><<!-- b:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
		});
		// console.log(3, JSON.stringify(output));
		expect(output).toBe('\n\t\t\t<!-- a:start -->hello world<!-- a:end --><<!-- b:end -->\n\t\t');
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from('<!-- a:start --><!-- a:end -->'), {
			a: 'hello world',
		});
		expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');
	});
});

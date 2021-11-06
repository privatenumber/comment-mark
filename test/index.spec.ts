import commentMark from '..';

describe('edge cases', () => {
	test('no arguments', () => {
		// @ts-expect-error test error
		const output = commentMark();
		expect(output).toBe(undefined);
	});

	test('empty str', () => {
		const output = commentMark('', {});
		expect(output).toBe('');
	});

	test('invalid obj', () => {
		// @ts-expect-error test error
		const output = commentMark('', 1);
		expect(output).toBe('');
	});

	test('no end-tag', () => {
		const spy = jest.spyOn(global.console, 'warn').mockImplementation();
		const inp = '<!-- a:start -->';
		const output = commentMark(inp, {
			a: 'hello world',
		});
		expect(output).toBe(inp);
		expect(spy).toHaveBeenCalledWith('[comment-mark] No end comment found for "a"');
		spy.mockRestore();
	});

	test('reversed end-tag', () => {
		const spy = jest.spyOn(global.console, 'warn').mockImplementation();
		const inp = '<!--a:end--><!--a:start -->';
		const output = commentMark(inp, {
			a: 'hello world',
		});
		expect(output).toBe(inp);
		expect(spy).toHaveBeenCalledWith('[comment-mark] No end comment found for "a"');
		spy.mockRestore();
	});
});

describe('valid', () => {
	test('basic', () => {
		const output = commentMark('<!-- a:start --><!-- a:end -->', {
			a: 'hello world',
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

		expect(output).toMatchSnapshot();
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
		expect(output).toMatchSnapshot();
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
		expect(output).toMatchSnapshot();
	});

	test('intersecting', () => {
		const output = commentMark(`
			<!-- a:start --><!-- b:start --><!-- a:end --><<!-- b:end -->
		`, {
			a: 'hello world',
			b: 'goodbye world',
		});
		expect(output).toMatchSnapshot();
	});


	// Test Buffer
});

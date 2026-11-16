import { describe, test, expect } from 'manten';
import { getCommentMarkAll } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('parser scaling', () => {
	for (const [name, input] of [
		// No underscore closer has a matching opener.
		['unmatched delimiter openers', (n: number) => '*a '.repeat(n) + 'b_ '.repeat(n)],
		// Each match consumes only two characters from each long run.
		['long delimiter runs', (n: number) => `${'*'.repeat(n)}x${'*'.repeat(n)}`],
		// Every character starts a new delimiter run.
		['alternating delimiters', (n: number) => '*_'.repeat(n)],
	] as const) {
		test(`${name} scale linearly`, () => {
			const measure = (size: number) => {
				const content = `x <svg/> <!-- a --> ${input(size)}`;
				let best = Infinity;
				for (let attempt = 0; attempt < 10; attempt += 1) {
					const start = performance.now();
					for (let iteration = 0; iteration < 8; iteration += 1) {
						getCommentMarkAll(content);
					}
					const elapsed = (performance.now() - start) * 1000;
					best = Math.min(best, elapsed);
				}
				return best;
			};
			measure(3000);
			const small = measure(3000);
			const large = measure(6000);
			expect(large / small).toBeLessThan(3.2);
		});
	}

	test('short table rows scale with source size', () => {
		const measure = (size: number) => {
			const content = `x [x] <svg> <!-- a -->\n\n${'|h'.repeat(size)}|\n${'|-'.repeat(size)}|\n${'| x |\n'.repeat(size)}`;
			let best = Infinity;
			for (let attempt = 0; attempt < 7; attempt += 1) {
				const start = performance.now();
				getCommentMarkAll(content);
				const elapsed = (performance.now() - start) * 1000;
				best = Math.min(best, elapsed);
			}
			return best;
		};
		measure(1500);
		const small = measure(3000);
		const large = measure(6000);
		expect(large / small).toBeLessThan(3);
	});

	test('long tag hash collisions preserve exact nearest matches', () => {
		const prefix = 'a'.repeat(16_400);
		const a = `${prefix}0015zx`;
		const b = `${prefix}00cpcd`;
		const marker = createMarker('x', 'value');
		const content = `<!-- a -->\n<div>\n<${a}><svg><${a}></${a}></${b}><![CDATA[ > ${marker} ]]></${a}><![CDATA[ > ${marker} ]]><${b}></${b}><${b}></${b}>`;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'value',
			},
		]);
	});

	test('long colliding tag names scale linearly', () => {
		const pairs = [['0015zx', '00cpcd'], ...Array.from({ length: 10 }, (_, index) => (index % 2 ? ['0035zx', '00apcd'] : ['0053zx', '00cpad']))];
		const prefix = 'a'.repeat(16_400);
		const measure = (size: number) => {
			const content = `<!-- a -->\n<div>\n<svg/>\n${Array.from({ length: size }, (_, index) => `<${prefix}${pairs.map((pair, bit) => pair[Math.floor(index / 2 ** bit) % 2]).join('')}>`).join('')}`;
			let best = Infinity;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const start = performance.now();
				getCommentMarkAll(content);
				const elapsed = (performance.now() - start) * 1000;
				best = Math.min(best, elapsed);
			}
			return best;
		};
		measure(50);
		const small = measure(512);
		const large = measure(1024);
		expect(large / small).toBeLessThan(2.6);
	});

	test('long distinct tag names scale linearly', () => {
		const prefix = 'a'.repeat(16_400);
		const measure = (size: number) => {
			const content = `<!-- a -->\n<div>\n<svg/>\n${Array.from({ length: size }, (_, index) => `<${prefix}${String(index).padStart(5, '0')}>`).join('\n')}`;
			let best = Infinity;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const start = performance.now();
				getCommentMarkAll(content);
				const elapsed = (performance.now() - start) * 1000;
				best = Math.min(best, elapsed);
			}
			return best;
		};
		measure(50);
		const small = measure(800);
		const large = measure(1600);
		expect(large / small).toBeLessThan(2.6);
	});

	test('foreign content scans scale linearly', () => {
		for (const input of [
			(n: number) => '<svg>'.repeat(n) + '</svg>'.repeat(n),
			(n: number) => '<svg>'.repeat(n),
			(n: number) => '<svg>'.repeat(n) + '</missing>'.repeat(n),
			// A native terminator search is much faster than the other cases, so this
			// input is larger to keep its timing above runner noise.
			(n: number) => `<svg>${'<![CDATA['.repeat(n * 400)}`,
			(n: number) => 'x <svg>\n\ntext\n\n'.repeat(n),
		]) {
			const measure = (size: number) => {
				const content = `<!-- a -->${input(size)}`;
				let best = Infinity;
				for (let attempt = 0; attempt < 5; attempt += 1) {
					const start = performance.now();
					getCommentMarkAll(content);
					const elapsed = (performance.now() - start) * 1000;
					best = Math.min(best, elapsed);
				}
				return best;
			};
			measure(1000);
			const small = measure(50_000);
			const large = measure(100_000);
			expect(large / small).toBeLessThan(3);
		}
	});

	test('scans many unterminated openers without rescanning', () => {
		// A document with a long run of `<!--` and no `-->` must not trigger a
		// terminator search at every opener.
		expect(getCommentMarkAll('<!-- a '.repeat(50_000))).toStrictEqual([]);
	});

	test('parses adversarial backtick runs within a time budget', () => {
		// Every run length is unique, so no run finds a partner and each one is
		// literal text, which keeps span matching walking the whole line.
		const runs: string[] = [];
		for (let length = 1; length <= 2048; length += 1) {
			runs.push('`'.repeat(length));
		}
		const content = `${runs.join(' ')} ${createMarker('x', 'value')}`;

		const start = performance.now();
		const markers = getCommentMarkAll(content);
		const elapsed = performance.now() - start;

		expect(markers).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'value',
			},
		]);
		expect(elapsed).toBeLessThan(1500);
	});

	test('ignores many unmatched closers within a time budget', () => {
		// Every closer targets a tag that was never opened, so a scan that
		// searched the pending openers per closer would be quadratic.
		const content = '<!-- a -->'.repeat(20_000) + '<!-- /b -->'.repeat(20_000);

		const start = performance.now();
		const markers = getCommentMarkAll(content);
		const elapsed = performance.now() - start;

		expect(markers).toStrictEqual([]);
		expect(elapsed).toBeLessThan(1500);
	});

	test('link tail and bracket scans scale linearly', () => {
		const inputs = [
			(n: number) => 'http: '.repeat(n),
			(n: number) => 'www. '.repeat(n),
			(n: number) => 'www._ '.repeat(n),
			(n: number) => '['.repeat(n) + '](a "'.repeat(n),
			(n: number) => '['.repeat(n) + "](a '".repeat(n),
			(n: number) => '['.repeat(n) + '](a ('.repeat(n),
			(n: number) => '['.repeat(n * 3) + '](a "](a \'](a ('.repeat(n),
			(n: number) => '['.repeat(n) + '](<'.repeat(n),
			(n: number) => '['.repeat(n) + '](a()'.repeat(n),
			(n: number) => '['.repeat(n) + '![ '.repeat(n) + ']('.repeat(n),
			(n: number) => '[[[['.repeat(n) + '[a](b)'.repeat(n),
		];
		for (const input of inputs) {
			const measure = (size: number) => {
				const content = `x <!-- a --> ${input(size)}`;
				let best = Infinity;
				for (let attempt = 0; attempt < 5; attempt += 1) {
					const start = performance.now();
					getCommentMarkAll(content);
					const elapsed = (performance.now() - start) * 1000;
					best = Math.min(best, elapsed);
				}
				return best;
			};
			measure(1000);
			const small = measure(5000);
			const large = measure(10_000);
			expect(large).toBeLessThan(small * 3 + 20_000);
		}
	});

	test('reference lookups scale linearly', () => {
		for (const input of [
			(n: number) => `${'[r] '.repeat(n)}\n\n${Array.from({ length: n }, (_, i) => `[r${i}]: /u\n`).join('')}[r]: /u`,
			(n: number) => '[undefined] '.repeat(n),
			(n: number) => `[${'a'.repeat(999)}] `.repeat(n),
		]) {
			const measure = (size: number) => {
				const content = `x <!-- a --> ${input(size)}`;
				let best = Infinity;
				for (let attempt = 0; attempt < 5; attempt += 1) {
					const start = performance.now();
					getCommentMarkAll(content);
					const elapsed = (performance.now() - start) * 1000;
					best = Math.min(best, elapsed);
				}
				return best;
			};
			measure(100);
			const small = measure(1000);
			const large = measure(2000);
			expect(large).toBeLessThan(small * 3 + 20_000);
		}
	});
});

import { describe, test, expect } from 'manten';
import { getCommentMarkAll } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('parser scaling', () => {
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
					const start = process.cpuUsage();
					getCommentMarkAll(content);
					const elapsed = process.cpuUsage(start);
					best = Math.min(best, elapsed.user + elapsed.system);
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
					const start = process.cpuUsage();
					getCommentMarkAll(content);
					const elapsed = process.cpuUsage(start);
					best = Math.min(best, elapsed.user + elapsed.system);
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

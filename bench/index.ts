import assert from 'node:assert/strict';
import { bench, run, summary } from 'mitata';
import { type CommentMarkData, commentMark, getCommentMarkAll } from '#comment-mark';
import {
	createMarker, distinctBacktickRuns, fixtures,
} from './fixtures.ts';
import { writeResults } from './results.ts';

type BenchState = {
	get: (name: string) => number;
};

// The selector each fixture declares. The replacement benchmarks use it, and a
// fixture whose selector matches nothing only gets the reader benchmark.
const fixtureSelectors: Record<string, string> = {
	'prose only': 'x',
	'sparse markers': 'x',
	'dense markers': 'x',
	'ordinary comments': 'x',
	'code fences': 'a',
	'long attribute': 'item',
};

// Counts the markers a selector matches. A fixture that stops producing the
// intended path fails loudly instead of skewing the numbers.
const countMarkers = (input: string, selector: string) => getCommentMarkAll(input, selector).length;

// Verify each fixture still exercises the intended path before timing, so a
// fixture that stops producing markers fails loudly instead of skewing the
// numbers.
assert.strictEqual(countMarkers(fixtures['prose only'], 'x'), 0);
assert.strictEqual(countMarkers(fixtures['sparse markers'], 'x'), 1);
assert.strictEqual(countMarkers(fixtures['dense markers'], 'x'), 10_000);
assert.strictEqual(countMarkers(fixtures['ordinary comments'], 'x'), 0);
assert.strictEqual(countMarkers(fixtures['code fences'], 'a'), 1000);
assert.strictEqual(countMarkers(fixtures['long attribute'], 'item'), 1);
assert.strictEqual(countMarkers('<!--comment-mark '.repeat(64), 'comment-mark'), 0);
assert.strictEqual(countMarkers(distinctBacktickRuns(64), 'x'), 1);
assert.strictEqual(getCommentMarkAll(fixtures['dense markers'], 'x')[0]?.content, 'value');

// Each summary groups the APIs on one input, so only rows within the same
// group share an input and are comparable. A fixture without markers only gets
// the reader benchmark, because `commentMark` rejects a selector that matches
// nothing.
for (const [name, input] of Object.entries(fixtures)) {
	const selector = fixtureSelectors[name];

	summary(() => {
		bench(`getCommentMarkAll - ${name}`, () => getCommentMarkAll(input));

		if (countMarkers(input, selector) === 0) {
			return;
		}

		const staticData = { [selector]: 'updated value' };
		// A resolver is invoked for every match, so it returns `undefined` after
		// the first one. Both rows replace only the first match and differ in the
		// replacement mechanism.
		const resolverData = { [selector]: (_marker: CommentMarkData, index: number) => (index === 0 ? 'updated value' : undefined) };
		bench(`commentMark - ${name}`, () => commentMark(input, staticData));
		bench(`commentMark resolver - ${name}`, () => commentMark(input, resolverData));
	});
}

// Update shape on one input: a scalar replaces the first match, an array
// replaces every match. Both parse the input, so the rows differ only in the
// replacement work.
const denseMarkers = fixtures['dense markers'];
const denseValues = Array.from({ length: 10_000 }, () => 'updated value');

summary(() => {
	bench('update first match', () => commentMark(denseMarkers, { x: 'updated value' }));
	bench('update every match', () => commentMark(denseMarkers, { x: denseValues }));
});

// Scaling with marker count.
bench('getCommentMarkAll - markers by count $size', function* markersByCount(state: BenchState) {
	const input = `${createMarker('x', 'value')}\n`.repeat(state.get('size'));
	yield () => getCommentMarkAll(input);
}).args('size', [100, 1000, 10_000]);

// Scaling with unterminated comments. The scan finds no markers and returns an
// empty array.
bench('getCommentMarkAll - unterminated comments by count $size', function* unterminatedComments(state: BenchState) {
	const input = '<!--comment-mark '.repeat(state.get('size'));
	yield () => getCommentMarkAll(input);
}).args('size', [16, 256, 4096, 65_536]);

// Scaling with closers that never match an opener. A closer lookup that
// searched the pending openers would grow quadratically with this input.
bench('getCommentMarkAll - unmatched closers by count $size', function* unmatchedClosers(state: BenchState) {
	const size = state.get('size');
	const input = '<!-- a -->'.repeat(size) + '<!-- /b -->'.repeat(size);
	yield () => getCommentMarkAll(input);
}).args('size', [1000, 10_000]);

// Scaling with distinct backtick runs.
bench('getCommentMarkAll - distinct backtick runs $size', function* distinctBackticks(state: BenchState) {
	const input = distinctBacktickRuns(state.get('size'));
	yield () => getCommentMarkAll(input);
}).args('size', [16, 64, 256]);

// `throw` rejects the run when a benchmark fails, so a broken benchmark is
// never recorded as a result row. Results are written to the bench README, so
// the run itself stays quiet.
const benchmarkRun = await run({
	format: 'quiet',
	throw: true,
});

await writeResults(benchmarkRun);

import assert from 'node:assert/strict';
import { bench, run, summary } from 'mitata';
import { commentMark, getCommentMarks, getCommentMarkers } from '#comment-mark';
import { createMarker, distinctBacktickRuns, fixtures } from './fixtures.js';

type BenchState = {
	get: (name: string) => number;
};

const updateData = { x: 'updated value' };

// Verify each fixture's parser result before timing, so a fixture that stops
// exercising the intended path fails loudly instead of skewing the numbers.
assert.strictEqual(getCommentMarkers(fixtures['prose only']).length, 0);
assert.strictEqual(getCommentMarkers(fixtures['sparse markers']).length, 1);
assert.strictEqual(getCommentMarkers(fixtures['dense markers']).length, 10_000);
assert.strictEqual(getCommentMarkers(fixtures['ordinary comments']).length, 0);
assert.strictEqual(getCommentMarkers(fixtures['code fences']).length, 1000);
assert.strictEqual(getCommentMarkers(fixtures['long attribute']).length, 1);
assert.strictEqual(getCommentMarkers('<!--comment-mark '.repeat(64)).length, 0);
assert.strictEqual(getCommentMarkers(distinctBacktickRuns(64)).length, 1);
assert.strictEqual(getCommentMarks(fixtures['dense markers']).x, 'value');

// Each summary groups the three APIs on one input, so only rows within the same
// group share an input and are comparable.
for (const [name, input] of Object.entries(fixtures)) {
	summary(() => {
		bench(`getCommentMarkers - ${name}`, () => getCommentMarkers(input));
		bench(`getCommentMarks - ${name}`, () => getCommentMarks(input));
		bench(`commentMark - ${name}`, () => commentMark(input, updateData));
	});
}

// Scaling with marker count.
bench('getCommentMarkers - markers by count $size', function* markersByCount(state: BenchState) {
	const input = `${createMarker('x', 'value')}\n`.repeat(state.get('size'));
	yield () => getCommentMarkers(input);
}).args('size', [100, 1000, 10_000]);

// Scaling with unterminated comments. The scan finds no markers and returns [].
bench('getCommentMarkers - unterminated comments by count $size', function* unterminatedComments(state: BenchState) {
	const input = '<!--comment-mark '.repeat(state.get('size'));
	yield () => getCommentMarkers(input);
}).args('size', [16, 256, 4096, 65_536]);

// Scaling with distinct backtick runs.
bench('getCommentMarkers - distinct backtick runs $size', function* distinctBackticks(state: BenchState) {
	const input = distinctBacktickRuns(state.get('size'));
	yield () => getCommentMarkers(input);
}).args('size', [16, 64, 256]);

(async () => {
	await run();
})();

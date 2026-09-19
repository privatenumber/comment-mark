import assert from 'node:assert/strict';
import { bench, summary } from 'mitata';
import { commentMark, getCommentMarks } from '#comment-mark';
import { createMarker, distinctBacktickRuns, fixtures, longAttributeId } from './fixtures.js';

type BenchState = {
	get: (name: string) => number;
};

// The id each fixture declares, so the replacement benchmarks exercise a
// matching key instead of the unmatched-key path.
const fixtureIds: Record<string, string> = {
	'prose only': 'x',
	'sparse markers': 'x',
	'dense markers': 'x',
	'ordinary comments': 'x',
	'code fences': 'a',
	'long attribute': longAttributeId,
};

// Counts the occurrences commentMark is asked to replace. A resolver returning
// null preserves every section, so this runs the full parse through the public
// API without changing the fixture.
const countMarkers = (input: string, id: string) => {
	let count = 0;
	commentMark(input, {
		[id]: () => {
			count += 1;
			return null;
		},
	});
	return count;
};

// Verify each fixture still exercises the intended path before timing, so a
// fixture that stops producing markers fails loudly instead of skewing the
// numbers.
assert.strictEqual(countMarkers(fixtures['prose only'], 'x'), 0);
assert.strictEqual(countMarkers(fixtures['sparse markers'], 'x'), 1);
assert.strictEqual(countMarkers(fixtures['dense markers'], 'x'), 10_000);
assert.strictEqual(countMarkers(fixtures['ordinary comments'], 'x'), 0);
assert.strictEqual(countMarkers(fixtures['code fences'], 'a'), 1000);
assert.strictEqual(countMarkers(fixtures['long attribute'], longAttributeId), 1);
assert.strictEqual(countMarkers('<!--comment-mark '.repeat(64), 'x'), 0);
assert.strictEqual(countMarkers(distinctBacktickRuns(64), 'x'), 1);
assert.strictEqual(getCommentMarks(fixtures['dense markers']).x, 'value');

// Each summary groups the APIs on one input, so only rows within the same
// group share an input and are comparable.
for (const [name, input] of Object.entries(fixtures)) {
	const id = fixtureIds[name];
	const staticData = { [id]: 'updated value' };
	const resolverData = { [id]: () => 'updated value' };

	summary(() => {
		bench(`getCommentMarks - ${name}`, () => getCommentMarks(input));
		bench(`commentMark - ${name}`, () => commentMark(input, staticData));
		bench(`commentMark resolver - ${name}`, () => commentMark(input, resolverData));
	});
}

// Scaling with marker count.
bench('getCommentMarks - markers by count $size', function* markersByCount(state: BenchState) {
	const input = `${createMarker('x', 'value')}\n`.repeat(state.get('size'));
	yield () => getCommentMarks(input);
}).args('size', [100, 1000, 10_000]);

// Scaling with unterminated comments. The scan finds no markers and returns an
// empty object.
bench('getCommentMarks - unterminated comments by count $size', function* unterminatedComments(state: BenchState) {
	const input = '<!--comment-mark '.repeat(state.get('size'));
	yield () => getCommentMarks(input);
}).args('size', [16, 256, 4096, 65_536]);

// Scaling with distinct backtick runs.
bench('getCommentMarks - distinct backtick runs $size', function* distinctBackticks(state: BenchState) {
	const input = distinctBacktickRuns(state.get('size'));
	yield () => getCommentMarks(input);
}).args('size', [16, 64, 256]);

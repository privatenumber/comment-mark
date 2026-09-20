import assert from 'node:assert/strict';
import { bench, summary } from 'mitata';
import { commentMark, createDocument, getCommentMarkAll } from '#comment-mark';
import {
	createMarker, distinctBacktickRuns, fixtures,
} from './fixtures.js';

type BenchState = {
	get: (name: string) => number;
};

// The selector each fixture declares, so the replacement benchmarks exercise a
// matching selector instead of the unmatched-selector path.
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
// group share an input and are comparable.
for (const [name, input] of Object.entries(fixtures)) {
	const selector = fixtureSelectors[name];
	const staticData = { [selector]: 'updated value' };
	const resolverData = { [selector]: () => 'updated value' };

	summary(() => {
		bench(`getCommentMarkAll - ${name}`, () => getCommentMarkAll(input));
		bench(`commentMark - ${name}`, () => commentMark(input, staticData));
		bench(`commentMark resolver - ${name}`, () => commentMark(input, resolverData));
	});
}

// Parsing versus reusing a parsed document. Each pair runs the same update on
// the same input, so the difference is the parse the fresh call repeats.
const denseMarkers = fixtures['dense markers'];
const denseValues = Array.from({ length: 10_000 }, () => 'updated value');

summary(() => {
	bench('update first match, fresh parse', () => commentMark(denseMarkers, { x: 'updated value' }));
	bench('update first match, reused document', function* firstMatchReused() {
		const document = createDocument(denseMarkers);
		yield () => commentMark(document, { x: 'updated value' });
	});
	bench('update every match, fresh parse', () => commentMark(denseMarkers, { x: denseValues }));
	bench('update every match, reused document', function* everyMatchReused() {
		const document = createDocument(denseMarkers);
		yield () => commentMark(document, { x: denseValues });
	});
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

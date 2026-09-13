import { bench, run, summary } from 'mitata';
import { commentMark, getCommentMarks, getCommentMarkers } from '../src/index.js';
import { createMarker, distinctBacktickRuns, fixtures } from './fixtures.js';

type BenchState = {
	get: (name: string) => number;
};

const { 'dense markers': denseMarkers } = fixtures;

// Same input across APIs, so the relative comparison is meaningful.
summary(() => {
	bench('getCommentMarkers - dense markers', () => getCommentMarkers(denseMarkers));
	bench('getCommentMarks - dense markers', () => getCommentMarks(denseMarkers));
	bench('commentMark - dense markers', () => commentMark(denseMarkers, { x: 'updated value' }));
});

// Distinct inputs. Read each row on its own; do not compare across rows.
for (const [name, input] of Object.entries(fixtures)) {
	bench(`getCommentMarkers - ${name}`, () => getCommentMarkers(input));
}

// Scaling with marker count.
bench('getCommentMarkers - markers by count $size', function* markersByCount(state: BenchState) {
	const input = `${createMarker('x', 'value')}\n`.repeat(state.get('size'));
	yield () => getCommentMarkers(input);
}).args('size', [100, 1000, 10_000]);

// Scaling with unterminated comments; every run throws.
bench('getCommentMarkers - unterminated comments by count $size', function* unterminatedComments(state: BenchState) {
	const input = '<!--comment-mark '.repeat(state.get('size'));
	yield () => {
		try {
			getCommentMarkers(input);
		} catch {
			// Expected: the scan runs up to the missing closing comment.
		}
	};
}).args('size', [16, 256, 4096, 65_536]);

// Scaling with distinct backtick runs.
bench('getCommentMarkers - distinct backtick runs $size', function* distinctBackticks(state: BenchState) {
	const input = distinctBacktickRuns(state.get('size'));
	yield () => getCommentMarkers(input);
}).args('size', [16, 64, 256]);

(async () => {
	await run();
})();

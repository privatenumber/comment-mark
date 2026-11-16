import { describe, test, expect } from 'manten';
import { getCommentMarkAll } from '#comment-mark';

describe('parser scaling', () => {
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
});

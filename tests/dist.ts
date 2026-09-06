import { test, expect } from 'manten';
// Self-import resolves through package.json#exports to the built dist output.
import { commentMark, getCommentMarks } from 'comment-mark';

test('built package exports', () => {
	const output = commentMark('<!-- a:start --><!-- a:end -->', {
		a: 'hello world',
	});
	expect(output).toBe('<!-- a:start -->hello world<!-- a:end -->');

	const commentMarks = getCommentMarks(output);
	expect(commentMarks.a).toBe('hello world');
});

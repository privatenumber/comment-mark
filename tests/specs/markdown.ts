import { describe, test, expect } from 'manten';
import { getCommentMarkAll } from '#comment-mark';
import { createMarker } from '../utils/create-marker.ts';

describe('comments that end at a parse error', () => {
	test('do not open or close markers', () => {
		// GitHub renders these as comments, but a marker needs `-->`. The
		// unclosed `<!-- /a` hides the rest of the page.
		expect(getCommentMarkAll('<!-- a -->old\n\n<!-- /a')).toStrictEqual([]);
		expect(getCommentMarkAll('<!-- a --!>old<!-- /a -->')).toStrictEqual([]);
		expect(getCommentMarkAll('<!-- a -->old<!-- /a --!>')).toStrictEqual([]);
		// The unclosed comment ends with its footnote definition, and GitHub
		// shows the `-->` that starts the next paragraph as text
		expect(getCommentMarkAll('text[^1]\n\n[^1]: <!-- a\n\n--> b <!-- /a -->\n')).toStrictEqual([]);
	});
});

describe('empty comments', () => {
	test('an empty comment does not hide the next marker', () => {
		// `<!-->` and `<!--->` are complete comments, so they do not run to the
		// next marker's `-->`.
		for (const empty of ['<!-->', '<!--->']) {
			for (const source of [`x ${empty} ${createMarker('a', 'old')}`, `${empty}\n${createMarker('a', 'old')}`]) {
				expect(getCommentMarkAll(source)).toStrictEqual([
					{
						tagName: 'a',
						attributes: {},
						content: 'old',
					},
				]);
			}
		}
	});
});

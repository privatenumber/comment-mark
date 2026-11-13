import { describe, test, expect } from 'manten';
import { parse, postprocess, preprocess } from 'micromark';
import { gfmTable } from 'micromark-extension-gfm-table';
import { getCommentMarkAll } from '#comment-mark';

/**
 * Returns the `[start, end)` range of every comment that a CommonMark parser
 * with GFM tables finds. An HTML block is one token, so every `<!--` to `-->`
 * that closes inside it counts. That is wrong for `<!--` inside an attribute
 * value, which the generated documents do not contain.
 */
const findReferenceComments = (source: string) => {
	const events = postprocess(
		parse({ extensions: [gfmTable()] }).document().write(preprocess()(source, undefined, true)),
	);
	const comments: [number, number][] = [];

	for (const [phase, token] of events) {
		if (phase !== 'enter') {
			continue;
		}

		const start = token.start.offset;
		const end = token.end.offset;
		if (token.type === 'htmlText' && source.startsWith('<!--', start)) {
			comments.push([start, end]);
		} else if (token.type === 'htmlFlow') {
			let index = source.indexOf('<!--', start);
			while (index !== -1 && index < end) {
				const close = source.indexOf('-->', index + 2);
				if (close === -1 || close >= end) {
					break;
				}
				comments.push([index, close + 3]);
				index = source.indexOf('<!--', close + 3);
			}
		}
	}

	return comments;
};

/**
 * Pairs the reference comments by comment-mark's rule: a closing comment pairs
 * with the nearest open opener, and only the outermost pairs are markers.
 */
const findReferenceMarkers = (source: string) => {
	const openers: number[] = [];
	const pairs: [number, number][] = [];

	for (const [start, end] of findReferenceComments(source)) {
		const inner = source.slice(start + 4, end - 3).trim();
		if (inner === 'a') {
			openers.push(end);
		} else if (inner === '/a' && openers.length > 0) {
			pairs.push([openers.pop()!, start]);
		}
	}

	pairs.sort((first, second) => first[0] - second[0]);
	const outermost: [number, number][] = [];
	for (const pair of pairs) {
		if (outermost.length === 0 || pair[0] > outermost.at(-1)![1]) {
			outermost.push(pair);
		}
	}

	return outermost.map(([start, end]) => source.slice(start, end));
};

// Content drops list and blockquote prefixes from its lines, which this spec
// does not test, so both sides drop the characters prefixes are made of.
const withoutPrefixes = (content: string) => content.replaceAll(/[> ]/g, '');

// Every comment follows text, so no line starts with a comment, and there is
// no inline code, indentation, or backslash. Those cases have known gaps in
// notes/comment-mark/comment-scanning.md, so they are excluded here.
const fragments = [
	'x <!-- a -->',
	'x <!-- /a -->',
	'x <!-- b -->',
	'x <!--',
	'-->',
	'x <!-->',
	'x <!--->',
	'\n',
	'\n',
	'\n\n',
	' ',
	'text',
	'\n```\n',
	'\n~~~\n',
	'> ',
	'- ',
	'1. ',
	'2. ',
	'| - |',
	'|',
	'# ',
	'\n===\n',
	'\n***\n',
	'*',
	'\n<div>\n\n',
	'\n<pre></pre>\n',
	'\n<?x?>\n',
	'\n<!X>\n',
];

describe('agreement with a reference parser', () => {
	test('finds the same markers as micromark in generated documents', () => {
		// A seeded Park-Miller generator makes every run generate the same
		// documents. Each product stays below 2 ** 53, so it is exact.
		let seed = 42;
		const random = (limit: number) => {
			seed = (seed * 48_271) % 2_147_483_647;
			return seed % limit;
		};

		for (let index = 0; index < 5000; index += 1) {
			let source = '';
			const length = 2 + random(16);
			for (let part = 0; part < length; part += 1) {
				source += fragments[random(fragments.length)];
			}

			const actual = getCommentMarkAll(source).map(marker => withoutPrefixes(marker.content));
			const expected = findReferenceMarkers(source).map(withoutPrefixes);
			const matches = actual.length === expected.length
				&& actual.every((content, at) => content === expected[at]);
			if (!matches) {
				// The source is part of the comparison so a failure shows it.
				expect({
					source,
					markers: actual,
				}).toStrictEqual({
					source,
					markers: expected,
				});
			}
		}
	});
});

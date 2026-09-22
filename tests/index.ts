import { readFile } from 'node:fs/promises';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import {
	commentMark,
	getCommentMark,
	getCommentMarkAll,
} from '#comment-mark';
import { commentMarkCli } from './utils/comment-mark-cli.js';

const createMarker = (tag: string, content = '') => `<!-- ${tag} -->${content}<!-- /${tag} -->`;

describe('edge cases', () => {
	test('no arguments', () => {
		// @ts-expect-error No arguments passed in
		const output = commentMark();
		expect(output).toBe(undefined);
	});

	test('empty str', () => {
		const output = commentMark('', {});
		expect(output).toBe('');
	});

	test('invalid obj', () => {
		// @ts-expect-error Invalid argument passed in
		const output = commentMark('', 1);
		expect(output).toBe('');
	});

	test('ignores an unmatched opening comment', () => {
		const content = '<!-- a -->never closed\n';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'x' })).toBe(content);
	});

	test('ignores a closing comment with no opening comment', () => {
		const content = '<!-- /a -->text<!-- a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'x' })).toBe(content);
	});

	test('does not pair a closing comment with a different tag', () => {
		const content = '<!-- a -->text<!-- /b -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'x' })).toBe(content);
	});

	test('ignores comments that are not tags', () => {
		const content = [
			'<!-- TODO: fix this -->',
			'<!-- 1 + 1 -->',
			'<!-- -->',
			'<!--a/b-->',
			'<!--a:b-->',
		].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { TODO: 'x' })).toBe(content);
	});

	test('ignores an unmatched comment with malformed attributes', () => {
		// Only a matched pair is a marker, so an ordinary comment is never
		// parsed as a marker with broken attributes.
		const content = '<!-- see id -->\n';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('rejects nested markers', () => {
		expect(() => getCommentMarkAll(
			'<!-- a -->outer<!-- b -->inner<!-- /b -->x<!-- /a -->',
		)).toThrow('[comment-mark] Nested marker "b" is not supported');
	});

	test('allows an unmatched opening comment inside a marker', () => {
		// `<!-- TODO -->` has no closing comment, so it is not a marker and the
		// outer marker is not nested.
		const content = '<!-- a --><!-- TODO -->text<!-- /a -->';
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '<!-- TODO -->text',
			},
		]);
	});

	test('ignores a closing comment with trailing text', () => {
		// Only `<!-- /a -->` closes `a`. `<!-- /a extra -->` is ordinary text,
		// so it cannot silently pair with the opener and leave `extra` unread.
		const content = '<!-- a -->x<!-- /a extra -->';
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'y' })).toBe(content);
	});

	test('rejects a matched pair inside a marker behind an unmatched comment', () => {
		// `<!-- x -->` is never closed, but `b` still opens and closes inside
		// `a`, so replacing `a` would overwrite `b`'s comments.
		expect(() => getCommentMarkAll(
			'<!-- a --><!-- x --><!-- b -->inner<!-- /b --><!-- /a -->',
		)).toThrow('[comment-mark] Nested marker "b" is not supported');
	});

	test('scans many unterminated openers without rescanning', () => {
		// A document with a long run of `<!--` and no `-->` must not trigger a
		// terminator search at every opener.
		expect(getCommentMarkAll('<!-- a '.repeat(50_000))).toStrictEqual([]);
	});
});

describe('replacement', () => {
	test('returns a string for valid input', () => {
		// The annotation is the contract: the return type is a string for every
		// supported call, not a document or a buffer.
		const output: string = commentMark(createMarker('a', 'old'), { a: 'new' });
		expect(output).toBe(createMarker('a', 'new'));
	});

	test('basic', () => {
		const output = commentMark(createMarker('a'), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('skip nullish properties', () => {
		const output = commentMark(createMarker('a', 'hello world'), {
			a: undefined,
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('multi-line', () => {
		const output = commentMark(`
			# multiline
			${createMarker('a', 'hello world')}
		`, {
			a: 'hello world\n\ngoogbye world\nhello again',
		});

		expect(output).toBe('\n\t\t\t# multiline\n\t\t\t<!-- a -->\nhello world\n\ngoogbye world\nhello again\n<!-- /a -->\n\t\t');
	});

	test('multiple', () => {
		const output = commentMark(`
			${createMarker('a')}
			${createMarker('b')}
			${createMarker('ba')}
		`, {
			a: 'hello world',
			b: 'goodbye world',
			ba: 'something world',
		});

		expect(output).toBe(`\n\t\t\t${createMarker('a', 'hello world')}\n\t\t\t${createMarker('b', 'goodbye world')}\n\t\t\t${createMarker('ba', 'something world')}\n\t\t`);
	});

	test('updates the first match for a scalar value', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: 'hello world',
		});
		expect(output).toBe(`${createMarker('a', 'hello world')}\n${createMarker('a', 'two')}`);
	});

	test('updates matches by position for an array value', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first', 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'second')}`);
	});

	test('leaves matches beyond the array untouched', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: ['first'],
		});
		expect(output).toBe(`${createMarker('a', 'first')}\n${createMarker('a', 'two')}`);
	});

	test('lets a nullish entry skip a match', () => {
		const output = commentMark(`${createMarker('a', 'one')}\n${createMarker('a', 'two')}`, {
			a: [null, 'second'],
		});
		expect(output).toBe(`${createMarker('a', 'one')}\n${createMarker('a', 'second')}`);
	});

	test('an empty array changes nothing', () => {
		const content = `${createMarker('a', 'one')}\n${createMarker('a', 'two')}`;
		expect(commentMark(content, { a: [] })).toBe(content);
	});

	test('rejects more values than matches', () => {
		expect(() => commentMark(createMarker('a'), {
			a: ['one', 'two'],
		})).toThrow('[comment-mark] Selector "a" matched 1 marker but received 2 values');
	});

	test('rejects two selectors targeting the same marker', () => {
		const selector = 'a[id="x"]';

		expect(() => commentMark('<!-- a id="x" -->v<!-- /a -->', {
			a: 'one',
			[selector]: 'two',
		})).toThrow(`[comment-mark] Selectors "a" and ${JSON.stringify(selector)} both target the marker "a"`);
	});

	test('leaves markers without a matching selector untouched', () => {
		const output = commentMark(createMarker('a', 'hello world'), {
			b: 'goodbye world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});

	test('round trips source with no replacements byte for byte', () => {
		const content = '<!-- a\n\tid = "x"  -->\r\nline\r\n<!-- /a -->\n';
		expect(commentMark(content, {})).toBe(content);
	});

	test('Buffer', () => {
		const output = commentMark(Buffer.from(createMarker('a')), {
			a: 'hello world',
		});
		expect(output).toBe(createMarker('a', 'hello world'));
	});
});

describe('selectors', () => {
	test('matches a tag name', () => {
		expect(getCommentMark(createMarker('a', 'value'), 'a')?.content).toBe('value');
		expect(getCommentMark(createMarker('a', 'value'), 'b')).toBe(null);
	});

	test('matches an attribute that exists', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, 'item[kind]')?.content).toBe('apple');
		expect(getCommentMark(content, 'item[missing]')).toBe(null);
	});

	test('matches an attribute value', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[kind='fruit']")?.content).toBe('apple');
		expect(getCommentMark(content, 'item[kind="fruit"]')?.content).toBe('apple');
		expect(getCommentMark(content, 'item[kind=fruit]')?.content).toBe('apple');
		expect(getCommentMark(content, "item[kind='vegetable']")).toBe(null);
	});

	test('matches every predicate', () => {
		const content = '<!-- item kind="fruit" lang="en" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[kind='fruit'][lang='en']")?.content).toBe('apple');
		expect(getCommentMark(content, "item[kind='fruit'][lang='fr']")).toBe(null);
	});

	test('matches the parsed value regardless of how it was quoted', () => {
		expect(getCommentMark('<!-- a id=x -->v<!-- /a -->', "a[id='x']")?.content).toBe('v');
		expect(getCommentMark("<!-- a id='x' -->v<!-- /a -->", 'a[id="x"]')?.content).toBe('v');
	});

	test('matches a value containing spaces and punctuation', () => {
		const content = '<!-- a query="x=1&y=/z" -->v<!-- /a -->';
		expect(getCommentMark(content, 'a[query="x=1&y=/z"]')?.content).toBe('v');
	});

	test('matches values with special characters', () => {
		const content = '<!-- a key="a.b:c" -->v<!-- /a -->';
		expect(getCommentMark(content, "a[key='a.b:c']")?.content).toBe('v');
	});

	test('tolerates whitespace inside the predicate', () => {
		const content = '<!-- item kind="fruit" -->apple<!-- /item -->';
		expect(getCommentMark(content, "item[ kind = 'fruit' ]")?.content).toBe('apple');
	});

	test('rejects an unsupported operator', () => {
		const selector = 'a[kind^="f"]';

		expect(() => getCommentMarkAll(createMarker('a'), selector)).toThrow(
			`[comment-mark] Invalid selector: ${JSON.stringify(selector)}`,
		);
	});

	test('rejects a descendant combinator', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a b')).toThrow('[comment-mark] Invalid selector: "a b"');
	});

	test('rejects a selector list', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a, b')).toThrow('[comment-mark] Invalid selector: "a, b"');
	});

	test('rejects a pseudo-class', () => {
		expect(() => getCommentMarkAll(createMarker('a'), 'a:hover')).toThrow('[comment-mark] Invalid selector: "a:hover"');
	});

	test('rejects an unterminated predicate', () => {
		expect(() => getCommentMarkAll(createMarker('a'), "a[kind='fruit'")).toThrow('[comment-mark] Invalid selector');
	});

	test('rejects an empty selector', () => {
		expect(() => getCommentMarkAll(createMarker('a'), '')).toThrow('[comment-mark] Invalid selector: ""');
	});
});

describe('attributes', () => {
	test('parses single-quoted values', () => {
		expect(getCommentMarkAll("<!-- a id='a b' -->x<!-- /a -->")).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: 'a b' },
				content: 'x',
			},
		]);
	});

	test('parses unquoted values', () => {
		expect(getCommentMarkAll('<!-- a id=a -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: 'a' },
				content: 'x',
			},
		]);
	});

	test('tolerates whitespace inside the tags', () => {
		const output = commentMark('<!-- comment-mark id = "a" -->x<!-- / comment-mark -->', {
			"comment-mark[id='a']": 'y',
		});
		expect(output).toBe('<!-- comment-mark id = "a" -->y<!-- / comment-mark -->');
	});

	test('preserves additional attributes', () => {
		expect(getCommentMarkAll('<!-- license file="./LICENSE.md" -->cached<!-- /license -->')).toStrictEqual([
			{
				tagName: 'license',
				attributes: { file: './LICENSE.md' },
				content: 'cached',
			},
		]);
	});

	test('allows values containing = and /', () => {
		expect(getCommentMarkAll('<!-- a query="x=1&y=/z" -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { query: 'x=1&y=/z' },
				content: 'x',
			},
		]);
	});

	test('supports markers without attributes', () => {
		expect(getCommentMarkAll('<!--a-->x<!--/a-->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'x',
			},
		]);
	});

	test('keeps an empty attribute value', () => {
		expect(getCommentMarkAll('<!-- a id="" -->x<!-- /a -->')).toStrictEqual([
			{
				tagName: 'a',
				attributes: { id: '' },
				content: 'x',
			},
		]);
	});

	test('rejects duplicate attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id="a" id="b" -->x<!-- /a -->')).toThrow(
			'[comment-mark] Duplicate marker attribute: "id"',
		);
	});

	test('rejects malformed attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id -->x<!-- /a -->')).toThrow(
			'[comment-mark] Invalid marker attribute: "id"',
		);
	});

	test('requires whitespace between attributes', () => {
		expect(() => getCommentMarkAll('<!-- a id="a"file="./b.md" -->x<!-- /a -->')).toThrow(
			'[comment-mark] Expected whitespace between attributes',
		);
	});

	test('rejects an unterminated attribute value', () => {
		expect(() => getCommentMarkAll('<!-- a id="a -->x<!-- /a -->')).toThrow(
			'[comment-mark] Unterminated attribute value for "id"',
		);
	});

	test('rejects a quote inside an unquoted value', () => {
		expect(() => getCommentMarkAll('<!-- a id=a"b" -->x<!-- /a -->')).toThrow(
			'Invalid marker attribute',
		);
	});
});

describe('getCommentMark and getCommentMarkAll', () => {
	test('returns markers in document order', () => {
		expect(getCommentMarkAll(`${createMarker('a', 'first')}\n${createMarker('b', 'second')}`)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'first',
			},
			{
				tagName: 'b',
				attributes: {},
				content: 'second',
			},
		]);
	});

	test('filters by selector', () => {
		const content = [
			'<!-- item kind="fruit" -->apple<!-- /item -->',
			'<!-- item kind="vegetable" -->carrot<!-- /item -->',
		].join('\n');

		expect(getCommentMarkAll(content, "item[kind='fruit']").map(mark => mark.content)).toStrictEqual(['apple']);
		expect(getCommentMark(content, "item[kind='vegetable']")?.content).toBe('carrot');
	});

	test('returns an empty array when no markers exist', () => {
		expect(getCommentMarkAll('<!-- ordinary comment -->')).toStrictEqual([]);
	});

	test('keeps every occurrence of a duplicate tag name', () => {
		const content = [
			'<!-- item kind="fruit" -->apple<!-- /item -->',
			'<!-- item kind="fruit" -->pear<!-- /item -->',
		].join('\n');

		expect(getCommentMarkAll(content).map(mark => [mark.tagName, mark.content])).toStrictEqual([
			['item', 'apple'],
			['item', 'pear'],
		]);
		expect(getCommentMark(content, 'item')?.content).toBe('apple');
	});

	test('returns empty content for an empty marker', () => {
		expect(getCommentMarkAll(createMarker('a'))).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '',
			},
		]);
	});

	test('supports Buffer input', () => {
		expect(getCommentMarkAll(Buffer.from(createMarker('a', 'hello world')))).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'hello world',
			},
		]);
	});

	test('supports tag names named like Object properties', () => {
		expect(getCommentMarkAll(createMarker('__proto__', 'hello world'))).toStrictEqual([
			{
				tagName: '__proto__',
				attributes: {},
				content: 'hello world',
			},
		]);
	});
});

describe('comment and code boundaries', () => {
	test('a fenced example containing <!-- does not hide the next marker', () => {
		const content = ['```html', '<!--', '```', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['```html', '<!--', '```', createMarker('x', 'NEW')].join('\n'),
		);
	});

	test('an inline example containing <!-- does not hide the next marker', () => {
		const content = `\`<!--\` ${createMarker('x', 'old')}`;

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(`\`<!--\` ${createMarker('x', 'NEW')}`);
	});

	test('a backtick in an attribute value does not hide the closing comment', () => {
		const content = '<!-- a note="`" -->old<!-- /a -->`';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: { note: '`' },
				content: 'old',
			},
		]);
	});

	test('a fence-looking line inside an HTML comment does not hide later markers', () => {
		const content = ['<!--', '```', '-->', createMarker('x', 'old')].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'old',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['<!--', '```', '-->', createMarker('x', 'NEW')].join('\n'),
		);
	});
});

describe('block comments', () => {
	test('a standalone comment does not expose a following list fence', () => {
		const content = ['<!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('an indented standalone comment does not expose a following list fence', () => {
		const content = ['  <!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a multiline standalone comment does not expose a following list fence', () => {
		const content = ['<!--', 'note', '-->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a block comment interrupts an open paragraph', () => {
		const content = ['paragraph', '<!-- note -->', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a comment inside a paragraph does not end it', () => {
		// The comment is paragraph text, so `2.` cannot start a list and the
		// fence-looking line stays paragraph text.
		const content = ['text <!-- note -->', '2. ~~~', `   ${createMarker('x', 'real')}`, '   ~~~'].join('\n');

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});
});

describe('code blocks', () => {
	test('ignores markers inside fenced code blocks', () => {
		const content = ['```md', createMarker('a', 'example'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { a: 'hello world' })).toBe(content);
	});

	test('ignores markers inside tilde fences', () => {
		const content = ['~~~', createMarker('a', 'example'), '~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers inside an unterminated fence', () => {
		const content = `\`\`\`\n${createMarker('a', 'example')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers inside inline code', () => {
		const content = `See \`${createMarker('a', 'example')}\` for details`;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('parses markers outside of code', () => {
		const content = `\`${createMarker('a', 'inline')}\`\n${createMarker('b', 'real')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'b',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('a closing marker inside a fence does not close a marker', () => {
		const content = '<!-- a -->\n```md\n<!-- /a -->\n```\nKEEP\n<!-- /a -->';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: '\n```md\n<!-- /a -->\n```\nKEEP\n',
			},
		]);
		expect(commentMark(content, { a: 'NEW' })).toBe('<!-- a -->NEW<!-- /a -->');
	});

	test('a closing fence with trailing text does not close the fence', () => {
		const content = `\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`not-a-close\n${createMarker('b', 'real')}\n\`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a longer fence contains shorter fences', () => {
		const content = `\`\`\`\`\n\`\`\`md\n${createMarker('a', 'example')}\n\`\`\`\n\`\`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('ignores markers in blockquote fences', () => {
		const content = `> \`\`\`md\n> ${createMarker('a', 'example')}\n> \`\`\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('an escaped backtick does not open inline code', () => {
		const content = `\\\`${createMarker('a', 'real')}\``;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('an unterminated inline code span does not hide later markers', () => {
		const content = `\`unclosed\n${createMarker('a', 'real')}`;
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('two backslashes before an opening backtick do not escape it', () => {
		// The backslashes escape each other, so the backtick still opens a span.
		const content = `\\\\\`${createMarker('x', 'example')}\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a backslash before a closing backtick does not escape it inside a span', () => {
		const content = `\`${createMarker('x', 'example')}\\\``;
		expect(getCommentMarkAll(content)).toStrictEqual([]);
	});

	test('a blockquote fence line inside a top-level fence does not close it', () => {
		const content = ['```md', '> ```', createMarker('x', 'example'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a blockquote that ends before its unclosed fence does not hide later markers', () => {
		const content = ['> ```', '> code', '', createMarker('x', 'real')].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('a backtick in a fence info string does not open a fence', () => {
		const content = ['``` `', createMarker('x', 'real'), '```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('a fence indented to a list item content column is recognized', () => {
		const content = ['1. item', '', '    ```', `    ${createMarker('x', 'example')}`, '    ```'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a thematic break does not create list context for a following fence', () => {
		const content = ['* * *', '  ~~~md', createMarker('x', 'example'), '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('an escaped multi-backtick run cannot close an existing span', () => {
		const content = ['`example \\', '`` ', createMarker('x', 'example'), '`'].join('');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a tab-indented line continues a list fence', () => {
		const content = ['- item', '', '  ~~~md', `\t${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a tab after a blockquote marker still opens a fence', () => {
		const content = ['>\t~~~md', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a tab can satisfy indentation for nested list levels', () => {
		const content = ['- outer', '  - inner', '    ~~~md', `\t${createMarker('x', 'example')}`, '    ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('indentation from a blockquote tab cannot close a fence', () => {
		const content = ['> ~~~md', '>\t  ~~~', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('indentation from a list tab cannot close a fence', () => {
		const content = ['- item', '  ~~~md', '\t  ~~~', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a fence with mixed space and tab padding is recognized', () => {
		const content = ['- \t~~~md', `\t${createMarker('x', 'example')}`, '\t~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a blank line ends a fence inside a blockquote', () => {
		const content = ['> ~~~', '', '> ~~~', `> ${createMarker('x', 'example')}`, '> ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a blank line continues a fence inside a list item', () => {
		const content = ['- ~~~md', '', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a quote-prefixed blank line keeps a list fence open', () => {
		const content = ['> - ~~~', '>', `>   ${createMarker('x', 'example')}`, '>   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a list padding tab that overshoots five columns does not open a fence', () => {
		const content = ['-\t  ~~~', '', '  ~~~', `  ${createMarker('x', 'example')}`, '  ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});
});

describe('paragraph interruption', () => {
	test('an ordered marker other than one does not interrupt a paragraph', () => {
		const content = ['paragraph', '2. ~~~', `   ${createMarker('x', 'real')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['paragraph', '2. ~~~', `   ${createMarker('x', 'NEW')}`, '   ~~~'].join('\n'),
		);
	});

	test('a marker after a dropped container is not treated as paragraph text', () => {
		// The list item ends before `2.`, so the ordered marker is a real list
		// and hides the fenced example that follows.
		const content = ['- item', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('an ordered marker inside a blockquote paragraph does not interrupt it', () => {
		const content = ['> paragraph', '> 2. ~~~', `>    ${createMarker('x', 'real')}`, '>    ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});
});

describe('heading context', () => {
	test('an ATX heading does not leave a paragraph open', () => {
		// The heading ends the paragraph, so `2.` starts a real list and its
		// fence hides the example that follows.
		const content = ['# Heading', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a setext heading does not leave a paragraph open', () => {
		const content = ['Heading', '===', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});

	test('a setext dash underline does not leave a paragraph open', () => {
		const content = ['Heading', '---', '2. ~~~', `   ${createMarker('x', 'example')}`, '   ~~~'].join('\n');
		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { x: 'NEW' })).toBe(content);
	});
});

describe('markers in headings', () => {
	test('finds a marker on an ATX heading line', () => {
		const content = '# <!-- title -->Old<!-- /title -->';

		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'title',
				attributes: {},
				content: 'Old',
			},
		]);
		expect(commentMark(content, { title: 'New' })).toBe('# <!-- title -->New<!-- /title -->');
	});

	test('ignores a marker example in inline code on a heading line', () => {
		const content = `# \`${createMarker('title', 'example')}\``;

		expect(getCommentMarkAll(content)).toStrictEqual([]);
		expect(commentMark(content, { title: 'New' })).toBe(content);
	});

	test('finds a marker on a heading inside a blockquote', () => {
		expect(getCommentMark('> # <!-- title -->Old<!-- /title -->', 'title')?.content).toBe('Old');
	});

	test('finds a marker on a heading inside a list item', () => {
		expect(getCommentMark('- # <!-- title -->Old<!-- /title -->', 'title')?.content).toBe('Old');
	});
});

describe('line endings', () => {
	test('a marker after a closed fence is recognized in a CR-only document', () => {
		const content = ['~~~', 'code', '~~~', createMarker('x', 'real')].join('\r');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
		expect(commentMark(content, { x: 'NEW' })).toBe(
			['~~~', 'code', '~~~', createMarker('x', 'NEW')].join('\r'),
		);
	});

	test('a marker after a closed fence is recognized in a CRLF document', () => {
		const content = ['~~~', 'code', '~~~', createMarker('x', 'real')].join('\r\n');
		expect(getCommentMarkAll(content)).toStrictEqual([
			{
				tagName: 'x',
				attributes: {},
				content: 'real',
			},
		]);
	});

	test('preserves the line endings around a replaced section', () => {
		const content = ['<!-- a -->', 'old', '<!-- /a -->'].join('\r\n');
		expect(commentMark(content, { a: 'new' })).toBe(['<!-- a -->new<!-- /a -->'].join('\r\n'));
	});
});

describe('parser scaling', () => {
	test('parses adversarial backtick runs within a linear-time budget', () => {
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

	test('ignores many unmatched closers within a linear-time budget', () => {
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

describe('public API', () => {
	test('exposes the update and reader functions', async () => {
		const module = await import('#comment-mark');

		expect(Object.keys(module).sort()).toStrictEqual([
			'commentMark',
			'getCommentMark',
			'getCommentMarkAll',
		]);
	});
});

describe('CLI', () => {
	test('sources name, description, and version from package.json', async () => {
		const packageJson = JSON.parse(
			await readFile(new URL('../package.json', import.meta.url), 'utf8'),
		) as {
			name: string;
			description: string;
			version: string;
		};

		const { stdout: versionOutput } = await commentMarkCli('--version');
		expect(versionOutput).toBe(packageJson.version);

		const { stdout: helpOutput } = await commentMarkCli('--help');
		expect(helpOutput).toContain(packageJson.name);
		expect(helpOutput).toContain(packageJson.description);

		const { stdout: shortHelpOutput } = await commentMarkCli('-h');
		expect(shortHelpOutput).toBe(helpOutput);
	});

	test('lists detected markers as JSON when no selector flags are passed', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a', 'hello world')}\n<!-- b -->\nmulti\nline\n<!-- /b -->\n`,
		});

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([
			{
				tagName: 'a',
				attributes: {},
				content: 'hello world',
			},
			{
				tagName: 'b',
				attributes: {},
				content: '\nmulti\nline\n',
			},
		]);
	});

	test('prints an empty JSON array in read mode when no markers exist', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- ordinary comment -->\n' });

		const { stdout } = await commentMarkCli(fixture.getPath('README.md'));

		expect(JSON.parse(stdout)).toStrictEqual([]);
	});

	test('allows setting markers named like control flags', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('help', 'stale')}\n${createMarker('version', '1.0.0')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--help=docs', '--version=2.0.0');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('help', 'docs')}\n${createMarker('version', '2.0.0')}\n`,
		);
	});

	test('updates a marked section in place', async () => {
		await using fixture = await createFixture({
			'README.md': `## Contributors\n${createMarker('contributors', 'stale')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--contributors=Jane Doe');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`## Contributors\n${createMarker('contributors', 'Jane Doe')}\n`,
		);
	});

	test('selects a marker by attribute', async () => {
		await using fixture = await createFixture({
			'README.md': '<!-- item kind="fruit" -->apple<!-- /item -->\n',
		});

		await commentMarkCli(fixture.getPath('README.md'), "--item[kind='fruit']=pear");

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			'<!-- item kind="fruit" -->pear<!-- /item -->\n',
		);
	});

	test('updates multiple markers with multiline values', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a')}\n${createMarker('b')}\n`,
		});

		await commentMarkCli(fixture.getPath('README.md'), '--a=first', '--b=second\nline');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('a', 'first')}\n<!-- b -->\nsecond\nline\n<!-- /b -->\n`,
		);
	});

	test('reports per-selector outcomes and exits non-zero when markers are missing', async () => {
		await using fixture = await createFixture({
			'README.md': `${createMarker('a', 'stale')}\n${createMarker('b', 'same')}\n`,
		});

		const invocation = commentMarkCli(fixture.getPath('README.md'), '--a=fresh', '--b=same', '--nope=x');

		await expect(invocation).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(/Updated: a[\s\S]*Unchanged: b[\s\S]*Missing: nope/),
		});
		await expect(invocation).rejects.toMatchObject({
			stderr: expect.stringMatching(/Saved .*\. Updated 1 selector; 1 unchanged; 1 missing\./),
		});

		// Valid updates are still saved when other selectors are missing.
		expect(await fixture.readFile('README.md', 'utf8')).toBe(
			`${createMarker('a', 'fresh')}\n${createMarker('b', 'same')}\n`,
		);
	});

	test('exits successfully when all requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'same') });

		const { stderr } = await commentMarkCli(fixture.getPath('README.md'), '--a=same');

		expect(stderr).toContain('is unchanged. All 1 requested values already match.');
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'same'));
	});

	test('exits non-zero without writing when every requested marker is missing', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'value') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--nope1=x', '--nope2=y')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 2 requested selectors'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'value'));
	});

	test('clears a section when the value is empty', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'gone') });

		await commentMarkCli(fixture.getPath('README.md'), '--a=');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('exits non-zero when a valueless flag is passed', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No value provided for flag "--a"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('rejects a single-dash flag instead of reading the file', async () => {
		// cleye would split `-a=new` into short flags and the selector would
		// disappear, leaving read mode to exit 0 without updating anything.
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'old') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '-a=new')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unknown flag "-a=new"'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'old'));
	});

	test('exits non-zero when a control flag is repeated', async () => {
		// A repeated `--help` must not fall through to read mode.
		await expect(commentMarkCli('--help', '--help')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--help" was specified 2 times'),
		});
	});

	test('exits non-zero when the same flag is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=1', '--a=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--a" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('exits non-zero on unexpected extra positional arguments', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a') });

		await expect(commentMarkCli(fixture.getPath('README.md'), 'extra', '--a=1')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Unexpected extra arguments: extra'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a'));
	});

	test('reports an unterminated marker as missing and leaves the file untouched', async () => {
		await using fixture = await createFixture({ 'README.md': '<!-- a -->never closed\n' });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('No matching markers found for any of the 1 requested selectors'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe('<!-- a -->never closed\n');
	});

	test('exits non-zero when the file does not exist', async () => {
		await expect(commentMarkCli('/nonexistent/path/README.md', '--a=hi')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('ENOENT'),
		});
	});

	test('reports missing selectors when the remaining requested values already match', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('a', 'same') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--a=same', '--nope=x')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(/Unchanged: a[\s\S]*Missing: nope/),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('a', 'same'));
	});

	test('updates a marker named like an Object prototype property', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('__proto__', 'old') });

		await commentMarkCli(fixture.getPath('README.md'), '--__proto__=NEW');

		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('__proto__', 'NEW'));
	});

	test('exits non-zero when a reserved marker name is passed multiple times', async () => {
		await using fixture = await createFixture({ 'README.md': createMarker('__proto__') });

		await expect(commentMarkCli(fixture.getPath('README.md'), '--__proto__=1', '--__proto__=2')).rejects.toMatchObject({
			exitCode: 1,
			stderr: expect.stringContaining('Flag "--__proto__" was specified 2 times'),
		});
		expect(await fixture.readFile('README.md', 'utf8')).toBe(createMarker('__proto__'));
	});
});

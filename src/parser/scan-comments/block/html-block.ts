import { isAsciiAlphanumeric, isSpaceChar, scanHtmlTag } from '../html-tag.ts';
import { charAt, isSpaceOrTab } from './line.ts';

const blockTagNames = new Set([
	'address',
	'article',
	'aside',
	'base',
	'basefont',
	'blockquote',
	'body',
	'caption',
	'center',
	'col',
	'colgroup',
	'dd',
	'details',
	'dialog',
	'dir',
	'div',
	'dl',
	'dt',
	'fieldset',
	'figcaption',
	'figure',
	'footer',
	'form',
	'frame',
	'frameset',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'head',
	'header',
	'hr',
	'html',
	'iframe',
	'legend',
	'li',
	'link',
	'main',
	'menu',
	'menuitem',
	'nav',
	'noframes',
	'ol',
	'optgroup',
	'option',
	'p',
	'param',
	'section',
	'source',
	'title',
	'summary',
	'table',
	'tbody',
	'td',
	'tfoot',
	'th',
	'thead',
	'tr',
	'track',
	'ul',
]);

const rawTagNames = new Set(['script', 'pre', 'textarea', 'style']);

// The text that ends an HTML block of types 2 to 5.
const htmlBlockClosers: Record<number, string> = {
	2: '-->',
	3: '?>',
	4: '>',
	5: ']]>',
};
const rawTagClosers = ['</script>', '</pre>', '</textarea>', '</style>'];

const isTrailingSpace = (code: number) => isSpaceOrTab(code) || code === 12;

/**
 * `_scan_html_block_start` and `_scan_html_block_start_7` for the line from
 * `index`, its first nonspace, to `lineEnd`. Returns the type or 0. The result
 * depends only on that line, but `scanHtmlTag` can search past it for the end
 * of a quoted attribute value.
 */
export const scanHtmlBlockStart = (
	source: string,
	index: number,
	lineEnd: number,
	interruptsParagraph: boolean,
) => {
	if (charAt(source, index, lineEnd) !== 60) {
		return 0;
	}
	const next = charAt(source, index + 1, lineEnd);
	if (next === 33) {
		const after = charAt(source, index + 2, lineEnd);
		if (after === 45 && charAt(source, index + 3, lineEnd) === 45) {
			return 2;
		}
		if (after >= 65 && after <= 90) {
			return 4;
		}
		return index + 9 <= lineEnd && source.slice(index + 2, index + 9).toUpperCase() === '[CDATA[' ? 5 : 0;
	}
	if (next === 63) {
		return 3;
	}

	const closing = next === 47;
	const nameStart = index + (closing ? 2 : 1);
	let nameEnd = nameStart;
	while (isAsciiAlphanumeric(charAt(source, nameEnd, lineEnd))) {
		nameEnd += 1;
	}
	const name = source.slice(nameStart, nameEnd).toLowerCase();
	const after = charAt(source, nameEnd, lineEnd);
	if (!closing && rawTagNames.has(name) && (isSpaceChar(after) || after === 62)) {
		return 1;
	}
	if (
		blockTagNames.has(name)
		&& (
			isSpaceChar(after)
			|| after === 62
			|| (after === 47 && charAt(source, nameEnd + 1, lineEnd) === 62)
		)
	) {
		return 6;
	}
	if (interruptsParagraph) {
		return 0;
	}

	// Type 7: one complete open or closing tag, alone on its line.
	let end = scanHtmlTag(source, index, lineEnd);
	if (end === -1) {
		return 0;
	}
	while (end < lineEnd && isTrailingSpace(source.charCodeAt(end))) {
		end += 1;
	}
	return end === lineEnd ? 7 : 0;
};

/** Whether the line from `start` to `lineEnd` ends an HTML block of type 1 to 5. */
export const closesHtmlBlock = (source: string, start: number, lineEnd: number, kind: number) => {
	const line = source.slice(start, lineEnd);
	if (kind === 1) {
		const lower = line.toLowerCase();
		return rawTagClosers.some(closer => lower.includes(closer));
	}
	return line.includes(htmlBlockClosers[kind]);
};

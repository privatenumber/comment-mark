/// <reference lib="es2024.string" />

import type { GeneratedBlock } from './block/index.ts';
import { isCmarkSpace } from './block/reference-definition.ts';
import { decodeEntity } from './entities.ts';
import { isAsciiPunctuation } from './html-tag.ts';

// Node 22 supports toWellFormed even though the project targets ES2023.
const normalizeInput = (text: string) => text.toWellFormed().replaceAll('\0', '\uFFFD');

const escapeHtml = (text: string) => text
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;');

// cmark decodes entities, trims the result, then removes backslash escapes.
// The entity table keeps only each value's first ASCII byte, which is enough:
// tokenizer states treat every non-ASCII character alike, and `&fjlig;` is the
// only value with more than one ASCII character.
const codeLanguage = (raw: string) => {
	let decoded = '';
	for (let index = 0; index < raw.length; index += 1) {
		const entity = raw.charCodeAt(index) === 38 ? decodeEntity(raw, index) : undefined;
		if (!entity) {
			decoded += raw[index];
			continue;
		}
		if (raw.charCodeAt(index + 1) === 35) {
			// These two code points are emitted as invalid UTF-8 by cmark.
			decoded += String.fromCodePoint(
				entity.code === 0xFF_FE || entity.code === 0xFF_FF ? 0xFF_FD : entity.code,
			);
		} else if (entity.code === -1) {
			decoded += '\uFFFD';
		} else if (raw.startsWith('fjlig;', index + 1)) {
			decoded += 'fj';
		} else {
			decoded += String.fromCharCode(entity.code) + (entity.bytes > 1 ? '\uFFFD' : '');
		}
		index = entity.end;
	}
	let start = 0;
	let end = decoded.length;
	while (start < end && isCmarkSpace(decoded.charCodeAt(start))) {
		start += 1;
	}
	while (end > start && isCmarkSpace(decoded.charCodeAt(end - 1))) {
		end -= 1;
	}
	let language = '';
	for (let index = start; index < end; index += 1) {
		let code = decoded.charCodeAt(index);
		if (code === 92 && isAsciiPunctuation(decoded.charCodeAt(index + 1))) {
			index += 1;
			code = decoded.charCodeAt(index);
		}
		if (isCmarkSpace(code)) {
			break;
		}
		language += decoded[index];
	}
	return language;
};

/** Renders the block markup that the HTML tokenizer sees, not source ranges. */
export const renderGeneratedBlock = (source: string, block: GeneratedBlock) => {
	if (block.type === 'thematicBreak') {
		return '<hr />\n';
	}
	const language = codeLanguage(normalizeInput(source.slice(block.infoStart, block.infoEnd)));
	const content: string[] = [];
	for (let index = 0; index < block.lines.length; index += 3) {
		const start = block.lines[index];
		const end = block.lines[index + 1];
		const spaces = block.lines[index + 2];
		content.push(' '.repeat(spaces), source.slice(start, end), '\n');
	}
	const opening = language ? `<pre lang="${escapeHtml(language)}"><code>` : '<pre><code>';
	return `${opening}${escapeHtml(normalizeInput(content.join('')))}</code></pre>\n`;
};

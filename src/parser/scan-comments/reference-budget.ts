import { lexBlocks } from './block/index.ts';
import { isCmarkSpace, normalizeLabel, utf8Length } from './block/reference-definition.ts';
import { decodeEntity } from './entities.ts';
import { isAsciiPunctuation } from './html-tag.ts';
import { lexInline } from './inline-lexer.ts';
import { joinText } from './text.ts';
import { createForwardSearch } from './utils/forward-search.ts';

/**
 * cmark-gfm charges each successful lookup against a document-wide cap:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/map.c#L95-L100
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/references.c#L35
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/blocks.c#L652-L659
 * The fast bound is the number of `]` characters times twice the largest raw
 * definition size in UTF-8 after NUL replacement. An entity grows by at most one byte.
 */

export type ReferenceDefinition = {
	destination: string;
	title: string;
};

const byteLength = (text: string, originalInput = false) => {
	let length = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		length += (code > 0 && code < 128) || (originalInput && code === 0)
			? 1
			: utf8Length(text, index);
	}
	return length;
};

const cleanSize = (text: string) => {
	if (!text.includes('&') && !text.includes('\\')) {
		return byteLength(text);
	}
	let size = 0;
	let backslash = false;
	for (let index = 0; index < text.length; index += 1) {
		let code = text.charCodeAt(index);
		let bytes = utf8Length(text, index);
		if (code === 38) {
			const entity = decodeEntity(text, index);
			if (entity) {
				// The first decoded byte can complete a backslash escape, as `=` does in `\&bne;`.
				code = entity.code;
				bytes = entity.bytes;
				index = entity.end;
			}
		}
		if (backslash && isAsciiPunctuation(code)) {
			size -= 1;
			backslash = false;
		} else {
			backslash = code === 92;
		}
		size += bytes;
	}
	return size;
};

const definitionSize = ({ destination: rawDestination, title }: ReferenceDefinition) => {
	const destination = rawDestination.startsWith('<') ? rawDestination.slice(1, -1) : rawDestination;
	let first = 0;
	let last = destination.length;
	while (first < last && isCmarkSpace(destination.charCodeAt(first))) {
		first += 1;
	}
	while (last > first && isCmarkSpace(destination.charCodeAt(last - 1))) {
		last -= 1;
	}
	return cleanSize(destination.slice(first, last)) + cleanSize(title.slice(1, -1));
};

/** Returns failed lookup ordinals by block start, or undefined when the bound fits. */
/**
 * `replayParagraphs` matches the replay rule in index.ts: with element tracking,
 * paragraphs are replayed even without `<`.
 */
export const createReferenceBudget = (
	source: string,
	labels: Map<string, ReferenceDefinition>,
	replayParagraphs: boolean,
) => {
	let maxSize = 0;
	for (const { destination, title } of labels.values()) {
		maxSize = Math.max(maxSize, 2 * (byteLength(destination) + byteLength(title)));
	}
	let brackets = 0;
	let bracketPosition = -1;
	while (true) {
		bracketPosition = source.indexOf(']', bracketPosition + 1);
		if (bracketPosition === -1) {
			break;
		}
		brackets += 1;
	}
	if (brackets * maxSize <= 100_000) {
		return undefined;
	}
	// cmark counts original input bytes, before replacing NUL with U+FFFD.
	const cap = Math.max(byteLength(source, true), 100_000);
	if (brackets * maxSize <= cap) {
		return undefined;
	}

	const failures = new Map<number, Set<number>>();
	const sizes = new Map<string, number>();
	let used = 0;
	const findLeft = createForwardSearch(source, '[');
	const findRight = createForwardSearch(source, ']');
	const findTagOpen = createForwardSearch(source, '<');
	lexBlocks(source, {
		html: () => {},
		text: (segments, _continuation, unescapePipes, type) => {
			if (!segments.length) {
				return;
			}
			const start = segments[0];
			const end = segments.at(-1)!;
			const left = findLeft(start);
			const right = findRight(start);
			if (left === -1 || left >= end || right === -1 || right >= end) {
				return;
			}
			const open = findTagOpen(start);
			const replayed = (open !== -1 && open < end) || (replayParagraphs && type === 'paragraph');
			let ordinal = 0;
			lexInline(joinText(source, segments, undefined, unescapePipes), () => {}, (label) => {
				const current = ordinal;
				ordinal += 1;
				const normalized = normalizeLabel(label);
				const entry = labels.get(normalized);
				if (!entry) {
					return false;
				}
				let size = sizes.get(normalized);
				if (size === undefined) {
					size = definitionSize(entry);
					sizes.set(normalized, size);
				}
				if (size > cap - used) {
					if (replayed) {
						let block = failures.get(start);
						if (!block) {
							block = new Set();
							failures.set(start, block);
						}
						block.add(current);
					}
					return false;
				}
				used += size;
				return true;
			});
		},
	});
	return failures;
};

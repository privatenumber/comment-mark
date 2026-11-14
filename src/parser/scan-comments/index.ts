import { lexBlocks, type BlockHandlers } from './block/index.ts';
import { normalizeLabel } from './block/reference-definition.ts';
import { createHtmlTokenizer } from './html-tokenizer.ts';
import { lexInline } from './inline-lexer.ts';
import { createReferenceBudget, type ReferenceDefinition } from './reference-budget.ts';
import { joinText } from './text.ts';
import { createForwardSearch } from './utils/forward-search.ts';

/**
 * Receives each HTML comment that closes with `-->`, in document order: the
 * index of its `<!--`, the start and end of its inner text, the container
 * prefix of its line, such as `> ` in a blockquote, and whether it starts its
 * line in an HTML block or follows a comment that does.
 */
export type CommentVisitor = (
	start: number,
	innerStart: number,
	innerEnd: number,
	continuation: string,
	startsLine: boolean,
) => void;

/**
 * Finds the HTML comments that GitHub renders as comments, without building a
 * tree. It runs three phases over the source:
 *
 * 1. The block phase finds the leaf blocks: paragraphs, headings, table cells,
 *    HTML blocks, and code, which never holds a comment.
 * 2. The inline phase finds the raw HTML spans in the text of each paragraph,
 *    heading, and cell. Other text renders escaped and cannot hold a comment.
 * 3. The browser phase reads HTML blocks and raw HTML spans as a browser would
 *    and reports the comments.
 *
 * Each phase follows GitHub's renderer, cmark-gfm 0.29.0.gfm.13, and the HTML
 * standard. The rules each phase leaves out are listed in
 * notes/comment-mark/comment-scanning.md.
 */
export const scanComments = (source: string, visit: CommentVisitor) => {
	if (source.includes('<!--')) {
		scanDocument(source, visit);
	}
};

const scanDocument = (source: string, visit: CommentVisitor) => {
	const tokenizer = createHtmlTokenizer(source, visit);
	const findTagOpen = createForwardSearch(source, '<');
	const findOpenBracket = createForwardSearch(source, '[');
	const findCloseBracket = createForwardSearch(source, ']');
	const labels = new Map<string, ReferenceDefinition>();
	let failures: Map<number, Set<number>> | undefined;
	let activeFailures: Set<number> | undefined;
	let lookupOrdinal = 0;
	const isDefinedLabel = (label: string) => {
		const normalized = normalizeLabel(label);
		const failed = activeFailures?.has(lookupOrdinal);
		lookupOrdinal += 1;
		return !failed && normalized !== '' && labels.has(normalized);
	};

	const handlers: BlockHandlers = {
		html: (start, end, afterMarkup, continuation) => {
			tokenizer.feed(start, end, afterMarkup, continuation, true);
		},
		text: (segments, continuation) => {
			activeFailures = failures?.get(segments[0]);
			lookupOrdinal = 0;
			// The inline phase reads the lines joined by line feeds. `textStarts`
			// maps each line back to its source position.
			const textStarts: number[] = [];
			const text = joinText(source, segments, textStarts);

			let line = 0;
			// The block's opening tag, such as `<p>`, comes before its first span.
			// Text between spans renders escaped, so it holds no markup.
			let afterMarkup = true;
			lexInline(text, (start, end) => {
				while (textStarts[line] + segments[(line * 2) + 1] - segments[line * 2] < start) {
					line += 1;
				}
				// A span can cross lines. Each part is fed as one line of the chunk.
				for (let part = line; part < textStarts.length && textStarts[part] < end; part += 1) {
					const lineStart = segments[part * 2];
					const partStart = Math.max(start, textStarts[part]) - textStarts[part] + lineStart;
					const partEnd = Math.min(end - textStarts[part] + lineStart, segments[(part * 2) + 1]);
					tokenizer.feed(partStart, partEnd, afterMarkup, continuation, false);
					afterMarkup = false;
				}
			}, isDefinedLabel);
		},
	};
	// Each event uses three numbers: text uses -1 and an index into textSegments;
	// HTML uses start, end, and afterMarkup; adding 2 marks a run of lines.
	// The arrays retain source order.
	const positions: number[] = [];
	const continuations: string[] = [];
	const textSegments: number[][] = [];
	let buffering = false;
	lexBlocks(source, {
		text: (segments, continuation) => {
			// Raw HTML starts with `<`, so text without one renders as text and
			// needs no replay. A `<` between two segments only costs a needless
			// inline pass.
			if (segments.length === 0) {
				return;
			}
			const open = findTagOpen(segments[0]);
			if (open !== -1 && open < segments.at(-1)!) {
				if (!buffering) {
					const start = segments[0];
					const end = segments.at(-1)!;
					const left = findOpenBracket(start);
					const right = findCloseBracket(start);
					buffering = left !== -1 && left < end && right !== -1 && right < end;
				}
				if (buffering) {
					positions.push(-1, textSegments.length, 0);
					continuations.push(continuation);
					textSegments.push(segments);
				} else {
					handlers.text(segments, continuation);
				}
			}
		},
		html: (start, end, afterMarkup, continuation) => {
			if (buffering) {
				const last = positions.length - 3;
				const previousEnd = positions[last + 1];
				if (
					last >= 0 && positions[last] >= 0 && !afterMarkup
					&& continuations.at(-1) === continuation
					&& ((start - previousEnd === 1
						&& (source.charCodeAt(previousEnd) === 10 || source.charCodeAt(previousEnd) === 13))
						|| (start - previousEnd === 2 && source.startsWith('\r\n', previousEnd)))
				) {
					positions[last + 1] = end;
					if (positions[last + 2] < 2) {
						positions[last + 2] += 2;
					}
					return;
				}
				positions.push(start, end, Number(afterMarkup));
				continuations.push(continuation);
			} else {
				handlers.html(start, end, afterMarkup, continuation);
			}
		},
		definition: (label, destination, title) => {
			const normalized = normalizeLabel(label);
			if (normalized && !labels.has(normalized)) {
				labels.set(normalized, {
					destination,
					title,
				});
			}
		},
	});
	failures = createReferenceBudget(source, labels);
	const findLineFeed = createForwardSearch(source, '\n');
	const findCarriageReturn = createForwardSearch(source, '\r');
	for (let index = 0; index < continuations.length; index += 1) {
		const start = positions[index * 3];
		const end = positions[(index * 3) + 1];
		if (start === -1) {
			handlers.text(textSegments[end], continuations[index]);
		} else {
			const flags = positions[(index * 3) + 2];
			let lineStart = start;
			let afterMarkup = flags === 1 || flags === 3;
			if (flags >= 2) {
				while (lineStart < end) {
					const lf = findLineFeed(lineStart);
					const cr = findCarriageReturn(lineStart);
					const lineEnd = Math.min(lf === -1 ? end : lf, cr === -1 ? end : cr, end);
					if (lineEnd === end) {
						break;
					}
					handlers.html(lineStart, lineEnd, afterMarkup, continuations[index]);
					afterMarkup = false;
					lineStart = lineEnd + (source.startsWith('\r\n', lineEnd) ? 2 : 1);
				}
			}
			handlers.html(lineStart, end, afterMarkup, continuations[index]);
		}
	}
};

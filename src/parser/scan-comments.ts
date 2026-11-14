import { lexBlocks } from './block-lexer.ts';
import { createHtmlTokenizer } from './html-tokenizer.ts';
import { lexInline } from './inline-lexer.ts';
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
 * tree. It runs three phases in one pass over the source:
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
	const tokenizer = createHtmlTokenizer(source, visit);
	const findTagOpen = createForwardSearch(source, '<');

	lexBlocks(source, {
		html: (start, end, afterMarkup, continuation) => {
			tokenizer.feed(start, end, afterMarkup, continuation, true);
		},
		text: (segments, continuation) => {
			// Raw HTML starts with `<`, so text without one renders as text. A
			// `<` between two segments only costs a needless inline pass.
			if (segments.length === 0) {
				return;
			}
			const open = findTagOpen(segments[0]);
			if (open === -1 || open >= segments.at(-1)!) {
				return;
			}

			// The inline phase reads the lines joined by line feeds. `textStarts`
			// maps each line back to its source position.
			let text = '';
			const textStarts: number[] = [];
			for (let index = 0; index < segments.length; index += 2) {
				if (index > 0) {
					text += '\n';
				}
				textStarts.push(text.length);
				text += source.slice(segments[index], segments[index + 1]);
			}

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
			});
		},
	});
};

import { C as CommentMarkReplacement, a as CommentMarkData } from './document-Cfq1QhnK.mjs';

/**
 * Replaces marked sections in `input` and returns the updated source.
 *
 * Returns a promise, so a resolver can read a file or do other async work. All
 * selectors are validated before any resolver runs, and resolvers run in
 * document order.
 */
declare const commentMark: (input: string | Buffer, replacements: Record<string, CommentMarkReplacement>) => Promise<string>;
/**
 * Returns the first marker matching `selector`, or null.
 */
declare const getCommentMark: (input: string | Buffer, selector: string) => CommentMarkData | null;
/**
 * Returns every marker matching `selector` in document order. Without a
 * selector, returns every recognized marker.
 */
declare const getCommentMarkAll: (input: string | Buffer, selector?: string) => CommentMarkData[];

export { CommentMarkData, CommentMarkReplacement, commentMark, getCommentMark, getCommentMarkAll };

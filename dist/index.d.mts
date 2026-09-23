type CommentMarkData = {
    tagName: string;
    attributes: Record<string, string>;
    content: string;
};
type CommentMarkUpdate = {
    attributes?: Record<string, string> | undefined;
    content?: string | undefined;
};
type CommentMarkResolverResult = string | CommentMarkUpdate | null | undefined;
type CommentMarkResolver = (marker: CommentMarkData, index: number) => CommentMarkResolverResult | Promise<CommentMarkResolverResult>;
type CommentMarkStatic = string | CommentMarkUpdate | null | undefined;
type CommentMarkReplacement = CommentMarkResolver | CommentMarkStatic | readonly CommentMarkStatic[];

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

export { commentMark, getCommentMark, getCommentMarkAll };
export type { CommentMarkData };

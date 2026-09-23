type CommentMarkData = {
    tagName: string;
    attributes: Record<string, string>;
    content: string;
};
type CommentMarkUpdate = {
    attributes?: Record<string, string>;
    content?: string;
};
type CommentMarkResolver = (attributes: Record<string, string>, content: string) => string | CommentMarkUpdate | null | undefined;
type CommentMarkValue = string | CommentMarkResolver | null | undefined;
type CommentMarkReplacement = CommentMarkValue | readonly CommentMarkValue[];

/**
 * Replaces marked sections in `input` and returns the updated source.
 */
declare const commentMark: (input: string | Buffer, replacements: Record<string, CommentMarkReplacement>) => string;
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

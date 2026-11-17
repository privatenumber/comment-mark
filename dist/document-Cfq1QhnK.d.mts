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

export type { CommentMarkReplacement as C, CommentMarkData as a };

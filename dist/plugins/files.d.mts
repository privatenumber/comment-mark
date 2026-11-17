import { CommentMarkReplacement } from '../index.mjs';

type FilesOptions = {
    baseDirectory: string;
    tagName?: string;
};
/**
 * Fills markers with the contents of the files their `path` attribute names.
 *
 * Returns replacements keyed by `tagName`, so it composes with other
 * replacements:
 *
 *     commentMark(markdown, { ...files({ baseDirectory }), version: '2.0.0' })
 *
 * Each `path` is resolved against `baseDirectory`, and the file is read as
 * UTF-8 and returned unchanged, so it gets the same layout as any other
 * content. Included markers are not expanded. An update is rejected if the
 * included text would change the document's markers.
 */
declare const files: ({ baseDirectory, tagName, }: FilesOptions) => Record<string, CommentMarkReplacement>;

export { files };
export type { FilesOptions };

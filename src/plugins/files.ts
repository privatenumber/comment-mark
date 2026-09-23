import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommentMarkReplacement } from '../index.ts';

export type FilesOptions = {
	// Every `path` attribute is resolved against this directory.
	baseDirectory: string;
	// The tag name of the markers to fill. Defaults to `file`.
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
 * UTF-8 and inserted verbatim. The included text is not parsed again, so a
 * marker written inside an included file stays literal text.
 */
export const files = ({
	baseDirectory,
	tagName = 'file',
}: FilesOptions): Record<string, CommentMarkReplacement> => {
	if (typeof baseDirectory !== 'string' || baseDirectory === '') {
		throw new Error('[comment-mark] files() requires a baseDirectory');
	}

	return {
		[tagName]: async ({ attributes }) => {
			const filePath = attributes.path;
			if (filePath === undefined) {
				throw new Error(`[comment-mark] The ${JSON.stringify(tagName)} marker has no "path" attribute`);
			}

			try {
				return await readFile(path.resolve(baseDirectory, filePath), 'utf8');
			} catch (error) {
				// Any read failure, such as a missing file or a directory, is
				// reported against the marker that named it.
				throw new Error(
					`[comment-mark] Cannot read ${JSON.stringify(filePath)} for the ${JSON.stringify(tagName)} marker`,
					{ cause: error },
				);
			}
		},
	};
};

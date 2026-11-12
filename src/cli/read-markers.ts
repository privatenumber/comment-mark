import { readFile } from 'node:fs/promises';
import { getCommentMarkAll } from '../index.ts';
import { CliError } from './cli-error.ts';

/**
 * Prints every marker in the file as JSON. Node keeps the process alive until
 * the write drains, so waiting for it here is only for its result.
 */
export const readMarkers = async (filePath: string) => {
	const content = await readFile(filePath, 'utf8');
	const markers = getCommentMarkAll(content);

	// The callback reports write failures; the listener prevents the matching
	// 'error' event from crashing the process.
	process.stdout.once('error', () => {});
	const error = await new Promise<NodeJS.ErrnoException | null | undefined>((resolve) => {
		process.stdout.write(`${JSON.stringify(markers, null, '\t')}\n`, resolve);
	});

	// A reader that closes early is a normal exit: EPIPE for a pipe such as
	// `| head`, or ENOTCONN when a parent process connects stdio with a socket.
	if (error && error.code !== 'EPIPE' && error.code !== 'ENOTCONN') {
		throw new CliError(error.message);
	}
};

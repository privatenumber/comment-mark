/**
 * A usage or I/O error the CLI reports as `Error: <message>` without a stack,
 * because the message is the whole explanation.
 */
export class CliError extends Error {
	name = 'CliError';
}

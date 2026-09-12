import { fileURLToPath } from 'node:url';
import spawn from 'nano-spawn';

const cliPath = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url));

export const commentMarkCli = (...args: string[]) => spawn(process.execPath, [
	cliPath,
	...args,
]);

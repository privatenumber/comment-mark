import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { description, name, version } from '../package.json' with { type: 'json' };
import { commentMark } from './index.js';

const exitWithError = (message: string): never => {
	console.error(`Error: ${message}`);
	process.exit(1);
};

const argv = cli({
	name,
	version,
	parameters: ['<file>'],
	help: {
		description,
		usage: `${name} <file> [--<marker>=<value>...]`,
		examples: [
			`${name} README.md --last-updated="$(date -Iseconds)"`,
			`${name} README.md --contributors="$(git shortlog -se HEAD -- .)"`,
		],
	},
});

const data: Record<string, string> = {};

for (const [marker, values] of Object.entries(argv.unknownFlags)) {
	const value = values.at(-1);
	if (typeof value === 'string') {
		data[marker] = value;
	} else {
		exitWithError(`No value provided for flag "--${marker}" (expected --${marker}=<value>)`);
	}
}

if (Object.keys(data).length === 0) {
	exitWithError('No marker flags provided. Pass --<marker>=<value> flags to update sections (see --help)');
}

const output = commentMark(await readFile(argv._.file, 'utf8'), data);
await writeFile(argv._.file, output);

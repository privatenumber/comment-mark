import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cli } from 'cleye';
import { commentMark } from './index.js';

const require = createRequire(import.meta.url);

const { name, description, version } = require('../package.json') as {
	name: string;
	description: string;
	version: string;
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
	if (typeof value !== 'string') {
		throw new TypeError(`No value provided for flag "--${marker}" (expected --${marker}=<value>)`);
	}

	data[marker] = value;
}

const output = commentMark(await readFile(argv._.file, 'utf8'), data);

// Only rewrite the file when at least one marker key was provided so accidental
// flagless invocations don't touch the file.
if (Object.keys(data).length > 0) {
	await writeFile(argv._.file, output);
} else {
	process.stdout.write(output);
}

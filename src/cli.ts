import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { commentMark } from './index.js';

const argv = cli({
	name: 'comment-mark',
	parameters: ['<file>'],
	help: {
		description: 'Update marked sections in a Markdown file with arbitrary values.',
		usage: 'comment-mark <file> [--<marker>=<value>...]',
		examples: [
			'comment-mark README.md --last-updated="$(date -Iseconds)"',
			'comment-mark README.md --contributors="$(git shortlog -se HEAD -- .)"',
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

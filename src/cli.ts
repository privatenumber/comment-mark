import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { description, name, version } from '../package.json' with { type: 'json' };
import { commentMark, getCommentMarks } from './index.js';

const exitWithError = (message: string): never => {
	console.error(`Error: ${message}`);
	process.exit(1);
};

const helpOptions = {
	description,
	usage: `${name} <file> [--<marker>=<value>...]`,
	examples: [
		`${name} README.md --last-updated="$(date -Iseconds)"`,
		`${name} README.md --contributors="$(git shortlog -se HEAD -- .)"`,
	],
};

const argv = cli({
	name,

	// Keep `[file]` optional: a required `<file>` aborts inside cli() with
	// "Missing required parameter" before the manual `--help`/`--version`
	// handlers below can run. The requirement is enforced after those flags.
	parameters: ['[file]'],

	// Markers accept arbitrary names, so a marker can be named `help`. cleye's
	// default Boolean `help` flag (alias `-h`) would consume `--help=<value>`
	// and print help instead, so it's disabled; bare flags are handled below.
	help: false,
});

const { unknownFlags, showHelp } = argv;

const isBareFlag = (flagName: string) => {
	const values = unknownFlags[flagName];
	return values?.length === 1 && values[0] === true;
};

// Handle control flags manually so only the bare form reserves the action
// (cleye convention); `--help=<value>`/`--version=<value>` stay as markers.
if (isBareFlag('help') || isBareFlag('h')) {
	showHelp(helpOptions);
	process.exit(0);
}

if (isBareFlag('version')) {
	console.log(version);
	process.exit(0);
}

const filePath = argv._.file;

// Inline exit (rather than the exitWithError helper) so TypeScript's control
// flow analysis narrows `filePath` to a string below.
if (!filePath) {
	console.error('Error: Missing required parameter "<file>"');
	process.exit(1);
}

if (argv._.length > 1) {
	exitWithError(`Unexpected extra arguments: ${argv._.slice(1).join(', ')}`);
}

const data: Record<string, string> = {};

for (const [marker, values] of Object.entries(unknownFlags)) {
	if (values.length > 1) {
		exitWithError(`Flag "--${marker}" was specified ${values.length} times; each marker can only be set once`);
	}

	const value = values[0];
	if (typeof value === 'string') {
		data[marker] = value;
	} else {
		exitWithError(`No value provided for flag "--${marker}" (expected --${marker}=<value>)`);
	}
}

// Get mode: no marker flags prints detected values as JSON.
if (Object.keys(data).length === 0) {
	const content = await readFile(filePath, 'utf8');
	process.stdout.write(`${JSON.stringify(getCommentMarks(content), null, '\t')}\n`);
	process.exit(0);
}

// Setter mode: validate the whole document and classify every requested key
// before writing, so a malformed marker never leaves partial edits behind.
const original = await readFile(filePath, 'utf8');

let output: string | Buffer;
let detected: Record<string, string>;
try {
	output = commentMark(original, data);
	detected = getCommentMarks(original);
} catch (error) {
	if (error instanceof Error) {
		exitWithError(error.message);
	}

	throw error;
}

// The library silently skips keys with no matching marker; detect them so
// typos surface instead of succeeding quietly.
const updated: string[] = [];
const unchanged: string[] = [];
const missing: string[] = [];

for (const [marker, value] of Object.entries(data)) {
	if (!Object.hasOwn(detected, marker)) {
		missing.push(marker);
		continue;
	}

	// Compare against a solo application so each key is classified by its own
	// effect, independent of the other keys' replacements.
	const soloOutput = commentMark(original, { [marker]: value });
	if (soloOutput === original) {
		unchanged.push(marker);
	} else {
		updated.push(marker);
	}
}

const report = () => {
	if (updated.length > 0) {
		console.error(`Updated: ${updated.join(', ')}`);
	}
	if (unchanged.length > 0) {
		console.error(`Unchanged: ${unchanged.join(', ')}`);
	}
	if (missing.length > 0) {
		console.error(`Missing: ${missing.join(', ')}`);
	}
};

if (missing.length === Object.keys(data).length) {
	report();
	exitWithError(`No matching markers found for any of the ${missing.length} requested keys`);
}

if (updated.length === 0) {
	console.error(`${filePath} is unchanged. All ${Object.keys(data).length} requested values already match.`);
	process.exit(0);
}

await writeFile(filePath, output);

report();

const summary = [
	unchanged.length > 0 && `${unchanged.length} unchanged`,
	missing.length > 0 && `${missing.length} missing`,
].filter(Boolean).join('; ');

console.error(`Saved ${filePath}. Updated ${updated.length} key${updated.length === 1 ? '' : 's'}${summary ? `; ${summary}` : ''}.`);

if (missing.length > 0) {
	process.exitCode = 1;
}

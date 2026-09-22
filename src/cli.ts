import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { description, name, version } from '../package.json' with { type: 'json' };
import {
	commentMark, getCommentMark, getCommentMarkAll,
} from './index.js';

const exitWithError = (message: string): never => {
	console.error(`Error: ${message}`);
	process.exit(1);
};

const helpOptions = {
	description,
	usage: `${name} <file> [--<selector>=<value>...]`,
	examples: [
		`${name} README.md --lastUpdated="$(date -Iseconds)"`,
		`${name} README.md --"contributors[role='maintainer']"="$(git shortlog -se HEAD -- .)"`,
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

const { showHelp } = argv;

// Null-prototype so selectors never collide with inherited properties.
const data: Record<string, string> = Object.create(null);

// cleye splits `--name=value` at the first `=`, which a selector such as
// `item[kind='fruit']` also contains, so the marker flags are read from argv
// and split at the first `=` that is outside brackets and quotes.
const findFlagSeparator = (flag: string) => {
	let depth = 0;
	let quote = '';

	for (let index = 0; index < flag.length; index += 1) {
		const character = flag[index];

		if (quote !== '') {
			if (character === quote) {
				quote = '';
			}
			continue;
		}

		switch (character) {
			case '"':
			case "'": {
				quote = character;
				break;
			}
			case '[': {
				depth += 1;
				break;
			}
			case ']': {
				depth -= 1;
				break;
			}
			case '=': {
				if (depth === 0) {
					return index;
				}
				break;
			}
			default: {
				break;
			}
		}
	}

	return -1;
};

const flagCounts = new Map<string, number>();
const bareFlags = new Set<string>();

for (const argument of process.argv.slice(2)) {
	// `--` ends flag parsing, so the rest of the line is positional.
	if (argument === '--') {
		break;
	}

	// A positional file or extra argument; cleye reports these through `_`.
	if (!argument.startsWith('-') || argument === '-') {
		continue;
	}

	// `-h` is the only short flag. Other single-dash arguments would be split
	// into short flags by cleye and the intended selector would disappear, so
	// they are rejected instead of silently turning the run into read mode.
	if (argument === '-h') {
		// `-h` is an alias of `--help`, so it shares the flag's count.
		flagCounts.set('help', (flagCounts.get('help') ?? 0) + 1);
		bareFlags.add('help');
		continue;
	}
	if (!argument.startsWith('--')) {
		exitWithError(`Unknown flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
	}

	const flag = argument.slice(2);
	const separator = findFlagSeparator(flag);
	const selector = separator === -1 ? flag : flag.slice(0, separator);

	// A bare control flag reserves the action (cleye convention);
	// `--help=<value>`/`--version=<value>` stay as markers. Repeating one is
	// rejected like any other flag instead of quietly changing the action.
	if (separator === -1 && (selector === 'help' || selector === 'version')) {
		flagCounts.set(selector, (flagCounts.get(selector) ?? 0) + 1);
		bareFlags.add(selector);
		continue;
	}

	if (selector === '') {
		exitWithError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
	}

	flagCounts.set(selector, (flagCounts.get(selector) ?? 0) + 1);

	if (separator === -1) {
		exitWithError(`No value provided for flag "--${selector}" (expected --${selector}=<value>)`);
	}
	data[selector] = flag.slice(separator + 1);
}

// Reject duplicates before acting on a control flag, so the outcome does not
// depend on argument order.
for (const [selector, count] of flagCounts) {
	if (count > 1) {
		exitWithError(`Flag "--${selector}" was specified ${count} times; each flag can only be set once`);
	}
}

// Handle control flags before requiring a file, so `--help` and `--version`
// work on their own.
if (bareFlags.has('help')) {
	showHelp(helpOptions);
	process.exit(0);
}

if (bareFlags.has('version')) {
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

// Read mode: no selector flags prints every detected marker as JSON.
if (Object.keys(data).length === 0) {
	const content = await readFile(filePath, 'utf8');
	process.stdout.write(`${JSON.stringify(getCommentMarkAll(content), null, '\t')}\n`);
	process.exit(0);
}

// Setter mode: validate the whole document and classify every requested
// selector before writing, so a malformed marker never leaves partial edits
// behind.
const original = await readFile(filePath, 'utf8');

// Translate a library failure into the CLI's exit, so the error message is the
// one comment-mark reports rather than a stack trace.
const applyToSource = (source: string) => {
	try {
		return commentMark(source, data);
	} catch (error) {
		if (error instanceof Error) {
			exitWithError(error.message);
		}

		throw error;
	}
};

const updatedSource = applyToSource(original);

// The library silently skips selectors with no matching marker; detect them so
// typos surface instead of succeeding quietly.
const updated: string[] = [];
const unchanged: string[] = [];
const missing: string[] = [];

for (const [selector, value] of Object.entries(data)) {
	if (getCommentMark(original, selector) === null) {
		missing.push(selector);
		continue;
	}

	// Compare against a solo application so each selector is classified by its
	// own effect, independent of the other selectors' replacements.
	const soloOutput = commentMark(original, { [selector]: value });
	if (soloOutput === original) {
		unchanged.push(selector);
	} else {
		updated.push(selector);
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
	exitWithError(`No matching markers found for any of the ${missing.length} requested selectors`);
}

if (updated.length === 0) {
	report();
	// Missing selectors still fail here; only an all-unchanged request exits 0.
	if (missing.length > 0) {
		process.exit(1);
	}
	console.error(`${filePath} is unchanged. All ${Object.keys(data).length} requested values already match.`);
	process.exit(0);
}

await writeFile(filePath, updatedSource);

report();

const summary = [
	unchanged.length > 0 && `${unchanged.length} unchanged`,
	missing.length > 0 && `${missing.length} missing`,
].filter(Boolean).join('; ');

console.error(`Saved ${filePath}. Updated ${updated.length} selector${updated.length === 1 ? '' : 's'}${summary ? `; ${summary}` : ''}.`);

if (missing.length > 0) {
	process.exitCode = 1;
}

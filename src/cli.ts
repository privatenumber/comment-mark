import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { description, name, version } from '../package.json' with { type: 'json' };
import {
	type CommentMarkData,
	commentMark, getCommentMark, getCommentMarkAll,
} from './index.ts';
import { encodeAttributeValue, isAttributeName } from './parser/parse-attributes.ts';

// The replacement map the library accepts. A content update uses a plain
// string; an attribute update needs a resolver instead.
type Replacements = Parameters<typeof commentMark>[1];

// One selector's requested changes. `content` stays undefined when no content
// flag was given, so `--item=` still sets an empty section.
type SelectorUpdate = {
	content: string | undefined;
	attributes: Map<string, string>;
};

const exitWithError = (message: string): never => {
	console.error(`Error: ${message}`);
	process.exit(1);
};

// Translate a library failure into the CLI's exit, so the error message is the
// one comment-mark reports rather than a stack trace.
const fromLibrary = async <T>(call: () => T | Promise<T>): Promise<T> => {
	try {
		return await call();
	} catch (error) {
		if (error instanceof Error) {
			exitWithError(error.message);
		}

		throw error;
	}
};

const helpOptions = {
	description,
	usage: `${name} <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]`,
	examples: [
		`${name} README.md --lastUpdated="$(date -Iseconds)"`,
		`${name} README.md --item.status="archived"`,
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

// Grouped by selector so several flags can address the same marker: one
// content flag and any number of distinct attribute flags.
const updates = new Map<string, SelectorUpdate>();

// cleye splits `--name=value` at the first `=`, which a selector such as
// `item[kind='fruit']` also contains, so flags are read from argv and split at
// the first `=` that is outside brackets and quotes. The same scan finds the
// `.` that separates an attribute name from its selector.
const findSeparator = (text: string, delimiter: string) => {
	let inPredicate = false;
	let quote = '';

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];

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
				// Predicates do not nest, so a `[` inside one is a literal part
				// of its value rather than another level.
				inPredicate = true;
				break;
			}
			case ']': {
				inPredicate = false;
				break;
			}
			default: {
				if (character === delimiter && !inPredicate) {
					return index;
				}
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
	const separator = findSeparator(flag, '=');
	const target = separator === -1 ? flag : flag.slice(0, separator);

	// A bare control flag reserves the action (cleye convention);
	// `--help=<value>`/`--version=<value>` stay as markers. Repeating one is
	// rejected like any other flag instead of quietly changing the action.
	if (separator === -1 && (target === 'help' || target === 'version')) {
		flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);
		bareFlags.add(target);
		continue;
	}

	// A target is `<selector>` or `<selector>.<attribute>`. The suffix is CLI
	// update syntax, so a dot inside a selector's brackets or quotes (an
	// attribute predicate value such as `file='package.json'`) stays with the
	// selector.
	const attributeSeparator = findSeparator(target, '.');
	const selector = attributeSeparator === -1 ? target : target.slice(0, attributeSeparator);
	const attribute = attributeSeparator === -1 ? undefined : target.slice(attributeSeparator + 1);

	if (selector === '') {
		exitWithError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value> or --<selector>.<attribute>=<value>)`);
	}
	if (attribute !== undefined && !isAttributeName(attribute)) {
		exitWithError(`Invalid attribute name in flag ${JSON.stringify(argument)} (expected --<selector>.<attribute>=<value>)`);
	}

	flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);

	if (separator === -1) {
		exitWithError(`No value provided for flag "--${target}" (expected --${target}=<value>)`);
	}

	const value = flag.slice(separator + 1);

	if (attribute !== undefined) {
		// The writer validates values while rewriting a marker, but only when the
		// selector matches. Validate here too, so an unwritable value always
		// aborts instead of being skipped along with a missing selector.
		await fromLibrary(() => encodeAttributeValue(value, undefined));
	}

	let update = updates.get(selector);
	if (!update) {
		update = {
			content: undefined,
			attributes: new Map(),
		};
		updates.set(selector, update);
	}

	if (attribute === undefined) {
		update.content = value;
	} else {
		update.attributes.set(attribute, value);
	}
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
if (updates.size === 0) {
	const content = await readFile(filePath, 'utf8');
	process.stdout.write(`${JSON.stringify(getCommentMarkAll(content), null, '\t')}\n`);
	process.exit(0);
}

// Setter mode: classify every requested selector before writing, so the report
// and the exit code reflect each one and a malformed marker never leaves
// partial edits behind.
const original = await readFile(filePath, 'utf8');

// A content-only update stays a plain string so the library keeps the CLI's
// multiline padding. An attribute update needs a resolver that returns the
// complete attribute set: the requested changes over the attributes the marker
// already had, so the others are preserved.
const buildReplacement = ({ content, attributes }: SelectorUpdate) => {
	if (attributes.size === 0) {
		return content;
	}

	// A resolver's return value is inserted verbatim, so the CLI applies its
	// static multiline padding here instead. `undefined` leaves the content
	// unchanged.
	const requestedContent = content !== undefined && content.includes('\n') ? `\n${content}\n` : content;

	// Spread preserves an own `__proto__` data property, so an attribute with
	// that name survives as data instead of hitting the prototype setter.
	const requestedAttributes = Object.fromEntries(attributes);

	// A resolver runs for every match, but the CLI updates only the first
	// matching section. An array of one entry keeps that behavior.
	return [({ attributes: current }: CommentMarkData) => ({
		attributes: {
			...current,
			...requestedAttributes,
		},
		content: requestedContent,
	})];
};

const updated: string[] = [];
const unchanged: string[] = [];
const missing: string[] = [];

// The library rejects a selector that matches nothing, so only matched
// selectors are passed to the combined update; a missing selector is reported
// while the others are still saved.
const matched: Replacements = Object.create(null);

for (const [selector, update] of updates) {
	const marker = await fromLibrary(() => getCommentMark(original, selector));
	if (marker === null) {
		missing.push(selector);
		continue;
	}

	const replacement = buildReplacement(update);
	matched[selector] = replacement;

	// A solo application classifies the selector by its own effect, independent
	// of the other selectors' replacements.
	const applied = await fromLibrary(() => commentMark(original, { [selector]: replacement }));
	if (applied === original) {
		unchanged.push(selector);
	} else {
		updated.push(selector);
	}
}

const updatedSource = await fromLibrary(() => commentMark(original, matched));

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

if (missing.length === updates.size) {
	report();
	exitWithError(`No matching markers found for any of the ${missing.length} requested selectors`);
}

if (updated.length === 0) {
	report();
	// Missing selectors still fail here; only an all-unchanged request exits 0.
	if (missing.length > 0) {
		process.exit(1);
	}
	console.error(`${filePath} is unchanged. All ${updates.size} requested selectors already match.`);
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

import { cli } from 'cleye';
import packageJson from '../../package.json' with { type: 'json' };
import { encodeAttributeValue, isAttributeName } from '../parser/parse-attributes.ts';
import { CliError } from './cli-error.ts';

const { description, name } = packageJson;

// One selector's requested changes. `content` stays undefined when no content
// flag was given, so `--item=` still sets an empty section.
export type SelectorUpdate = {
	content: string | undefined;
	attributes: Map<string, string>;
};

export type Command = {
	type: 'help';
	showHelp: () => void;
} | {
	type: 'version';
} | {
	type: 'read';
	filePath: string;
} | {
	type: 'update';
	filePath: string;
	updates: Map<string, SelectorUpdate>;
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

/**
 * Turns the CLI arguments into the command to run. Throws `CliError` for
 * arguments that do not form a valid command, before any file is read.
 */
export const parseArguments = (argv: string[]): Command => {
	const parsed = cli({
		name,

		// Keep `[file]` optional: a required `<file>` aborts inside cli() with
		// "Missing required parameter" before the `--help`/`--version` checks
		// below can run. The requirement is enforced after those flags.
		parameters: ['[file]'],

		// Markers accept arbitrary names, so a marker can be named `help`. cleye's
		// default Boolean `help` flag (alias `-h`) would consume `--help=<value>`
		// and print help instead, so it's disabled; bare flags are handled below.
		help: false,
	}, undefined, argv);

	// Grouped by selector so several flags can address the same marker: one
	// content flag and any number of distinct attribute flags.
	const updates = new Map<string, SelectorUpdate>();
	const flagCounts = new Map<string, number>();
	const bareFlags = new Set<string>();

	for (const argument of argv) {
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
			throw new CliError(`Unknown flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
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
			throw new CliError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value> or --<selector>.<attribute>=<value>)`);
		}
		if (attribute !== undefined && !isAttributeName(attribute)) {
			throw new CliError(`Invalid attribute name in flag ${JSON.stringify(argument)} (expected --<selector>.<attribute>=<value>)`);
		}

		flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);

		if (separator === -1) {
			throw new CliError(`No value provided for flag "--${target}" (expected --${target}=<value>)`);
		}

		const value = flag.slice(separator + 1);

		if (attribute !== undefined) {
			// The writer validates values while rewriting a marker, but only when the
			// selector matches. Validate here too, so an unwritable value always
			// aborts instead of being skipped along with a missing selector.
			encodeAttributeValue(value, undefined);
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
			throw new CliError(`Flag "--${selector}" was specified ${count} times; each flag can only be set once`);
		}
	}

	// Control flags come before the file requirement, so `--help` and
	// `--version` work on their own.
	if (bareFlags.has('help')) {
		return {
			type: 'help',
			showHelp: () => parsed.showHelp(helpOptions),
		};
	}

	if (bareFlags.has('version')) {
		return { type: 'version' };
	}

	const filePath = parsed._.file;

	if (!filePath) {
		throw new CliError('Missing required parameter "<file>"');
	}

	if (parsed._.length > 1) {
		throw new CliError(`Unexpected extra arguments: ${parsed._.slice(1).join(', ')}`);
	}

	if (updates.size === 0) {
		return {
			type: 'read',
			filePath,
		};
	}

	return {
		type: 'update',
		filePath,
		updates,
	};
};

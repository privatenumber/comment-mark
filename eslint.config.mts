import { defineConfig, pvtnbr } from 'lintroll';

// `src/` parses by character index instead of with regular expressions.
//
// Overlapping patterns and the scan position a global or sticky regex carries
// made the parser hard to reason about: a nested parse could rewind an outer
// one, and pattern-based block rules hid the order the scanner reads in. An
// explicit scan keeps that order and its state visible, which the Markdown
// context, paired tags, and formatting-preserving edits all depend on.
// Performance is not a reason to reintroduce patterns: if an index-based scan
// is too slow, make that scan faster.
//
// `tests/index.ts` walks the syntax tree of every file under `src/` as a second
// guard, so the ban holds even when this config does not load. Both guards
// cover `src/` only; tests may still use regular expressions in assertions.
//
// Keep this config as `.mts`: lintroll loads it through tsx, and a `.ts` config
// fails to import the lintroll plugin graph in this CommonJS package.
const scanByIndex = 'Scan by character index with parse-local state.';

export default defineConfig([
	...pvtnbr(),
	{
		files: ['src/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'Literal[regex]',
					message: `A regular expression literal is not allowed in src/. ${scanByIndex}`,
				},
				{
					selector: 'CallExpression[callee.name="RegExp"], NewExpression[callee.name="RegExp"]',
					message: `Constructing a RegExp is not allowed in src/. ${scanByIndex}`,
				},
				{
					selector: 'MemberExpression[property.name="match"]',
					message: `String#match coerces its argument to a regular expression. ${scanByIndex}`,
				},
				{
					selector: 'MemberExpression[property.name="matchAll"]',
					message: `String#matchAll coerces its argument to a regular expression. ${scanByIndex}`,
				},
				{
					selector: 'MemberExpression[property.name="search"]',
					message: `String#search coerces its argument to a regular expression. ${scanByIndex}`,
				},
			],
		},
	},
]);

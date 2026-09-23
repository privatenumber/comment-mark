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
// These rules cover `src/` only; tests may still use regular expressions in
// assertions. `pnpm lint` runs in CI, so a config that fails to load fails the
// build instead of silently dropping the ban.
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

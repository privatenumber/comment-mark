import { defineConfig, pvtnbr } from 'lintroll';

// `src/` is scanned by character index. A regular expression carries its own
// scan position, so sharing one across parses let an inner parse rewind an
// outer one, and pattern-based block rules hid the order the scanner reads in.
// `tests/index.ts` walks the syntax tree as a second guard that does not depend
// on this config loading.
export default defineConfig([
	...pvtnbr(),
	{
		files: ['src/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'Literal[regex]',
					message: 'Regular expressions are banned in src/.',
				},
				{
					selector: 'CallExpression[callee.name="RegExp"], NewExpression[callee.name="RegExp"]',
					message: 'RegExp is banned in src/.',
				},
				{
					selector: 'MemberExpression[property.name="match"]',
					message: 'String#match is banned in src/.',
				},
				{
					selector: 'MemberExpression[property.name="matchAll"]',
					message: 'String#matchAll is banned in src/.',
				},
				{
					selector: 'MemberExpression[property.name="search"]',
					message: 'String#search is banned in src/.',
				},
			],
		},
	},
]);

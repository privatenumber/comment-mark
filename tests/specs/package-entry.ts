import path from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';

const packageRoot = path.resolve(import.meta.dirname, '../..');

const marker = '<!-- item kind="fruit" -->apple<!-- /item -->';
const updatedMarker = '<!-- item kind="vegetable" -->carrot<!-- /item -->';

describe('package entry', () => {
	test('loads the package through import', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify({
				name: 'consumer',
				type: 'module',
			}),
			'node_modules/comment-mark': ({ symlink }) => symlink(packageRoot),
			'main.js': `import { commentMark, getCommentMark, getCommentMarkAll } from 'comment-mark';

if (getCommentMarkAll(${JSON.stringify(marker)}).length !== 1) {
	throw new Error('getCommentMarkAll did not read the marker');
}

process.stdout.write(await commentMark(${JSON.stringify(marker)}, {
	item: { attributes: { kind: 'vegetable' }, content: 'carrot' },
}));
`,
		});

		const { stdout } = await spawn(process.execPath, ['main.js'], { cwd: fixture.path });

		expect(stdout).toBe(updatedMarker);
	});

	test('loads the package through require', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify({
				name: 'consumer',
				type: 'commonjs',
			}),
			'node_modules/comment-mark': ({ symlink }) => symlink(packageRoot),
			'main.js': `const { commentMark, getCommentMark, getCommentMarkAll } = require('comment-mark');

if (getCommentMark(${JSON.stringify(marker)}, 'item').content !== 'apple') {
	throw new Error('getCommentMark did not read the marker');
}
if (getCommentMarkAll(${JSON.stringify(marker)}).length !== 1) {
	throw new Error('getCommentMarkAll did not read the marker');
}

commentMark(${JSON.stringify(marker)}, {
	item: { attributes: { kind: 'vegetable' }, content: 'carrot' },
}).then(
	output => process.stdout.write(output),
	error => {
		console.error(error);
		process.exit(1);
	},
);
`,
		});

		const { stdout } = await spawn(process.execPath, ['main.js'], { cwd: fixture.path });

		expect(stdout).toBe(updatedMarker);
	});

	test('loads the files plugin subpath', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify({
				name: 'consumer',
				type: 'module',
			}),
			'node_modules/comment-mark': ({ symlink }) => symlink(packageRoot),
			'snippet.txt': 'from a file',
			'main.js': `import { commentMark } from 'comment-mark';
import { files } from 'comment-mark/plugins/files';

process.stdout.write(await commentMark('<!-- file path="snippet.txt" --><!-- /file -->', files({
	baseDirectory: import.meta.dirname,
})));
`,
		});

		const { stdout } = await spawn(process.execPath, ['main.js'], { cwd: fixture.path });

		expect(stdout).toBe('<!-- file path="snippet.txt" -->from a file<!-- /file -->');
	});
});

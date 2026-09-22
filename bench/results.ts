import { readFile, writeFile } from 'node:fs/promises';
import { bold, code, table } from 'md-pen';
import { run } from 'mitata';
import { commentMark, getCommentMarkAll } from '#comment-mark';
import './suite.js';

const formatTime = (nanoseconds: number) => {
	if (nanoseconds < 1000) {
		return `${nanoseconds.toFixed(2)} ns`;
	}
	if (nanoseconds < 1_000_000) {
		return `${(nanoseconds / 1000).toFixed(2)} µs`;
	}
	return `${(nanoseconds / 1_000_000).toFixed(2)} ms`;
};

(async () => {
	// `throw` rejects the run when a benchmark fails, so a broken benchmark is
	// never recorded as a result row.
	const { context, benchmarks } = await run({
		format: 'quiet',
		throw: true,
	});
	const runtime = context.runtime as string;
	const { version } = context as { version?: string };

	const rows: (string | number)[][] = [['Benchmark', 'avg', 'p75', 'p99']];
	for (const benchmark of benchmarks) {
		for (const result of benchmark.runs) {
			const { stats } = result;
			if (!stats) {
				throw new Error(`Benchmark "${result.name}" produced no statistics`);
			}
			rows.push([
				code(result.name),
				formatTime(stats.avg),
				formatTime(stats.p75),
				formatTime(stats.p99),
			]);
		}
	}

	const date = new Date().toISOString().slice(0, 10);
	const recorded = [
		`Measured with ${code(`${runtime} ${version}`)} on ${bold(context.cpu.name ?? 'unknown CPU')} (${code(context.arch ?? 'unknown arch')}), ${date}.`,
		'',
		table(rows, { align: ['left', 'right', 'right', 'right'] }),
	].join('\n');

	const readmeUrl = new URL('README.md', import.meta.url);
	const readme = await readFile(readmeUrl, 'utf8');

	// Fail loudly when the marker is missing instead of reporting that the
	// results are already up to date.
	if (getCommentMarkAll(readme, 'results').length === 0) {
		throw new Error('bench/README.md has no results marker');
	}

	const updated = commentMark(readme, { results: recorded });

	if (updated === readme) {
		console.error('bench/README.md results are already up to date.');
		return;
	}

	await writeFile(readmeUrl, updated);
	console.error('Updated the results table in bench/README.md.');
})();

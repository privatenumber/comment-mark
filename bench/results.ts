import { readFile, writeFile } from 'node:fs/promises';
import { run } from 'mitata';
import { commentMark } from '#comment-mark';
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
	const { context, benchmarks } = await run({ format: 'quiet' });
	const runtime = context.runtime as string;
	const { version } = context as { version?: string };

	const rows = benchmarks.flatMap(benchmark => benchmark.runs.map((result) => {
		const { stats } = result;
		if (result.error || !stats) {
			return `| \`${result.name}\` | error | | |`;
		}
		const { avg, p75, p99 } = stats;
		return `| \`${result.name}\` | ${formatTime(avg)} | ${formatTime(p75)} | ${formatTime(p99)} |`;
	}));

	const date = new Date().toISOString().slice(0, 10);
	const table = [
		`Measured with ${runtime} ${version} on ${context.cpu.name} (${context.arch}), ${date}.`,
		'',
		'| Benchmark | avg | p75 | p99 |',
		'| --- | ---: | ---: | ---: |',
		...rows,
	].join('\n');

	const readmeUrl = new URL('README.md', import.meta.url);
	const readme = await readFile(readmeUrl, 'utf8');
	const updated = commentMark(readme, { results: table });

	if (updated === readme) {
		console.error('bench/README.md results are already up to date.');
		return;
	}

	await writeFile(readmeUrl, updated);
	console.error('Updated the results table in bench/README.md.');
})();

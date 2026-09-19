import { run } from 'mitata';
import './suite.js';

(async () => {
	// `throw` rejects the run when a benchmark fails, so the console runner
	// reports failure instead of printing a partial table.
	await run({
		throw: true,
	});
})();

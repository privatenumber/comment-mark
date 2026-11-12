import packageJson from '../package.json' with { type: 'json' };
import { CliError } from './cli/cli-error.ts';
import { parseArguments } from './cli/parse-arguments.ts';
import { readMarkers } from './cli/read-markers.ts';
import { updateMarkers } from './cli/update-markers.ts';

// Runs the command and returns its exit code.
const run = async () => {
	const command = parseArguments(process.argv.slice(2));

	if (command.type === 'help') {
		command.showHelp();
		return 0;
	}

	if (command.type === 'version') {
		console.log(packageJson.version);
		return 0;
	}

	if (command.type === 'read') {
		await readMarkers(command.filePath);
		return 0;
	}

	return updateMarkers(command.filePath, command.updates);
};

// The process never calls `process.exit()`: it sets the exit code and lets Node
// exit once stdout and stderr drain, so piped output is never cut off.
try {
	process.exitCode = await run();
} catch (error) {
	// CLI errors and the library's own errors explain themselves; unexpected
	// failures keep their stack.
	if (error instanceof CliError || (error instanceof Error && error.message.startsWith('[comment-mark] '))) {
		console.error(`Error: ${error.message}`);
	} else {
		console.error(error);
	}
	process.exitCode = 1;
}

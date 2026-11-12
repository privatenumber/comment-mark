import { readFile, writeFile } from 'node:fs/promises';
import { commentMark } from '../index.ts';
import { createDocument, markerData, selectMarkers } from '../document.ts';
import { CliError } from './cli-error.ts';
import type { SelectorUpdate } from './parse-arguments.ts';

// The replacement map the library accepts. A content update uses a plain
// string; an attribute update uses an update object.
type Replacements = Parameters<typeof commentMark>[1];

/**
 * Applies the updates to `original` and classifies each selector. The library
 * rejects a selector that matches nothing, so only matched selectors are passed
 * to one combined update; a missing selector is reported while the others are
 * still applied.
 */
const planUpdate = async (
	original: string,
	updates: Map<string, SelectorUpdate>,
) => {
	const updated: string[] = [];
	const unchanged: string[] = [];
	const missing: string[] = [];

	const matched: Replacements = Object.create(null);
	const originalDocument = createDocument(original);
	const matchedIndexes = new Map<string, number>();

	for (const [selector, update] of updates) {
		const state = selectMarkers(originalDocument, selector)[0];
		if (!state) {
			missing.push(selector);
			continue;
		}

		// An attribute update merges requested changes over the marker's existing
		// attributes. A static value targets only the first matching marker.
		const current = markerData(state).attributes;
		matched[selector] = update.attributes.size === 0
			? update.content
			: {
				// Spread preserves an own `__proto__` data property, so an attribute
				// with that name survives as data instead of hitting the prototype setter.
				attributes: {
					...current,
					...Object.fromEntries(update.attributes),
				},
				content: update.content,
			};
		matchedIndexes.set(selector, state.index);
	}

	const output = await commentMark(original, matched);
	const outputDocument = createDocument(output);
	for (const [selector, index] of matchedIndexes) {
		const before = originalDocument.markers[index];
		const after = outputDocument.markers[index];
		// Compare bytes, not reader data: normalizing a container prefix changes
		// bytes without changing the content the reader returns, and still needs
		// to be written. Validation keeps each marker's continuation, so equal
		// bytes also mean equal reader data.
		if (original.slice(before.node.openingStart, before.node.contentEnd)
			=== output.slice(after.node.openingStart, after.node.contentEnd)) {
			unchanged.push(selector);
		} else {
			updated.push(selector);
		}
	}

	return {
		output,
		updated,
		unchanged,
		missing,
	};
};

/**
 * Updates the file and reports each selector on stderr. Classifying every
 * selector before writing means the report and the exit code reflect each one,
 * and a malformed marker never leaves partial edits behind. Returns the exit
 * code: 1 when some selectors matched no marker. Throws `CliError` when none
 * matched, since there is nothing to save.
 */
export const updateMarkers = async (
	filePath: string,
	updates: Map<string, SelectorUpdate>,
) => {
	const original = await readFile(filePath, 'utf8');
	const {
		output, updated, unchanged, missing,
	} = await planUpdate(original, updates);

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
		throw new CliError(`No matching markers found for any of the ${missing.length} requested selectors`);
	}

	const exitCode = missing.length > 0 ? 1 : 0;

	if (updated.length === 0) {
		report();
		if (missing.length === 0) {
			console.error(`${filePath} is unchanged. All ${updates.size} requested selectors already match.`);
		}
		return exitCode;
	}

	await writeFile(filePath, output);

	report();

	const summary = [
		unchanged.length > 0 && `${unchanged.length} unchanged`,
		missing.length > 0 && `${missing.length} missing`,
	].filter(Boolean).join('; ');

	console.error(`Saved ${filePath}. Updated ${updated.length} selector${updated.length === 1 ? '' : 's'}${summary ? `; ${summary}` : ''}.`);
	return exitCode;
};

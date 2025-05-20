export const commentMark = (
	input: string,
	data: Record<string, string | null | undefined>,
) => {
	if (
		!input
		|| data === null
		|| data === undefined
		|| typeof data !== 'object'
	) {
		return input;
	}

	let out = Buffer.isBuffer(input) ? input.toString() : input;

	for (const key in data) {
		if (!Object.hasOwn(data, key)) {
			continue;
		}
		let value = data[key];
		if (value === null || value === undefined) {
			continue;
		}
		if (value.includes('\n')) {
			value = `\n${value}\n`;
		}

		const escKey = key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const startRe = new RegExp(`<!--\\s*${escKey}:start\\s*-->`, 'g');
		const endRe = new RegExp(`<!--\\s*${escKey}:end\\s*-->`, 'g');

		for (let m = startRe.exec(out); m !== null; m = startRe.exec(out)) {
			const insertPos = m.index + m[0].length;
			endRe.lastIndex = m.index;
			const match = endRe.exec(out);
			if (!match) {
				throw new Error(`[comment-mark] No end comment found for key "${key}"`);
			}

			out = out.slice(0, insertPos) + value + out.slice(match.index);

			startRe.lastIndex = insertPos + value.length;
			endRe.lastIndex = startRe.lastIndex;
		}
	}

	return out;
};

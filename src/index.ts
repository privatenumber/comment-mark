const escapeKey = (key: string) => key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// Locates the end marker that closes a section whose content starts at `contentStart`,
// or throws when the section was never closed.
const findSectionEnd = (content: string, key: string, contentStart: number) => {
	const endRe = new RegExp(`<!--\\s*${escapeKey(key)}:end\\s*-->`, 'g');
	endRe.lastIndex = contentStart;
	const endMatch = endRe.exec(content);
	if (!endMatch) {
		throw new Error(`[comment-mark] No end comment found for key "${key}"`);
	}

	return endMatch.index;
};

export const commentMark = (
	input: string | Buffer,
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

		const startRe = new RegExp(`<!--\\s*${escapeKey(key)}:start\\s*-->`, 'g');

		for (let m = startRe.exec(out); m !== null; m = startRe.exec(out)) {
			const contentStart = m.index + m[0].length;
			const contentEnd = findSectionEnd(out, key, contentStart);

			out = out.slice(0, contentStart) + value + out.slice(contentEnd);

			startRe.lastIndex = contentStart + value.length;
		}
	}

	return out;
};

export const getCommentMarks = (input: string | Buffer): Record<string, string> => {
	const content = Buffer.isBuffer(input) ? input.toString() : input;
	// Null-prototype dictionary so marker keys can never collide with inherited properties.
	const commentMarks: Record<string, string> = Object.create(null);
	const commentRe = /<!--([\s\S]*?)-->/g;

	for (let match = commentRe.exec(content); match !== null; match = commentRe.exec(content)) {
		const marker = match[1].trim();
		if (!marker.endsWith(':start')) {
			continue;
		}

		const key = marker.slice(0, -':start'.length);
		const contentStart = match.index + match[0].length;
		const contentEnd = findSectionEnd(content, key, contentStart);
		commentMarks[key] = content.slice(contentStart, contentEnd);
	}

	return commentMarks;
};

const createPattern = (
	key: string,
	type: string,
) => new RegExp(`<!--\\s*${key}:${type}\\s*-->`, 'g');

const multilinePtrn = /\n/;

export const commentMark = (
	string: string | Buffer,
	data: Record<string, string | undefined | null>,
) => {
	// Support fs.readFile Buffer
	if (string && Buffer.isBuffer(string)) {
		string = string.toString();
	}

	if (!string || !data) {
		return string;
	}

	for (const key in data) {
		if (!Object.hasOwn(data, key)) {
			continue;
		}

		let value = data[key];

		if (value === undefined || value === null) {
			continue;
		}

		if (multilinePtrn.test(value)) {
			value = `\n${value}\n`;
		}

		const startComment = createPattern(key, 'start');
		const endComment = createPattern(key, 'end');

		let startMatch;
		let endMatch;
		do {
			startMatch = startComment.exec(string);
			if (!startMatch) {
				continue;
			}

			endComment.lastIndex = startMatch.index;
			endMatch = endComment.exec(string);

			if (endMatch) {
				string = (
					string.slice(
						0,
						startMatch.index + startMatch[0].length,
					)
					+ value
					+ string.slice(endMatch.index)
				);
				endComment.lastIndex += value.length;
			} else {
				console.warn(`[comment-mark] No end comment found for "${key}"`);
			}
		} while (startMatch);
	}

	return string;
};

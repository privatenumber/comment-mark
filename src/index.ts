const escapeRegExp = (
	text: string,
): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const createPattern = (
	key: string,
	type: string,
) => new RegExp(`<!--\\s*${key}:${type}\\s*-->`, 'g');

const multilinePtrn = /\n/;

export const commentMark = (
	inputString: string | Buffer,
	data: Record<string, string | undefined | null>,
) => {
	if (!inputString || !data) {
		return inputString;
	}

	// Support fs.readFile Buffer
	if (Buffer.isBuffer(inputString)) {
		inputString = inputString.toString();
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

		const keyEscaped = escapeRegExp(key);
		const startComment = createPattern(keyEscaped, 'start');
		const endComment = createPattern(keyEscaped, 'end');

		let startMatch;
		let endMatch;
		do {
			startMatch = startComment.exec(inputString);
			if (!startMatch) {
				continue;
			}

			endComment.lastIndex = startMatch.index;
			endMatch = endComment.exec(inputString);

			if (endMatch) {
				inputString = (
					inputString.slice(
						0,
						startMatch.index + startMatch[0].length,
					)
					+ value
					+ inputString.slice(endMatch.index)
				);
				endComment.lastIndex += value.length;
			} else {
				throw new Error(`[comment-mark] No end comment found for key "${key}" after start comment at index ${startMatch.index}.`);
			}
		} while (startMatch);
	}

	return inputString;
};

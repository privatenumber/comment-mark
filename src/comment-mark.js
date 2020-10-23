const createPtrn = (key, type) => new RegExp(`<!--\\s*${key}:${type}\\s*-->`, 'g');
const {hasOwnProperty} = Object.prototype;

function commentMark(string, object) {
	if (object) {
		for (const key in object) {
			if (!hasOwnProperty.call(object, key)) {
				continue;
			}

			const value = object[key];
			const startComment = createPtrn(key, 'start');
			const endComment = createPtrn(key, 'end');

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
					string = string.slice(0, startMatch.index + startMatch[0].length) + value + string.slice(endMatch.index);
					endComment.lastIndex += value.length;
				} else {
					console.warn(`[comment-mark] No end comment found for "${key}"`);
				}
			} while (startMatch);
		}
	}

	return string;
}

export default commentMark;

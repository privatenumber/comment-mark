
const createPtrn = (key, type) => new RegExp(`<!--\\s*${key}:${type}\\s*-->`);
const {stringify} = JSON;

function commentMark(string, object) {
	Object.entries(object).forEach(([key, value]) => {
		const startComment = string.match(createPtrn(key, 'start'));
		if (!startComment) {
			console.warn(`[comment-mark] No start comment found for ${stringify(key)}`);
			return;
		}

		const endComment = string.match(createPtrn(key, 'end'));
		if (!endComment) {
			console.warn(`[comment-mark] No end comment found for ${stringify(key)}`);
			return;
		}

		string = string.slice(0, startComment.index + startComment[0].length) + '\n' + value + '\n' + string.slice(endComment.index);
	});

	return string;
}

export default commentMark;

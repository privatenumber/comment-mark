import { isSpaceChar } from '../html-tag.ts';
import { charAt, isSpaceOrTab, lineFeed } from './line.ts';

/**
 * Block start scanners for the line from `index`, its first nonspace, to
 * `lineEnd`. The result depends only on that line, but the search for a
 * backtick in a fence's info string can read past it.
 */

export const scanAtxHeadingStart = (source: string, index: number, lineEnd: number) => {
	let end = index;
	while (charAt(source, end, lineEnd) === 35 && end - index < 7) {
		end += 1;
	}
	const level = end - index;
	if (level < 1 || level > 6) {
		return 0;
	}
	const after = charAt(source, end, lineEnd);
	if (after === lineFeed) {
		return level + 1;
	}
	if (!isSpaceOrTab(after)) {
		return 0;
	}
	while (isSpaceOrTab(charAt(source, end, lineEnd))) {
		end += 1;
	}
	return end - index;
};

/**
 * `chop_trailing_hashtags`: drops trailing whitespace, and a closing sequence of
 * `#` that follows a space or tab. Returns the new end.
 */
export const chopClosingSequence = (source: string, start: number, end: number) => {
	while (end > start && isSpaceChar(source.charCodeAt(end - 1))) {
		end -= 1;
	}
	let hashes = end;
	while (hashes > start && source.charCodeAt(hashes - 1) === 35) {
		hashes -= 1;
	}
	if (hashes === start) {
		// Only the closing sequence remains; the opening one was already skipped.
		return start;
	}
	if (hashes === end || !isSpaceOrTab(source.charCodeAt(hashes - 1))) {
		return end;
	}
	while (hashes > start && isSpaceChar(source.charCodeAt(hashes - 1))) {
		hashes -= 1;
	}
	return hashes;
};

const scanFenceRun = (source: string, index: number, lineEnd: number) => {
	const char = charAt(source, index, lineEnd);
	if (char !== 96 && char !== 126) {
		return 0;
	}
	let end = index;
	while (charAt(source, end, lineEnd) === char) {
		end += 1;
	}
	return end - index;
};

export const scanOpenFence = (source: string, index: number, lineEnd: number) => {
	const length = scanFenceRun(source, index, lineEnd);
	if (length < 3) {
		return 0;
	}
	// A backtick fence's info string cannot hold a backtick.
	if (charAt(source, index, lineEnd) === 96) {
		const backtick = source.indexOf('`', index + length);
		if (backtick !== -1 && backtick < lineEnd) {
			return 0;
		}
	}
	return length;
};

export const scanCloseFence = (source: string, index: number, lineEnd: number) => {
	const length = scanFenceRun(source, index, lineEnd);
	if (length < 3) {
		return 0;
	}
	let end = index + length;
	while (isSpaceOrTab(charAt(source, end, lineEnd))) {
		end += 1;
	}
	return end >= lineEnd ? length : 0;
};

export const scanSetextHeadingLine = (source: string, index: number, lineEnd: number) => {
	const char = charAt(source, index, lineEnd);
	if (char !== 61 && char !== 45) {
		return false;
	}
	let end = index;
	while (charAt(source, end, lineEnd) === char) {
		end += 1;
	}
	while (isSpaceOrTab(charAt(source, end, lineEnd))) {
		end += 1;
	}
	return end >= lineEnd;
};

export const scanThematicBreak = (source: string, index: number, lineEnd: number) => {
	const char = charAt(source, index, lineEnd);
	if (char !== 42 && char !== 95 && char !== 45) {
		return false;
	}
	let count = 0;
	for (let end = index; end < lineEnd; end += 1) {
		const code = source.charCodeAt(end);
		if (code === char) {
			count += 1;
		} else if (!isSpaceOrTab(code)) {
			return false;
		}
	}
	return count >= 3;
};

/** `parse_list_marker`. Returns the marker's length, or 0. */
export const parseListMarker = (
	source: string,
	index: number,
	lineEnd: number,
	interruptsParagraph: boolean,
) => {
	const start = index;
	const char = charAt(source, index, lineEnd);
	if (char === 42 || char === 45 || char === 43) {
		index += 1;
	} else if (char >= 48 && char <= 57) {
		let value = 0;
		let digits = 0;
		do {
			value = (value * 10) + charAt(source, index, lineEnd) - 48;
			index += 1;
			digits += 1;
		} while (
			digits < 9
			&& charAt(source, index, lineEnd) >= 48
			&& charAt(source, index, lineEnd) <= 57
		);
		if (interruptsParagraph && value !== 1) {
			return 0;
		}
		const delimiter = charAt(source, index, lineEnd);
		if (delimiter !== 46 && delimiter !== 41) {
			return 0;
		}
		index += 1;
	} else {
		return 0;
	}

	if (!isSpaceChar(charAt(source, index, lineEnd))) {
		return 0;
	}
	if (interruptsParagraph) {
		// An item that interrupts a paragraph needs content after the marker.
		let content = index;
		while (isSpaceOrTab(charAt(source, content, lineEnd))) {
			content += 1;
		}
		if (content >= lineEnd) {
			return 0;
		}
	}
	return index - start;
};

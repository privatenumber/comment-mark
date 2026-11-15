import { isAsciiLetter } from './html-tag.ts';
import { isCmarkSpace } from './block/reference-definition.ts';
import { isUnicodePunctuation, isUnicodeSpace } from './unicode.ts';

const isHostChar = (code: number) => !isUnicodeSpace(code) && !isUnicodePunctuation(code);

// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/autolink.c#L116-L166
const checkDomain = (text: string, start: number, short: boolean) => {
	let dots = 0;
	let previousUnderscores = 0;
	let underscores = 0;
	let index = start + 1;
	const finalCode = text.charCodeAt(text.length - 1);
	const last = text.length - (finalCode < 128 && finalCode !== 0 ? 1 : 0);
	// cmark-gfm scans bytes from the second byte of the host. After a non-ASCII
	// first character (NUL becomes U+FFFD), that is a UTF-8 continuation byte,
	// which ends the scan.
	const first = text.charCodeAt(start);
	if (first >= 128 || first === 0) {
		return short ? start + 1 : -1;
	}
	while (index < last) {
		let code = text.charCodeAt(index);
		if (code === 92 && index + 1 < last) {
			index += 1;
			code = text.charCodeAt(index);
		}
		if (code === 95) {
			underscores += 1;
		} else if (code === 46) {
			previousUnderscores = underscores;
			underscores = 0;
			dots += 1;
		} else if (code >= 128 || code === 0 || (!isHostChar(code) && code !== 45)) {
			break;
		}
		index += 1;
	}
	return ((previousUnderscores > 0 || underscores > 0) && dots <= 10)
		|| (!short && dots === 0)
		? -1
		: index;
};

// Returns the first index after a matched URL, or -1.
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/autolink.c#L38-L114
export const matchBareAutolink = (text: string, start: number) => {
	let domain: number;
	if (text.charCodeAt(start) === 119) {
		const before = text.charCodeAt(start - 1);
		if ((start > 0 && !isCmarkSpace(before) && before !== 42 && before !== 95
			&& before !== 126 && before !== 40) || !text.startsWith('www.', start)) {
			return -1;
		}
		domain = checkDomain(text, start, false);
	} else {
		if (text.charCodeAt(start + 1) !== 47 || text.charCodeAt(start + 2) !== 47) {
			return -1;
		}
		let rewind = start;
		while (rewind > 0 && isAsciiLetter(text.charCodeAt(rewind - 1))) {
			rewind -= 1;
		}
		const scheme = text.slice(rewind, start).toLowerCase();
		const host = text.codePointAt(start + 3);
		if ((scheme !== 'http' && scheme !== 'https' && scheme !== 'ftp')
			|| host === undefined || !isHostChar(host)) {
			return -1;
		}
		domain = checkDomain(text, start + 3, true);
	}
	if (domain === -1) {
		return -1;
	}
	let end = domain;
	let opening = 0;
	let closing = 0;
	// The domain holds no parentheses, so this loop sees every one that
	// `autolink_delim` counts.
	while (end < text.length && !isCmarkSpace(text.charCodeAt(end)) && text.charCodeAt(end) !== 60) {
		opening += Number(text.charCodeAt(end) === 40);
		closing += Number(text.charCodeAt(end) === 41);
		end += 1;
	}
	while (end > start) {
		const code = text.charCodeAt(end - 1);
		switch (code) {
			case 41: {
				if (closing <= opening) {
					return end;
				}
				closing -= 1;
				end -= 1;
				break;
			}
			case 59: {
				let previous = end - 2;
				while (previous > start && isAsciiLetter(text.charCodeAt(previous))) {
					previous -= 1;
				}
				end = previous < end - 2 && text.charCodeAt(previous) === 38 ? previous : end - 1;
				break;
			}
			case 63: case 33: case 46: case 44: case 58: case 42: case 95: case 126: case 39: case 34: {
				end -= 1;
				break;
			}
			default: {
				return end;
			}
		}
	}
	return -1;
};

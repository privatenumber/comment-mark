import { isUnicodePunctuation, isUnicodeSpace } from './unicode.ts';

type ElementName = 'em' | 'strong' | 'del';

export type Delimiter = {
	code: number;
	position: number;
	length: number;
	remaining: number;
	canOpen: boolean;
	canClose: boolean;
	previous: Delimiter | undefined;
	next: Delimiter | undefined;
	indexed: boolean;
	opens: ElementName[];
	closes: ElementName[];
};

// The extension limits each tilde scan to 100 characters. Core emphasis skips
// tildes when finding neighboring characters; the extension does not.
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L415-L484
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1683-L1733
export const createEmphasis = (text: string) => {
	let last: Delimiter | undefined;

	const push = (start: number) => {
		const code = text.charCodeAt(start);
		let end = start + 1;
		while (text.charCodeAt(end) === code && (code !== 126 || end - start < 100)) {
			end += 1;
		}
		let before = start - 1;
		let after = end;
		if (code !== 126) {
			while (before >= 0 && text.charCodeAt(before) === 126) {
				before -= 1;
			}
			while (text.charCodeAt(after) === 126) {
				after += 1;
			}
		}
		const beforeUnit = text.charCodeAt(before);
		if (beforeUnit >= 0xDC_00 && beforeUnit <= 0xDF_FF) {
			const high = text.charCodeAt(before - 1);
			if (high >= 0xD8_00 && high <= 0xDB_FF) {
				before -= 1;
			}
		}
		const beforeCode = text.codePointAt(before) ?? 10;
		const afterCode = text.codePointAt(after) ?? 10;
		const beforeSpace = isUnicodeSpace(beforeCode);
		const afterSpace = isUnicodeSpace(afterCode);
		const beforePunctuation = isUnicodePunctuation(beforeCode);
		const afterPunctuation = isUnicodePunctuation(afterCode);
		const left = !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation);
		const right = !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation);
		const canOpen = left && (code !== 95 || !right || beforePunctuation);
		const canClose = right && (code !== 95 || !left || afterPunctuation);
		const length = end - start;
		if ((!canOpen && !canClose) || (code === 126 && length > 2)) {
			return {
				end,
				delimiter: undefined,
			};
		}
		const delimiter: Delimiter = {
			code,
			position: end,
			length,
			remaining: length,
			canOpen,
			canClose,
			previous: last,
			next: undefined,
			indexed: false,
			opens: [],
			closes: [],
		};
		if (last) {
			last.next = delimiter;
		}
		last = delimiter;
		return {
			end,
			delimiter,
		};
	};

	// Each bucket holds already-visited openers of one character, original
	// length modulo 3, and canClose value. A match removes intervening nodes in
	// reverse order, so every removal is a bucket pop. The six bucket tails give
	// the nearest eligible opener without cmark-gfm's repeated backward scans.
	// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L672-L833
	const process = (bottom: number) => {
		let closer: Delimiter | undefined;
		let candidate = last;
		while (candidate && candidate.position >= bottom) {
			closer = candidate;
			candidate = candidate.previous;
		}
		if (!closer) {
			return;
		}
		const buckets: Delimiter[][] = Array.from({ length: 18 }, () => []);
		const bounds = Array.from({ length: 9 }, () => bottom);
		const character = (code: number) => (code === 42 ? 0 : (code === 95 ? 1 : 2));
		const bucketIndex = (delimiter: Delimiter) => (
			character(delimiter.code) * 6 + (delimiter.length % 3) * 2 + Number(delimiter.canClose)
		);
		const add = (delimiter: Delimiter) => {
			if (delimiter.canOpen) {
				buckets[bucketIndex(delimiter)].push(delimiter);
				delimiter.indexed = true;
			}
		};
		const remove = (delimiter: Delimiter) => {
			if (delimiter.indexed) {
				buckets[bucketIndex(delimiter)].pop();
				delimiter.indexed = false;
			}
			if (delimiter.previous) {
				delimiter.previous.next = delimiter.next;
			}
			if (delimiter.next) {
				delimiter.next.previous = delimiter.previous;
			} else {
				last = delimiter.previous;
			}
		};
		while (closer) {
			if (!closer.canClose) {
				add(closer);
				closer = closer.next;
				continue;
			}
			const kind = character(closer.code);
			const remainder = closer.length % 3;
			const boundIndex = kind * 3 + remainder;
			let opener: Delimiter | undefined;
			for (let modulo = 0; modulo < 3; modulo += 1) {
				for (let closes = 0; closes < 2; closes += 1) {
					if ((closer.canOpen || closes === 1) && remainder !== 0
						&& (modulo + remainder) % 3 === 0) {
						continue;
					}
					const options = buckets[kind * 6 + modulo * 2 + closes];
					const option = options.at(-1);
					if (option && option.position >= bounds[boundIndex]
						&& (!opener || option.position > opener.position)) {
						opener = option;
					}
				}
			}
			if (!opener) {
				bounds[boundIndex] = closer.position;
				const { next } = closer;
				if (closer.canOpen) {
					add(closer);
				} else {
					remove(closer);
				}
				closer = next;
				continue;
			}
			if (closer.code === 126) {
				// A mismatched tilde pair is discarded without an element.
				// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/strikethrough.c#L39-L80
				if (opener.remaining === closer.remaining) {
					opener.opens.push('del');
					closer.closes.push('del');
				}
			} else {
				const used = opener.remaining >= 2 && closer.remaining >= 2 ? 2 : 1;
				const name = used === 2 ? 'strong' : 'em';
				opener.remaining -= used;
				closer.remaining -= used;
				opener.opens.push(name);
				closer.closes.push(name);
			}
			let interior = closer.previous;
			while (interior && interior !== opener) {
				const { previous } = interior;
				remove(interior);
				interior = previous;
			}
			if (closer.code === 126 || opener.remaining === 0) {
				remove(opener);
			}
			if (closer.code === 126 || closer.remaining === 0) {
				const { next } = closer;
				remove(closer);
				closer = next;
			}
		}
		while (last && last.position >= bottom) {
			remove(last);
		}
	};

	return {
		push,
		process,
	};
};

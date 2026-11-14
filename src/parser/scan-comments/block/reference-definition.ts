import { isAsciiPunctuation } from '../html-tag.ts';

/**
 * Link reference definitions, such as `[x]: <url> "title"`, as GitHub's
 * renderer, cmark-gfm 0.29.0.gfm.13, reads them at the start of a paragraph.
 * A definition renders nothing, so a comment inside one is not a comment:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1022-L1131
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/inlines.c#L1567-L1627
 */

// In UTF-8 bytes, as cmark-gfm reads its input.
const maxLabelLength = 1000;

/**
 * `cmark_isspace`: tab, line feed, carriage return, and space. Unlike the HTML
 * whitespace in `isSpaceChar`, it excludes `\v` and `\f`:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/cmark_ctype.c#L7-L11
 */
export const isCmarkSpace = (code: number) => (
	code === 32 || code === 9 || code === 10 || code === 13
);

const isHighSurrogate = (code: number) => code >= 0xD8_00 && code <= 0xDB_FF;
const isLowSurrogate = (code: number) => code >= 0xDC_00 && code <= 0xDF_FF;

/**
 * The UTF-8 length of the code unit at `index`. A surrogate pair is 4 bytes in
 * all. cmark-gfm reads NUL, and encoding reads a lone surrogate, as U+FFFD,
 * which is 3 bytes.
 */
export const utf8Length = (text: string, index: number) => {
	const code = text.charCodeAt(index);
	if (code === 0) {
		return 3;
	}
	if (code < 0x80) {
		return 1;
	}
	if (code < 0x8_00) {
		return 2;
	}
	if (
		(isHighSurrogate(code) && isLowSurrogate(text.charCodeAt(index + 1)))
		|| (isLowSurrogate(code) && isHighSurrogate(text.charCodeAt(index - 1)))
	) {
		return 2;
	}
	return 3;
};
const maxDestinationParentheses = 32;

const skipSpaces = (text: string, index: number) => {
	while (text.charCodeAt(index) === 32 || text.charCodeAt(index) === 9) {
		index += 1;
	}
	return index;
};

/** Returns the index after the line ending at `index`, or -1 when none is there. */
const skipLineEnd = (text: string, index: number) => {
	if (index >= text.length) {
		return index;
	}
	return text.charCodeAt(index) === 10 ? index + 1 : -1;
};

/** `spnl`: spaces and tabs, with at most one line ending among them. */
const skipSpacesAndLineEnd = (text: string, index: number) => {
	index = skipSpaces(text, index);
	if (text.charCodeAt(index) === 10) {
		index = skipSpaces(text, index + 1);
	}
	return index;
};

/** `link_label`: returns the index after the `]`, or -1. */
export const scanLabel = (text: string, index: number, allowBlank = false) => {
	let length = 0;
	let blank = true;
	for (index += 1; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code === 91) {
			return -1;
		}
		if (code === 93) {
			return blank && !allowBlank ? -1 : index + 1;
		}
		blank &&= isCmarkSpace(code);
		if (code === 92 && isAsciiPunctuation(text.charCodeAt(index + 1))) {
			index += 1;
			length += 1;
		}
		length += utf8Length(text, index);
		if (length > maxLabelLength) {
			return -1;
		}
	}
	return -1;
};

// These 185 scalars fold to themselves in cmark-gfm 0.29.0.gfm.13, but
// JavaScript's case mappings in Unicode 17.0 (Node 26) merge them with other
// scalars. To regenerate, see "Reference label case folding" in
// notes/comment-mark/github-oracle.md.
const foldExceptions = new Set<number>();
for (const [start, end] of [
	[0x1_31, 0x1_31],
	[0x1_9B, 0x1_9B],
	[0x2_64, 0x2_64],
	[0x2_82, 0x2_82],
	[0x10_D0, 0x10_FA],
	[0x10_FD, 0x10_FF],
	[0x1C_8A, 0x1C_8A],
	[0x1D_8E, 0x1D_8E],
	[0x2C_5F, 0x2C_5F],
	[0xA7_94, 0xA7_94],
	[0xA7_B9, 0xA7_B9],
	[0xA7_BB, 0xA7_BB],
	[0xA7_BD, 0xA7_BD],
	[0xA7_BF, 0xA7_BF],
	[0xA7_C1, 0xA7_C1],
	[0xA7_C3, 0xA7_C3],
	[0xA7_C8, 0xA7_C8],
	[0xA7_CA, 0xA7_CA],
	[0xA7_CD, 0xA7_CD],
	[0xA7_CF, 0xA7_CF],
	[0xA7_D1, 0xA7_D1],
	[0xA7_D3, 0xA7_D3],
	[0xA7_D5, 0xA7_D5],
	[0xA7_D7, 0xA7_D7],
	[0xA7_D9, 0xA7_D9],
	[0xA7_DB, 0xA7_DB],
	[0xA7_F6, 0xA7_F6],
	[0x01_05_97, 0x01_05_A1],
	[0x01_05_A3, 0x01_05_B1],
	[0x01_05_B3, 0x01_05_B9],
	[0x01_05_BB, 0x01_05_BC],
	[0x01_0D_70, 0x01_0D_85],
	[0x01_6E_60, 0x01_6E_7F],
	[0x01_6E_BB, 0x01_6E_D3],
]) {
	for (let code = start; code <= end; code += 1) {
		foldExceptions.add(code);
	}
}

// cmark folds Unicode case, trims, and collapses ASCII whitespace.
export const normalizeLabel = (label: string) => {
	let ascii = label.length <= maxLabelLength;
	for (let index = 0; ascii && index < label.length; index += 1) {
		const code = label.charCodeAt(index);
		ascii = code > 0 && code < 128 && !isCmarkSpace(code);
	}
	if (ascii) {
		return label.toUpperCase();
	}
	let normalized = '';
	let space = false;
	let length = 0;
	for (let index = 0; index < label.length; index += 1) {
		length += utf8Length(label, index);
		if (length > maxLabelLength) {
			return '';
		}
		const code = label.charCodeAt(index);
		if (isCmarkSpace(code)) {
			space = normalized.length > 0;
		} else {
			if (space) {
				normalized += ' ';
				space = false;
			}
			const invalid = code === 0
				|| (isHighSurrogate(code) && !isLowSurrogate(label.charCodeAt(index + 1)))
				|| (isLowSurrogate(code) && !isHighSurrogate(label.charCodeAt(index - 1)));
			normalized += invalid ? '\uFFFD' : label[index];
		}
	}
	let folded = '';
	let start = 0;
	for (let index = 0; index < normalized.length;) {
		const code = normalized.codePointAt(index)!;
		const size = code > 0xFF_FF ? 2 : 1;
		if (foldExceptions.has(code)) {
			folded += normalized.slice(start, index).toLowerCase().toUpperCase();
			folded += normalized.slice(index, index + size);
			start = index + size;
		}
		index += size;
	}
	return folded + normalized.slice(start).toLowerCase().toUpperCase();
};

/** `manual_scan_link_url`: returns the index after the destination, or -1. */
export const scanDestination = (text: string, index: number) => {
	if (text.charCodeAt(index) === 60) {
		for (index += 1; index < text.length;) {
			const code = text.charCodeAt(index);
			if (code === 62) {
				return index + 1 < text.length ? index + 1 : -1;
			}
			if (code === 10 || code === 60) {
				return -1;
			}
			index += code === 92 ? 2 : 1;
		}
		return -1;
	}

	const start = index;
	let depth = 0;
	while (index < text.length) {
		const code = text.charCodeAt(index);
		if (code === 92 && isAsciiPunctuation(text.charCodeAt(index + 1))) {
			index += 2;
		} else if (code === 40) {
			depth += 1;
			if (depth > maxDestinationParentheses) {
				return -1;
			}
			index += 1;
		} else if (code === 41) {
			if (depth === 0) {
				break;
			}
			depth -= 1;
			index += 1;
		} else if (isCmarkSpace(code)) {
			if (index === start) {
				return -1;
			}
			break;
		} else {
			index += 1;
		}
	}
	return index < text.length ? index : -1;
};

/**
 * `scan_link_title`: returns the index after the title at `index`, or -1. The
 * pattern takes the longest match, so an end delimiter after a backslash both
 * can end the title and can be passed over as an escape.
 */
export const scanTitle = (text: string, index: number) => {
	const open = text.charCodeAt(index);
	if (open !== 34 && open !== 39 && open !== 40) {
		return -1;
	}
	const close = open === 40 ? 41 : open;
	let end = -1;
	for (let cursor = index + 1; cursor < text.length; cursor += 1) {
		const code = text.charCodeAt(cursor);
		if (code === close || (open === 40 && code === 40)) {
			if (code === close) {
				end = cursor + 1;
			}
			if (text.charCodeAt(cursor - 1) !== 92) {
				break;
			}
		}
	}
	return end;
};

/** `cmark_parse_reference_inline`: returns the index after the definition, or -1. */
const scanDefinition = (
	text: string,
	index: number,
	onDefinition?: (label: string, destination: string, title: string) => void,
) => {
	const labelStart = index;
	index = scanLabel(text, index);
	if (index === -1 || text.charCodeAt(index) !== 58) {
		return -1;
	}
	const destinationStart = skipSpacesAndLineEnd(text, index + 1);
	const destinationEnd = scanDestination(text, destinationStart);
	if (destinationEnd === -1) {
		return -1;
	}

	// A title must follow whitespace and end its line. Otherwise the
	// definition ends after the destination.
	const titleStart = skipSpacesAndLineEnd(text, destinationEnd);
	const titleEnd = titleStart === destinationEnd ? -1 : scanTitle(text, titleStart);
	if (titleEnd !== -1) {
		const end = skipLineEnd(text, skipSpaces(text, titleEnd));
		if (end !== -1) {
			onDefinition?.(
				text.slice(labelStart + 1, index - 1),
				text.slice(destinationStart, destinationEnd),
				text.slice(titleStart, titleEnd),
			);
			return end;
		}
	}
	const end = skipLineEnd(text, skipSpaces(text, destinationEnd));
	if (end !== -1) {
		onDefinition?.(
			text.slice(labelStart + 1, index - 1),
			text.slice(destinationStart, destinationEnd),
			'',
		);
	}
	return end;
};

/**
 * Returns the number of lines that link reference definitions take up at the
 * start of a paragraph. `text` holds the paragraph's lines, each followed by a
 * line feed.
 */
export const countDefinitionLines = (
	text: string,
	onLabel?: (label: string, destination: string, title: string) => void,
) => {
	let index = 0;
	let lines = 0;
	while (text.charCodeAt(index) === 91) {
		const end = scanDefinition(text, index, onLabel);
		if (end === -1) {
			break;
		}
		for (; index < end; index += 1) {
			if (text.charCodeAt(index) === 10) {
				lines += 1;
			}
		}
	}
	return lines;
};

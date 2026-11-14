import { charAt } from './line.ts';

/**
 * Row scanners of cmark-gfm's table extension:
 * https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/table.c#L189-L522
 */

// `spacechar` in the table extension excludes LF and CR.
const isTableSpace = (code: number) => code === 32 || code === 9 || code === 11 || code === 12;

// `table_cell` is `(escaped_char|[^|\r\n])+`, and re2c takes the longest match,
// so a `|` after any backslash is escaped, even in `\\|`:
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/ext_scanners.re#L32-L35
const scanTableCell = (source: string, index: number, end: number) => {
	while (index < end) {
		const code = source.charCodeAt(index);
		if (code === 124 && source.charCodeAt(index - 1) !== 92) {
			break;
		}
		index += 1;
	}
	return index;
};

const skipTableSpace = (source: string, index: number, end: number) => {
	while (index < end && isTableSpace(source.charCodeAt(index))) {
		index += 1;
	}
	return index;
};

/**
 * `row_from_string` for one line from `start` to `end`. Returns each cell as
 * a `[start, end]` pair, untrimmed, or undefined when the line is no row.
 */
export const readTableRow = (source: string, start: number, end: number) => {
	let index = start;
	if (start < end && source.charCodeAt(start) === 124) {
		index = skipTableSpace(source, start + 1, end);
	}
	const cells: number[] = [];
	while (index <= end) {
		const cellEnd = scanTableCell(source, index, end);
		let pipeEnd = cellEnd;
		if (cellEnd < end) {
			pipeEnd = skipTableSpace(source, cellEnd + 1, end);
		}
		if (pipeEnd > index) {
			cells.push(index, cellEnd);
		}
		index = pipeEnd;
		if (pipeEnd === cellEnd) {
			// The row must end here, after optional spaces.
			const rowEnd = skipTableSpace(source, index, end);
			return rowEnd === end && cells.length > 0 ? cells : undefined;
		}
	}
	return undefined;
};

const scanTableMarker = (source: string, index: number, lineEnd: number) => {
	index = skipTableSpace(source, index, lineEnd);
	if (charAt(source, index, lineEnd) === 58) {
		index += 1;
	}
	if (charAt(source, index, lineEnd) !== 45) {
		return -1;
	}
	while (charAt(source, index, lineEnd) === 45) {
		index += 1;
	}
	if (charAt(source, index, lineEnd) === 58) {
		index += 1;
	}
	return skipTableSpace(source, index, lineEnd);
};

/** Whether the line from `index`, its first nonspace, is a delimiter row. */
export const scanTableStart = (source: string, index: number, lineEnd: number) => {
	if (charAt(source, index, lineEnd) === 124) {
		index += 1;
	}
	index = scanTableMarker(source, index, lineEnd);
	if (index === -1) {
		return false;
	}
	while (charAt(source, index, lineEnd) === 124) {
		const next = scanTableMarker(source, index + 1, lineEnd);
		if (next === -1) {
			index += 1;
			break;
		}
		index = next;
	}
	return skipTableSpace(source, index, lineEnd) === lineEnd;
};

/**
 * Returns a search for `needle` in `text` that callers must use with
 * nondecreasing start positions. A result is reused until the search moves
 * past it, so any number of searches over one text take linear time in total.
 */
export const createForwardSearch = (text: string, needle: string) => {
	let found = -2;
	return (from: number) => {
		if (found !== -1 && found < from) {
			found = text.indexOf(needle, from);
		}
		return found;
	};
};

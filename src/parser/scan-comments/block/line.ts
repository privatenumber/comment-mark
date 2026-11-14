// The block phase reads one line at a time. Every position from the line's
// end on reads as the line feed that ends it, as cmark-gfm's `peek_at` does.
export const lineFeed = 10;

export const charAt = (source: string, index: number, lineEnd: number) => (
	index < lineEnd ? source.charCodeAt(index) : lineFeed
);

export const isSpaceOrTab = (code: number) => code === 32 || code === 9;

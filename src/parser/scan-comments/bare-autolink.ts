import { isAsciiLetter, isAsciiPunctuation } from './html-tag.ts';
import { isCmarkSpace } from './block/reference-definition.ts';

// cmark-gfm's fixed Unicode punctuation table, not the runtime's Unicode version.
// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/src/utf8.c#L248-L316
const punctuation = [
	161,
	161,
	167,
	167,
	171,
	171,
	182,
	182,
	183,
	183,
	187,
	187,
	191,
	191,
	894,
	894,
	903,
	903,
	1370,
	1375,
	1417,
	1417,
	1418,
	1418,
	1470,
	1470,
	1472,
	1472,
	1475,
	1475,
	1478,
	1478,
	1523,
	1523,
	1524,
	1524,
	1545,
	1545,
	1546,
	1546,
	1548,
	1548,
	1549,
	1549,
	1563,
	1563,
	1566,
	1566,
	1567,
	1567,
	1642,
	1645,
	1748,
	1748,
	1792,
	1805,
	2039,
	2041,
	2096,
	2110,
	2142,
	2142,
	2404,
	2404,
	2405,
	2405,
	2416,
	2416,
	2800,
	2800,
	3572,
	3572,
	3663,
	3663,
	3674,
	3674,
	3675,
	3675,
	3844,
	3858,
	3860,
	3860,
	3898,
	3901,
	3973,
	3973,
	4048,
	4052,
	4057,
	4057,
	4058,
	4058,
	4170,
	4175,
	4347,
	4347,
	4960,
	4968,
	5120,
	5120,
	5741,
	5741,
	5742,
	5742,
	5787,
	5787,
	5788,
	5788,
	5867,
	5869,
	5941,
	5941,
	5942,
	5942,
	6100,
	6102,
	6104,
	6106,
	6144,
	6154,
	6468,
	6468,
	6469,
	6469,
	6686,
	6686,
	6687,
	6687,
	6816,
	6822,
	6824,
	6829,
	7002,
	7008,
	7164,
	7167,
	7227,
	7231,
	7294,
	7294,
	7295,
	7295,
	7360,
	7367,
	7379,
	7379,
	8208,
	8231,
	8240,
	8259,
	8261,
	8273,
	8275,
	8286,
	8317,
	8317,
	8318,
	8318,
	8333,
	8333,
	8334,
	8334,
	8968,
	8971,
	9001,
	9001,
	9002,
	9002,
	10_088,
	10_101,
	10_181,
	10_181,
	10_182,
	10_182,
	10_214,
	10_223,
	10_627,
	10_648,
	10_712,
	10_715,
	10_748,
	10_748,
	10_749,
	10_749,
	11_513,
	11_516,
	11_518,
	11_518,
	11_519,
	11_519,
	11_632,
	11_632,
	11_776,
	11_822,
	11_824,
	11_842,
	12_289,
	12_291,
	12_296,
	12_305,
	12_308,
	12_319,
	12_336,
	12_336,
	12_349,
	12_349,
	12_448,
	12_448,
	12_539,
	12_539,
	42_238,
	42_238,
	42_239,
	42_239,
	42_509,
	42_511,
	42_611,
	42_611,
	42_622,
	42_622,
	42_738,
	42_743,
	43_124,
	43_127,
	43_214,
	43_214,
	43_215,
	43_215,
	43_256,
	43_258,
	43_310,
	43_310,
	43_311,
	43_311,
	43_359,
	43_359,
	43_457,
	43_469,
	43_486,
	43_486,
	43_487,
	43_487,
	43_612,
	43_615,
	43_742,
	43_742,
	43_743,
	43_743,
	43_760,
	43_760,
	43_761,
	43_761,
	44_011,
	44_011,
	64_830,
	64_830,
	64_831,
	64_831,
	65_040,
	65_049,
	65_072,
	65_106,
	65_108,
	65_121,
	65_123,
	65_123,
	65_128,
	65_128,
	65_130,
	65_130,
	65_131,
	65_131,
	65_281,
	65_283,
	65_285,
	65_290,
	65_292,
	65_295,
	65_306,
	65_306,
	65_307,
	65_307,
	65_311,
	65_311,
	65_312,
	65_312,
	65_339,
	65_341,
	65_343,
	65_343,
	65_371,
	65_371,
	65_373,
	65_373,
	65_375,
	65_381,
	65_792,
	65_794,
	66_463,
	66_463,
	66_512,
	66_512,
	66_927,
	66_927,
	67_671,
	67_671,
	67_871,
	67_871,
	67_903,
	67_903,
	68_176,
	68_184,
	68_223,
	68_223,
	68_336,
	68_342,
	68_409,
	68_415,
	68_505,
	68_508,
	69_703,
	69_709,
	69_819,
	69_819,
	69_820,
	69_820,
	69_822,
	69_825,
	69_952,
	69_955,
	70_004,
	70_004,
	70_005,
	70_005,
	70_085,
	70_088,
	70_093,
	70_093,
	70_200,
	70_205,
	70_854,
	70_854,
	71_105,
	71_113,
	71_233,
	71_235,
	74_864,
	74_868,
	92_782,
	92_782,
	92_783,
	92_783,
	92_917,
	92_917,
	92_983,
	92_987,
	92_996,
	92_996,
	113_823,
	113_823,
];

const isHostChar = (code: number) => {
	if (code < 128) {
		return code !== 12 && !isCmarkSpace(code) && !isAsciiPunctuation(code);
	}
	if (code === 160 || code === 5760 || (code >= 8192 && code <= 8202)
		|| code === 8239 || code === 8287 || code === 12_288) {
		return false;
	}
	let low = 0;
	let high = punctuation.length / 2;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (code < punctuation[middle * 2]) {
			high = middle;
		} else if (code > punctuation[middle * 2 + 1]) {
			low = middle + 1;
		} else {
			return false;
		}
	}
	return true;
};

// https://github.com/github/cmark-gfm/blob/0.29.0.gfm.13/extensions/autolink.c#L116-L166
const checkDomain = (text: string, start: number, short: boolean) => {
	let dots = 0;
	let previousUnderscores = 0;
	let underscores = 0;
	let index = start + 1;
	const finalCode = text.charCodeAt(text.length - 1);
	const last = text.length - (finalCode < 128 && finalCode !== 0 ? 1 : 0);
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
	while (end < text.length && !isCmarkSpace(text.charCodeAt(end)) && text.charCodeAt(end) !== 60) {
		end += 1;
	}
	for (let index = start; index < end; index += 1) {
		opening += Number(text.charCodeAt(index) === 40);
		closing += Number(text.charCodeAt(index) === 41);
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
	return end === start ? -1 : end;
};

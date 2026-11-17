const isWhitespace = (char) => char === " " || char === "	" || char === "\n" || char === "\r" || char === "\f";
const skipWhitespace = (source, index, end) => {
  while (index < end && isWhitespace(source[index])) {
    index += 1;
  }
  return index;
};
const isNameStart = (char) => char >= "a" && char <= "z" || char >= "A" && char <= "Z" || char === "_";
const isNameChar = (char) => isNameStart(char) || char >= "0" && char <= "9" || char === "-";
const readName = (source, index, end) => {
  if (index >= end || !isNameStart(source[index])) {
    return void 0;
  }
  const start = index;
  index += 1;
  while (index < end && isNameChar(source[index])) {
    index += 1;
  }
  return {
    name: source.slice(start, index),
    end: index
  };
};

const isValueChar = (char) => !isWhitespace(char) && char !== '"' && char !== "'";
const readInvalidText = (source, index, end) => {
  let writtenEnd = index;
  while (writtenEnd < end && !isWhitespace(source[writtenEnd])) {
    writtenEnd += 1;
  }
  return source.slice(index, writtenEnd);
};
const readAttribute = (source, index, end) => {
  index = skipWhitespace(source, index, end);
  if (index >= end) {
    return void 0;
  }
  const start = index;
  if (!isNameStart(source[index])) {
    const attribute = readInvalidText(source, start, end);
    throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(attribute)}`);
  }
  index += 1;
  while (index < end && isNameChar(source[index])) {
    index += 1;
  }
  const name = source.slice(start, index);
  index = skipWhitespace(source, index, end);
  if (source[index] !== "=") {
    const attribute = readInvalidText(source, start, end);
    throw new Error(`[comment-mark] Invalid marker attribute: ${JSON.stringify(attribute)}`);
  }
  index += 1;
  index = skipWhitespace(source, index, end);
  const valueStart = index;
  let value;
  let quote;
  const openingQuote = source[index];
  if (openingQuote === '"' || openingQuote === "'") {
    const quoteEnd = source.indexOf(openingQuote, index + 1);
    if (quoteEnd === -1 || quoteEnd >= end) {
      throw new Error(
        `[comment-mark] Unterminated attribute value for ${JSON.stringify(name)}`
      );
    }
    quote = openingQuote;
    value = source.slice(index + 1, quoteEnd);
    index = quoteEnd + 1;
    if (index < end && !isWhitespace(source[index])) {
      throw new Error("[comment-mark] Expected whitespace between attributes");
    }
  } else {
    while (index < end && isValueChar(source[index])) {
      index += 1;
    }
    if (index === valueStart) {
      throw new Error(`[comment-mark] Missing value for attribute ${JSON.stringify(name)}`);
    }
    value = source.slice(valueStart, index);
  }
  return {
    name,
    value,
    quote,
    end: index,
    valueStart,
    valueEnd: index
  };
};
const parseAttributeNodes = (source, start, end) => {
  const attributes = [];
  const names = /* @__PURE__ */ new Set();
  let index = start;
  while (index < end) {
    const attribute = readAttribute(source, index, end);
    if (!attribute) {
      break;
    }
    if (names.has(attribute.name)) {
      throw new Error(`[comment-mark] Duplicate marker attribute: ${JSON.stringify(attribute.name)}`);
    }
    names.add(attribute.name);
    attributes.push(attribute);
    index = attribute.end;
  }
  return attributes;
};
const isUnquotedValue = (value) => {
  if (value === "") {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!isValueChar(value[index])) {
      return false;
    }
  }
  return true;
};
const isAttributeName = (name) => {
  if (name === "" || !isNameStart(name[0])) {
    return false;
  }
  for (let index = 1; index < name.length; index += 1) {
    if (!isNameChar(name[index])) {
      return false;
    }
  }
  return true;
};
const encodeAttributeValue = (value, quote) => {
  if (value.includes("-->")) {
    throw new Error(`[comment-mark] Attribute value cannot contain "-->": ${JSON.stringify(value)}`);
  }
  if (quote === '"' && !value.includes('"')) {
    return `"${value}"`;
  }
  if (quote === "'" && !value.includes("'")) {
    return `'${value}'`;
  }
  if (quote === void 0 && isUnquotedValue(value)) {
    return value;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  throw new Error(`[comment-mark] Attribute value cannot be quoted: ${JSON.stringify(value)}`);
};

var Tt = Object.defineProperty;
var s = (e, t) => Tt(e, "name", { value: t, configurable: true });
const x = s((e, t) => {
  let n = -2;
  return (o) => (n !== -1 && n < o && (n = e.indexOf(t, o)), n);
}, "createForwardSearch"), Ge = s((e, t) => {
  const n = x(e, "<"), o = x(e, "["), i = x(e, "]"), r = x(e, "www."), c = x(e, "://"), u = s((l, m) => {
    const d = l(m[0]);
    return d !== -1 && d < m.at(-1);
  }, "contains");
  return { needsInline: s((l, m) => u(n, l) || t && m === "paragraph", "needsInline"), hasBrackets: s((l) => u(o, l) && u(i, l), "hasBrackets"), hasBareAutolink: s((l) => u(r, l) || u(c, l), "hasBareAutolink") };
}, "createBlockFilter"), Te = s((e) => e >= 65 && e <= 90, "isAsciiUppercase"), Fe = s((e) => Te(e) ? e + 32 : e, "toAsciiLower"), le = s((e) => e === 32 || e >= 9 && e <= 13, "isSpaceChar"), ae = s((e) => e >= 65 && e <= 90 || e >= 97 && e <= 122, "isAsciiLetter"), Me = s((e) => e >= 48 && e <= 57, "isAsciiDigit"), ue = s((e) => ae(e) || Me(e), "isAsciiAlphanumeric"), ie = s((e) => e >= 33 && e <= 47 || e >= 58 && e <= 64 || e >= 91 && e <= 96 || e >= 123 && e <= 126, "isAsciiPunctuation"), re = s((e) => e === 32 || e === 9 || e === 10 || e === 13, "isCmarkSpace"), $e = s((e) => {
  let t = 0, n = e.length;
  for (; t < n && re(e.charCodeAt(t)); ) t += 1;
  for (; n > t && re(e.charCodeAt(n - 1)); ) n -= 1;
  return e.slice(t, n);
}, "trimCmarkSpace"), Ke = s((e) => e >= 55296 && e <= 57343, "isSurrogate"), pe = s((e) => e >= 55296 && e <= 56319, "isHighSurrogate"), ge = s((e) => e >= 56320 && e <= 57343, "isLowSurrogate"), Ne = s((e, t) => {
  const n = e.charCodeAt(t);
  return n === 0 ? 3 : n < 128 ? 1 : n < 2048 || pe(n) && ge(e.charCodeAt(t + 1)) || ge(n) && pe(e.charCodeAt(t - 1)) ? 2 : 3;
}, "utf8Length"), Ve = 1e3, Xe = s((e, t, n = false) => {
  let o = 0, i = true;
  for (t += 1; t < e.length; t += 1) {
    const r = e.charCodeAt(t);
    if (r === 91) return -1;
    if (r === 93) return i && !n ? -1 : t + 1;
    if (i &&= re(r), r === 92 && ie(e.charCodeAt(t + 1)) && (t += 1, o += 1), o += Ne(e, t), o > Ve) return -1;
  }
  return -1;
}, "scanLabel"), Ye = /* @__PURE__ */ new Set();
for (const [e, t] of [[305, 305], [411, 411], [612, 612], [642, 642], [4304, 4346], [4349, 4351], [7306, 7306], [7566, 7566], [11359, 11359], [42900, 42900], [42937, 42937], [42939, 42939], [42941, 42941], [42943, 42943], [42945, 42945], [42947, 42947], [42952, 42952], [42954, 42954], [42957, 42957], [42959, 42959], [42961, 42961], [42963, 42963], [42965, 42965], [42967, 42967], [42969, 42969], [42971, 42971], [42998, 42998], [66967, 66977], [66979, 66993], [66995, 67001], [67003, 67004], [68976, 68997], [93792, 93823], [93883, 93907]]) for (let n = e; n <= t; n += 1) Ye.add(n);
const ke = s((e) => {
  let t = e.length <= Ve;
  for (let u = 0; t && u < e.length; u += 1) {
    const l = e.charCodeAt(u);
    t = l > 0 && l < 128 && !re(l);
  }
  if (t) return e.toUpperCase();
  let n = "", o = false, i = 0;
  for (let u = 0; u < e.length; u += 1) {
    if (i += Ne(e, u), i > Ve) return "";
    const l = e.charCodeAt(u);
    if (re(l)) o = n.length > 0;
    else {
      o && (n += " ", o = false);
      const m = l === 0 || pe(l) && !ge(e.charCodeAt(u + 1)) || ge(l) && !pe(e.charCodeAt(u - 1));
      n += m ? "\uFFFD" : e[u];
    }
  }
  let r = "", c = 0;
  for (let u = 0; u < n.length; ) {
    const l = n.codePointAt(u), m = l > 65535 ? 2 : 1;
    Ye.has(l) && (r += n.slice(c, u).toLowerCase().toUpperCase(), r += n.slice(u, u + m), c = u + m), u += m;
  }
  return r + n.slice(c).toLowerCase().toUpperCase();
}, "normalizeLabel"), Nt = 32, Be = s((e, t) => {
  for (; e.charCodeAt(t) === 32 || e.charCodeAt(t) === 9; ) t += 1;
  return t;
}, "skipSpaces"), Je = s((e, t) => t >= e.length ? t : e.charCodeAt(t) === 10 ? t + 1 : -1, "skipLineEnd"), Ze = s((e, t) => (t = Be(e, t), e.charCodeAt(t) === 10 && (t = Be(e, t + 1)), t), "skipSpacesAndLineEnd"), qe = s((e, t) => {
  if (e.charCodeAt(t) === 60) {
    for (t += 1; t < e.length; ) {
      const i = e.charCodeAt(t);
      if (i === 62) return t + 1 < e.length ? t + 1 : -1;
      if (i === 10 || i === 60) return -1;
      t += i === 92 ? 2 : 1;
    }
    return -1;
  }
  const n = t;
  let o = 0;
  for (; t < e.length; ) {
    const i = e.charCodeAt(t);
    if (i === 92 && ie(e.charCodeAt(t + 1))) t += 2;
    else if (i === 40) {
      if (o += 1, o > Nt) return -1;
      t += 1;
    } else if (i === 41) {
      if (o === 0) break;
      o -= 1, t += 1;
    } else if (re(i)) {
      if (t === n) return -1;
      break;
    } else t += 1;
  }
  return t < e.length ? t : -1;
}, "scanDestination"), xe = s((e, t) => {
  const n = e.charCodeAt(t);
  if (n !== 34 && n !== 39 && n !== 40) return -1;
  const o = n === 40 ? 41 : n;
  let i = -1;
  for (let r = t + 1; r < e.length; r += 1) {
    const c = e.charCodeAt(r);
    if ((c === o || n === 40 && c === 40) && (c === o && (i = r + 1), e.charCodeAt(r - 1) !== 92)) break;
  }
  return i;
}, "scanTitle"), Bt = s((e, t, n) => {
  const o = t;
  if (t = Xe(e, t), t === -1 || e.charCodeAt(t) !== 58) return -1;
  const i = Ze(e, t + 1), r = qe(e, i);
  if (r === -1) return -1;
  const c = Ze(e, r), u = c === r ? -1 : xe(e, c);
  let l = u === -1 ? -1 : Je(e, Be(e, u));
  return l === -1 && (l = Je(e, Be(e, r))), l !== -1 && n?.(e.slice(o + 1, t - 1), e.slice(i, r), u === -1 ? "" : e.slice(c, u)), l;
}, "scanDefinition"), Ot = s((e, t) => {
  let n = 0, o = 0;
  for (; e.charCodeAt(n) === 91; ) {
    const i = Bt(e, n, t);
    if (i === -1) break;
    for (let r = e.indexOf(`
`, n); r !== -1 && r < i; r = e.indexOf(`
`, r + 1)) o += 1;
    n = i;
  }
  return o;
}, "countDefinitionLines"), Ee = 10, j = s((e, t, n) => t < n ? e.charCodeAt(t) : Ee, "charAt"), se = s((e) => e === 32 || e === 9, "isSpaceOrTab"), Dt = s((e, t, n) => {
  let o = t;
  for (; j(e, o, n) === 35 && o - t < 7; ) o += 1;
  const i = o - t;
  if (i < 1 || i > 6) return 0;
  const r = j(e, o, n);
  if (r === Ee) return i + 1;
  if (!se(r)) return 0;
  for (; se(j(e, o, n)); ) o += 1;
  return o - t;
}, "scanAtxHeadingStart"), et = s((e, t, n) => {
  const o = j(e, t, n);
  if (o !== 96 && o !== 126) return 0;
  let i = t;
  for (; j(e, i, n) === o; ) i += 1;
  return i - t;
}, "scanFenceRun"), Pt = s((e, t, n) => {
  const o = et(e, t, n);
  if (o < 3) return 0;
  if (j(e, t, n) === 96) {
    const i = e.indexOf("`", t + o);
    if (i !== -1 && i < n) return 0;
  }
  return o;
}, "scanOpenFence"), It = s((e, t, n) => {
  const o = et(e, t, n);
  if (o < 3) return 0;
  let i = t + o;
  for (; se(j(e, i, n)); ) i += 1;
  return i >= n ? o : 0;
}, "scanCloseFence"), Ft = s((e, t, n) => {
  const o = j(e, t, n);
  if (o !== 61 && o !== 45) return false;
  let i = t;
  for (; j(e, i, n) === o; ) i += 1;
  for (; se(j(e, i, n)); ) i += 1;
  return i >= n;
}, "scanSetextHeadingLine"), Mt = s((e, t, n) => {
  const o = j(e, t, n);
  if (o !== 42 && o !== 95 && o !== 45) return false;
  let i = 0;
  for (let r = t; r < n; r += 1) {
    const c = e.charCodeAt(r);
    if (c === o) i += 1;
    else if (!se(c)) return false;
  }
  return i >= 3;
}, "scanThematicBreak"), $t = s((e, t, n) => {
  if (j(e, t, n) !== 91 || j(e, t + 1, n) !== 94) return;
  let o = t + 2;
  for (; ; o += 1) {
    const r = j(e, o, n);
    if (r === 93 || r === 32 || r === 9 || r === 10 || r === 13) break;
  }
  if (o === t + 2 || j(e, o, n) !== 93 || j(e, o + 1, n) !== 58) return;
  let i = o + 2;
  for (; se(j(e, i, n)); ) i += 1;
  return { labelEnd: o, end: i };
}, "scanFootnoteDefinition"), Vt = s((e, t, n, o) => {
  const i = t, r = j(e, t, n);
  if (r === 42 || r === 45 || r === 43) t += 1;
  else if (r >= 48 && r <= 57) {
    let c = 0, u = 0;
    do
      c = c * 10 + j(e, t, n) - 48, t += 1, u += 1;
    while (u < 9 && j(e, t, n) >= 48 && j(e, t, n) <= 57);
    if (o && c !== 1) return 0;
    const l = j(e, t, n);
    if (l !== 46 && l !== 41) return 0;
    t += 1;
  } else return 0;
  if (!le(j(e, t, n))) return 0;
  if (o) {
    let c = t;
    for (; se(j(e, c, n)); ) c += 1;
    if (c >= n) return 0;
  }
  return t - i;
}, "parseListMarker"), qt = s((e) => ae(e) || Me(e) || e === 45, "isTagNameChar"), tt = s((e) => ae(e) || e === 95 || e === 58, "isAttributeNameStart"), Et = s((e) => tt(e) || Me(e) || e === 46 || e === 45, "isAttributeNameChar"), zt = s((e) => !(le(e) || e === 34 || e === 39 || e === 61 || e === 60 || e === 62 || e === 96), "isUnquotedValueChar"), we = s((e, t, n) => {
  for (; t < n && le(e.charCodeAt(t)); ) t += 1;
  return t;
}, "skipSpaceChars"), nt = s((e, t, n) => {
  for (; t < n && qt(e.charCodeAt(t)); ) t += 1;
  return t;
}, "skipTagName"), Ht = s((e, t, n) => {
  if (t >= n) return -1;
  const o = e.charCodeAt(t);
  if (o === 34 || o === 39) {
    const r = e.indexOf(o === 34 ? '"' : "'", t + 1);
    return r === -1 || r >= n ? -1 : r + 1;
  }
  let i = t;
  for (; i < n && zt(e.charCodeAt(i)); ) i += 1;
  return i === t ? -1 : i;
}, "scanAttributeValue"), ot = s((e, t, n) => {
  let o = t + 1;
  if (e.charCodeAt(o) === 47) return o += 1, o >= n || !ae(e.charCodeAt(o)) ? -1 : (o = we(e, nt(e, o + 1, n), n), o < n && e.charCodeAt(o) === 62 ? o + 1 : -1);
  if (o >= n || !ae(e.charCodeAt(o))) return -1;
  for (o = nt(e, o + 1, n); ; ) {
    const i = we(e, o, n);
    if (i === o || i >= n || !tt(e.charCodeAt(i))) break;
    let r = i + 1;
    for (; r < n && Et(e.charCodeAt(r)); ) r += 1;
    const c = we(e, r, n);
    if (c < n && e.charCodeAt(c) === 61) {
      const u = Ht(e, we(e, c + 1, n), n);
      if (u === -1) return -1;
      o = u;
    } else o = r;
  }
  return o = we(e, o, n), o < n && e.charCodeAt(o) === 47 && (o += 1), o < n && e.charCodeAt(o) === 62 ? o + 1 : -1;
}, "scanHtmlTag"), Ut = /* @__PURE__ */ new Set(["address", "article", "aside", "base", "basefont", "blockquote", "body", "caption", "center", "col", "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html", "iframe", "legend", "li", "link", "main", "menu", "menuitem", "nav", "noframes", "ol", "optgroup", "option", "p", "param", "section", "source", "title", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "track", "ul"]), Rt = /* @__PURE__ */ new Set(["script", "pre", "textarea", "style"]), Qt = { 2: "-->", 3: "?>", 4: ">", 5: "]]>" }, Wt = ["<\/script>", "</pre>", "</textarea>", "</style>"], jt = s((e) => se(e) || e === 12, "isTrailingSpace"), _t = s((e, t, n, o) => {
  if (j(e, t, n) !== 60) return 0;
  const i = j(e, t + 1, n);
  if (i === 33) {
    const C = j(e, t + 2, n);
    return C === 45 && j(e, t + 3, n) === 45 ? 2 : Te(C) ? 4 : t + 9 <= n && e.slice(t + 2, t + 9).toUpperCase() === "[CDATA[" ? 5 : 0;
  }
  if (i === 63) return 3;
  const r = i === 47, c = t + (r ? 2 : 1);
  let u = c;
  for (; ue(j(e, u, n)); ) u += 1;
  const l = e.slice(c, u).toLowerCase(), m = j(e, u, n);
  if (!r && Rt.has(l) && (le(m) || m === 62)) return 1;
  if (Ut.has(l) && (le(m) || m === 62 || m === 47 && j(e, u + 1, n) === 62)) return 6;
  if (o) return 0;
  let d = ot(e, t, n);
  if (d === -1) return 0;
  for (; d < n && jt(e.charCodeAt(d)); ) d += 1;
  return d === n ? 7 : 0;
}, "scanHtmlBlockStart"), Gt = s((e, t, n, o) => {
  const i = e.slice(t, n);
  if (o === 1) {
    const r = i.toLowerCase();
    return Wt.some((c) => r.includes(c));
  }
  return i.includes(Qt[o]);
}, "closesHtmlBlock"), Kt = s((e) => e === 32 || e === 9 || e === 11 || e === 12, "isTableSpace"), Xt = s((e, t, n) => {
  for (; t < n && !(e.charCodeAt(t) === 124 && e.charCodeAt(t - 1) !== 92); ) t += 1;
  return t;
}, "scanTableCell"), Ce = s((e, t, n) => {
  for (; t < n && Kt(e.charCodeAt(t)); ) t += 1;
  return t;
}, "skipTableSpace"), ze = s((e, t, n) => {
  let o = t;
  t < n && e.charCodeAt(t) === 124 && (o = Ce(e, t + 1, n));
  const i = [];
  for (; o <= n; ) {
    const r = Xt(e, o, n);
    let c = r;
    if (r < n && (c = Ce(e, r + 1, n)), c > o && i.push(o, r), o = c, c === r) return Ce(e, o, n) === n && i.length > 0 ? i : void 0;
  }
}, "readTableRow"), rt = s((e, t, n) => {
  if (t = Ce(e, t, n), j(e, t, n) === 58 && (t += 1), j(e, t, n) !== 45) return -1;
  for (; j(e, t, n) === 45; ) t += 1;
  return j(e, t, n) === 58 && (t += 1), Ce(e, t, n);
}, "scanTableMarker"), Yt = s((e, t, n) => {
  if (j(e, t, n) === 124 && (t += 1), t = rt(e, t, n), t === -1) return false;
  for (; j(e, t, n) === 124; ) {
    const o = rt(e, t + 1, n);
    if (o === -1) {
      t += 1;
      break;
    }
    t = o;
  }
  return Ce(e, t, n) === n;
}, "scanTableStart"), Jt = s((e) => e.type === "list" ? e.marker === 46 || e.marker === 41 ? "ol" : "ul" : e.type === "listItem" ? "li" : "blockquote", "containerName"), ce = 4, be = 4, st = 100, at = s((e, t) => {
  let n = t[0], o = t.at(-1);
  for (; n < t[1] && (e.charCodeAt(n) === 32 || e.charCodeAt(n) === 9); ) n += 1;
  for (; o > t.at(-2) && (e.charCodeAt(o - 1) === 32 || e.charCodeAt(o - 1) === 9); ) o -= 1;
  return t[0] = n, t[t.length - 1] = o, t;
}, "trimTableText"), it = s((e, t, n) => {
  const o = n?.after ?? Number.POSITIVE_INFINITY, i = n?.canStop, r = [], c = [], u = [];
  let l, m = true, d = false, C = 0, T = 0, N = 0, L = 0, _ = 0, q = 0, b = false, w = false, a = 0, g = 0, S = false, D, M = false, V = false, F = "container", R = false, J = false;
  const Q = s((A) => j(e, A, C), "peek"), Z = s(() => {
    let A = ce - N % ce;
    if (L <= T) for (L = T, _ = N; ; ) {
      const v = Q(L);
      if (v === 32) L += 1, _ += 1, A -= 1, A === 0 && (A = ce);
      else if (v === 9) L += 1, _ += A, A = ce;
      else break;
    }
    q = _ - N, b = L >= C;
  }, "findFirstNonspace"), K = s((A, v) => {
    for (; A > 0 && T <= C; ) if (Q(T) === 9) {
      const U = ce - N % ce;
      if (v) {
        w = U > A;
        const G = Math.min(A, U);
        N += G, T += w ? 0 : 1, A -= G;
      } else w = false, N += U, T += 1, A -= 1;
    } else w = false, T += 1, N += 1, A -= 1;
  }, "advance"), te = s(() => {
    let A = "";
    for (const v of r) switch (v.type) {
      case "blockquote": {
        A += "> ";
        break;
      }
      case "listItem": {
        A += " ".repeat(v.indent);
        break;
      }
      case "footnote": {
        A += "    ";
        break;
      }
    }
    return A;
  }, "nextLinePrefix"), ne = s((A) => {
    const v = r.pop();
    if (v.type === "blockquote" && c.pop(), v.type === "footnote") u.pop(), t.footnoteEnd?.(v.lastIsParagraph, d, A), d = v.savedMarkup;
    else {
      t.close?.(Jt(v)), d = true;
      const U = r.at(-1);
      U?.type === "footnote" && (U.lastIsParagraph = false);
    }
  }, "popContainer"), H = x(e, "]:"), E = s((A) => {
    if (e.charCodeAt(A[0]) !== 91) return true;
    const v = H(A[0]);
    if (v === -1 || v >= A.at(-1)) return true;
    let U = "";
    for (let G = 0; G < A.length; G += 2) U += `${e.slice(A[G], A[G + 1])}
`;
    return A.splice(0, Ot(U, t.definition) * 2), A.length > 0;
  }, "resolveDefinitions"), p = s(() => {
    if (l?.type === "fence" || l?.type === "indentedCode") {
      if (l.code.indented) for (l.code.lines.length = l.code.lastNonblank; l.code.tabSpaces.length && l.code.tabSpaces.at(-2) >= l.code.lastNonblank; ) l.code.tabSpaces.length -= 2;
      t.generated(l.code, d), d = false;
    }
    l?.type === "table" && (l.bodyOpen && t.close?.("tbody"), t.close?.("table"));
    const A = l?.type === "heading" || l?.type === "paragraph" && E(l.segments);
    if (A) {
      d = true;
      const U = l;
      U.type === "heading" && t.open?.(`h${U.headingLevel}`), t.text(U.segments, U.nextLinePrefix, false, U.type), U.type === "heading" && t.close?.(`h${U.headingLevel}`);
    }
    const v = r.at(-1);
    v?.type === "footnote" && l && (A || l.type !== "paragraph") && (v.lastIsParagraph = l.type === "paragraph"), l = void 0;
  }, "finalizeLeaf"), B = s((A, v, U, G) => {
    const { columns: $, nextAligned: Y } = v, oe = Math.min(A.length / 2, $.length);
    for (let ee = 0; ee < oe; ee += 1) {
      const fe = $[ee];
      fe !== void 0 && t.alignedCell && t.wantsCode() ? t.alignedCell(G, fe) : t.open?.(G);
      const he = at(e, [A[ee * 2], A[ee * 2 + 1]]);
      t.text(he, U, true, "cell"), t.close?.(G);
    }
    const W = oe < $.length ? Y[oe] : -1;
    W !== -1 && t.alignedCell && t.wantsCode() && (t.alignedCell(G, $[W]), t.close?.(G));
  }, "reportCells"), k = s((A) => {
    const v = [];
    for (let $ = 0; $ < A.length; $ += 2) {
      let Y = A[$ + 1];
      for (; Y > A[$] && re(e.charCodeAt(Y - 1)); ) Y -= 1;
      const oe = e.charCodeAt(A[$]) === 58, W = e.charCodeAt(Y - 1) === 58;
      let ee;
      oe ? ee = W ? "center" : "left" : W && (ee = "right"), v.push(ee);
    }
    const U = v.map(() => -1);
    let G = -1;
    for (let $ = v.length - 1; $ >= 0; $ -= 1) v[$] !== void 0 && (G = $), U[$] = G;
    return { columns: v, nextAligned: U };
  }, "readAlignments"), O = s((A) => {
    if (A.tableVisited || !Yt(e, L, C)) return false;
    const v = ze(e, L, C);
    if (!v) return false;
    const { segments: U } = A, G = ze(e, U.at(-2), U.at(-1));
    if (!G || G.length !== v.length) return A.tableVisited = true, false;
    if (U.length > 2) {
      const Y = at(e, U.slice(0, -2));
      t.text(Y, A.nextLinePrefix, true, "paragraph");
    }
    d = true;
    const $ = k(v);
    return t.open?.("table"), t.open?.("thead"), t.open?.("tr"), B(G, $, A.nextLinePrefix, "th"), t.close?.("tr"), t.close?.("thead"), l = { type: "table", alignments: $, nextLinePrefix: A.nextLinePrefix, bodyOpen: false }, K(C - T, false), true;
  }, "openTableHeader"), f = s(() => {
    if (!V) for (V = true, S || p(); r.length > g; ) ne(a);
  }, "closeUnmatched"), h = s((A = true, v) => {
    f(), F !== "container" && p();
    let U = r.at(-1);
    U?.type === "list" && U.marker !== v && (ne(a), U = r.at(-1)), U?.type === "listItem" && (U.hasChild = true), R = true, F = "container", d ||= A;
  }, "addChild"), y = s((A) => {
    if (Z(), q >= be) return J || b ? false : (K(be, true), h(false), m = t.wantsCode(), l = { type: "indentedCode", code: { type: "code", infoStart: 0, infoEnd: 0, lines: [], tabSpaces: [], indented: true, lastNonblank: 0 } }, F = "indentedCode", true);
    const v = Q(L);
    if (v === 62) return K(L + 1 - T, false), se(Q(T)) && K(1, true), h(), c.push(r.length), r.push({ type: "blockquote" }), t.open?.("blockquote"), true;
    const U = v === 35 ? Dt(e, L, C) : 0;
    if (U) {
      let W = 0;
      for (; e.charCodeAt(L + W) === 35; ) W += 1;
      return K(L + U - T, false), h(), l = { type: "heading", headingLevel: W, segments: [], nextLinePrefix: te(), tableVisited: false }, F = "heading", true;
    }
    const G = v === 96 || v === 126 ? Pt(e, L, C) : 0;
    if (G) {
      const W = L - T;
      return h(false), m = t.wantsCode(), l = { type: "fence", char: v, length: Math.min(G, 255), offset: W, code: { type: "code", infoStart: L + G, infoEnd: C, lines: [], tabSpaces: [], indented: false, lastNonblank: 0 } }, K(L + G - T, false), F = "fence", true;
    }
    const $ = v === 60 ? _t(e, L, C, F === "paragraph") : 0;
    if ($) return h(false), l = { type: "html", kind: $, nextLinePrefix: te() }, F = "html", true;
    if (F === "paragraph" && (v === 61 || v === 45) && Ft(e, L, C)) {
      const W = l;
      return E(W.segments) && (W.type = "heading", W.headingLevel = v === 61 ? 1 : 2, K(C - T, false), F = "heading"), true;
    }
    if (!(F === "paragraph" && !M) && (v === 42 || v === 95 || v === 45) && Mt(e, L, C)) {
      h(false), t.generated({ type: "thematicBreak" }, d), d = false;
      const W = r.at(-1);
      return W?.type === "footnote" && (W.lastIsParagraph = false), K(C - T, false), F = "thematicBreak", true;
    }
    const Y = v === 91 && A < st ? $t(e, L, C) : void 0;
    if (Y) {
      const W = e.slice(L + 2, Y.labelEnd);
      return K(Y.end - T, false), h(false), u.push(r.length), r.push({ type: "footnote", savedMarkup: d, lastIsParagraph: false }), d = false, t.footnoteStart?.(W, L), true;
    }
    const oe = (v === 42 || v === 45 || v === 43 || v >= 48 && v <= 57) && A < st ? Vt(e, L, C, F === "paragraph") : 0;
    if (oe) {
      const W = q, ee = e.charCodeAt(L + oe - 1);
      K(L + oe - T, false);
      const fe = T, he = N, ye = w;
      for (; N - he <= 5 && se(Q(T)); ) K(1, true);
      const de = N - he;
      let Le = oe + de;
      return (de >= 5 || de < 1 || T >= C) && (Le = oe + 1, T = fe, N = he, w = ye, de > 0 && K(1, true)), h(true, ee), r.at(-1)?.type !== "list" && (r.push({ type: "list", marker: ee }), t.open?.(ee === 46 || ee === 41 ? "ol" : "ul")), r.push({ type: "listItem", indent: W + Le, hasChild: false }), t.open?.("li"), true;
    }
    if (F === "paragraph") return O(l) ? (F = "table", true) : false;
    if (F === "table" && !b) {
      if (!D) return false;
      f(), R = true;
      const W = l;
      return W.bodyOpen || (W.bodyOpen = true, t.open?.("tbody")), t.open?.("tr"), B(D, W.alignments, W.nextLinePrefix, "td"), t.close?.("tr"), K(C - T, false), F = "row", true;
    }
    return false;
  }, "openBlock"), z = s((A) => {
    C = A, T = a, N = 0, L = a, _ = 0, q = 0, b = false, w = false, V = false, a === 0 && e.charCodeAt(0) === 65279 && (T = 1), g = 0;
    let v = 0, U = 0;
    for (; g < r.length; g += 1) {
      if (Z(), T >= C) {
        const Y = r.length - 1;
        g = Math.min(c[v] ?? Y, a === C ? Y : u[U] ?? Y, Y);
      }
      const $ = r[g];
      if ($.type === "footnote") {
        if (q >= be) K(be, true);
        else if (a !== C) break;
        U += 1;
        continue;
      }
      if ($.type === "blockquote") {
        if (q > 3 || Q(L) !== 62) break;
        K(q + 1, true), se(Q(T)) && K(1, true), v += 1;
      } else {
        if ($.type === "list") continue;
        if (q >= $.indent) K($.indent, true);
        else if (b && $.hasChild) K(L - T, false);
        else break;
      }
    }
    if (S = false, D = void 0, l && g === r.length) switch (Z(), l.type) {
      case "fence": {
        if (q <= 3 && Q(L) === l.char && It(e, L, C) >= l.length) {
          p();
          return;
        }
        for (let $ = l.offset; $ > 0 && se(Q(T)); $ -= 1) K(1, true);
        S = true;
        break;
      }
      case "indentedCode": {
        q >= be ? (K(be, true), S = true) : b && (K(L - T, false), S = true);
        break;
      }
      case "html": {
        S = l.kind <= 5 || !b;
        break;
      }
      case "paragraph": {
        S = !b;
        break;
      }
      case "table": {
        D = ze(e, L, C), S = D !== void 0;
        break;
      }
    }
    M = g === r.length && (!l || S && l.type !== "table"), F = S ? l.type : "container", R = false, J = l?.type === "paragraph";
    for (let $ = 1; F !== "fence" && F !== "indentedCode" && F !== "html" && y($); $ += 1) {
      const Y = F;
      if (Y === "paragraph" || Y === "heading" || Y === "fence" || Y === "indentedCode") break;
      J = false;
    }
    Z();
    const G = T + (w ? 1 : 0);
    if (!R && l?.type === "paragraph" && !S && !b) {
      l.segments.push(G, C);
      return;
    }
    switch (f(), F) {
      case "fence":
      case "indentedCode": {
        const { code: $ } = l;
        m && (F === "indentedCode" || !R) && (w && $.tabSpaces.push($.lines.length, ce - N % ce), $.lines.push(G), b || ($.lastNonblank = $.lines.length));
        return;
      }
      case "html": {
        const $ = l;
        t.html(G, C, d, $.nextLinePrefix), d = false, $.kind <= 5 && Gt(e, L, C, $.kind) && (l = void 0);
        return;
      }
    }
    if (!b) {
      if (F === "paragraph" || F === "heading") {
        const $ = l, Y = F === "heading" ? Zt(e, L, C) : C;
        $.segments.push(L, Y);
        return;
      }
      h(false), l = { type: "paragraph", segments: [L, C], nextLinePrefix: te(), tableVisited: false };
    }
  }, "processLine");
  let P = e.indexOf(`
`), X = e.indexOf("\r");
  for (; a < e.length; ) {
    let A, v;
    if (P === -1 && X === -1 ? (A = e.length, v = 0) : X !== -1 && (P === -1 || X < P) ? (A = X, v = e.charCodeAt(X + 1) === Ee ? 2 : 1) : (A = P, v = 1), z(A), a = A + v, a > o && (l === void 0 || l.type !== "paragraph" && l.type !== "heading" || l.segments[0] > o) && i?.()) break;
    P !== -1 && P < a && (P = e.indexOf(`
`, a)), X !== -1 && X < a && (X = e.indexOf("\r", a));
  }
  for (p(); r.length > 0; ) ne(e.length);
  return d;
}, "lexBlocks"), Zt = s((e, t, n) => {
  for (; n > t && le(e.charCodeAt(n - 1)); ) n -= 1;
  let o = n;
  for (; o > t && e.charCodeAt(o - 1) === 35; ) o -= 1;
  if (o === t) return t;
  if (o === n || !se(e.charCodeAt(o - 1))) return n;
  for (; o > t && le(e.charCodeAt(o - 1)); ) o -= 1;
  return o;
}, "chopClosingSequence"), He = [161, 161, 167, 167, 171, 171, 182, 182, 183, 183, 187, 187, 191, 191, 894, 894, 903, 903, 1370, 1375, 1417, 1417, 1418, 1418, 1470, 1470, 1472, 1472, 1475, 1475, 1478, 1478, 1523, 1523, 1524, 1524, 1545, 1545, 1546, 1546, 1548, 1548, 1549, 1549, 1563, 1563, 1566, 1566, 1567, 1567, 1642, 1645, 1748, 1748, 1792, 1805, 2039, 2041, 2096, 2110, 2142, 2142, 2404, 2404, 2405, 2405, 2416, 2416, 2800, 2800, 3572, 3572, 3663, 3663, 3674, 3674, 3675, 3675, 3844, 3858, 3860, 3860, 3898, 3901, 3973, 3973, 4048, 4052, 4057, 4057, 4058, 4058, 4170, 4175, 4347, 4347, 4960, 4968, 5120, 5120, 5741, 5741, 5742, 5742, 5787, 5787, 5788, 5788, 5867, 5869, 5941, 5941, 5942, 5942, 6100, 6102, 6104, 6106, 6144, 6154, 6468, 6468, 6469, 6469, 6686, 6686, 6687, 6687, 6816, 6822, 6824, 6829, 7002, 7008, 7164, 7167, 7227, 7231, 7294, 7294, 7295, 7295, 7360, 7367, 7379, 7379, 8208, 8231, 8240, 8259, 8261, 8273, 8275, 8286, 8317, 8317, 8318, 8318, 8333, 8333, 8334, 8334, 8968, 8971, 9001, 9001, 9002, 9002, 10088, 10101, 10181, 10181, 10182, 10182, 10214, 10223, 10627, 10648, 10712, 10715, 10748, 10748, 10749, 10749, 11513, 11516, 11518, 11518, 11519, 11519, 11632, 11632, 11776, 11822, 11824, 11842, 12289, 12291, 12296, 12305, 12308, 12319, 12336, 12336, 12349, 12349, 12448, 12448, 12539, 12539, 42238, 42238, 42239, 42239, 42509, 42511, 42611, 42611, 42622, 42622, 42738, 42743, 43124, 43127, 43214, 43214, 43215, 43215, 43256, 43258, 43310, 43310, 43311, 43311, 43359, 43359, 43457, 43469, 43486, 43486, 43487, 43487, 43612, 43615, 43742, 43742, 43743, 43743, 43760, 43760, 43761, 43761, 44011, 44011, 64830, 64830, 64831, 64831, 65040, 65049, 65072, 65106, 65108, 65121, 65123, 65123, 65128, 65128, 65130, 65130, 65131, 65131, 65281, 65283, 65285, 65290, 65292, 65295, 65306, 65306, 65307, 65307, 65311, 65311, 65312, 65312, 65339, 65341, 65343, 65343, 65371, 65371, 65373, 65373, 65375, 65381, 65792, 65794, 66463, 66463, 66512, 66512, 66927, 66927, 67671, 67671, 67871, 67871, 67903, 67903, 68176, 68184, 68223, 68223, 68336, 68342, 68409, 68415, 68505, 68508, 69703, 69709, 69819, 69819, 69820, 69820, 69822, 69825, 69952, 69955, 70004, 70004, 70005, 70005, 70085, 70088, 70093, 70093, 70200, 70205, 70854, 70854, 71105, 71113, 71233, 71235, 74864, 74868, 92782, 92782, 92783, 92783, 92917, 92917, 92983, 92987, 92996, 92996, 113823, 113823], Ue = s((e) => e === 9 || e === 10 || e === 12 || e === 13 || e === 32 || e === 160 || e === 5760 || e >= 8192 && e <= 8202 || e === 8239 || e === 8287 || e === 12288, "isUnicodeSpace"), Re = s((e) => {
  if (e < 128) return ie(e);
  let t = 0, n = He.length / 2;
  for (; t < n; ) {
    const o = Math.floor((t + n) / 2);
    if (e < He[o * 2]) n = o;
    else if (e > He[o * 2 + 1]) t = o + 1;
    else return true;
  }
  return false;
}, "isUnicodePunctuation"), lt = s((e) => !Ue(e) && !Re(e), "isHostChar"), ct = s((e, t, n) => {
  let o = 0, i = 0, r = 0, c = t + 1;
  const u = e.charCodeAt(e.length - 1), l = e.length - (u < 128 && u !== 0 ? 1 : 0), m = e.charCodeAt(t);
  if (m >= 128 || m === 0) return n ? t + 1 : -1;
  for (; c < l; ) {
    let d = e.charCodeAt(c);
    if (d === 92 && c + 1 < l && (c += 1, d = e.charCodeAt(c)), d === 95) r += 1;
    else if (d === 46) i = r, r = 0, o += 1;
    else if (d >= 128 || d === 0 || !lt(d) && d !== 45) break;
    c += 1;
  }
  return (i > 0 || r > 0) && o <= 10 || !n && o === 0 ? -1 : c;
}, "checkDomain"), xt = s((e, t) => {
  let n;
  if (e.charCodeAt(t) === 119) {
    const c = e.charCodeAt(t - 1);
    if (t > 0 && !re(c) && c !== 42 && c !== 95 && c !== 126 && c !== 40 || !e.startsWith("www.", t)) return -1;
    n = ct(e, t, false);
  } else {
    if (e.charCodeAt(t + 1) !== 47 || e.charCodeAt(t + 2) !== 47) return -1;
    let c = t;
    for (; c > 0 && ae(e.charCodeAt(c - 1)); ) c -= 1;
    const u = e.slice(c, t).toLowerCase(), l = e.codePointAt(t + 3);
    if (u !== "http" && u !== "https" && u !== "ftp" || l === void 0 || !lt(l)) return -1;
    n = ct(e, t + 3, true);
  }
  if (n === -1) return -1;
  let o = n, i = 0, r = 0;
  for (; o < e.length && !re(e.charCodeAt(o)) && e.charCodeAt(o) !== 60; ) i += +(e.charCodeAt(o) === 40), r += +(e.charCodeAt(o) === 41), o += 1;
  for (; o > t; ) switch (e.charCodeAt(o - 1)) {
    case 41: {
      if (r <= i) return o;
      r -= 1, o -= 1;
      break;
    }
    case 59: {
      let u = o - 2;
      for (; u > t && ae(e.charCodeAt(u)); ) u -= 1;
      o = u < o - 2 && e.charCodeAt(u) === 38 ? u : o - 1;
      break;
    }
    case 63:
    case 33:
    case 46:
    case 44:
    case 58:
    case 42:
    case 95:
    case 126:
    case 39:
    case 34: {
      o -= 1;
      break;
    }
    default:
      return o;
  }
  return -1;
}, "matchBareAutolink"), en = s((e) => {
  let t;
  return { push: s((i) => {
    const r = e.charCodeAt(i);
    let c = i + 1;
    for (; e.charCodeAt(c) === r && (r !== 126 || c - i < 100); ) c += 1;
    let u = i - 1, l = c;
    if (r !== 126) {
      for (; u >= 0 && e.charCodeAt(u) === 126; ) u -= 1;
      for (; e.charCodeAt(l) === 126; ) l += 1;
    }
    ge(e.charCodeAt(u)) && pe(e.charCodeAt(u - 1)) && (u -= 1);
    const m = e.codePointAt(u) ?? 10, d = e.codePointAt(l) ?? 10, C = Ue(m), T = Ue(d), N = Re(m), L = Re(d), _ = !T && (!L || C || N), q = !C && (!N || T || L), b = _ && (r !== 95 || !q || N), w = q && (r !== 95 || !_ || L), a = c - i;
    if (!b && !w || r === 126 && a > 2) return { end: c, delimiter: void 0 };
    const g = { code: r, position: c, length: a, remaining: a, canOpen: b, canClose: w, previous: t, next: void 0, indexed: false, below: void 0, opens: [], closes: [] };
    return t && (t.next = g), t = g, { end: c, delimiter: g };
  }, "push"), process: s((i) => {
    let r, c = t;
    for (; c && c.position >= i; ) r = c, c = c.previous;
    if (!r) return;
    const u = [], l = [i, i, i, i, i, i, i, i, i], m = s((N) => N === 42 ? 0 : N === 95 ? 1 : 2, "character"), d = s((N) => m(N.code) * 6 + N.length % 3 * 2 + Number(N.canClose), "bucketIndex"), C = s((N) => {
      if (N.canOpen) {
        const L = d(N);
        N.below = u[L], u[L] = N, N.indexed = true;
      }
    }, "add"), T = s((N) => {
      N.indexed && (u[d(N)] = N.below, N.indexed = false), N.previous && (N.previous.next = N.next), N.next ? N.next.previous = N.previous : t = N.previous;
    }, "remove");
    for (; r; ) {
      if (!r.canClose) {
        C(r), r = r.next;
        continue;
      }
      const N = m(r.code), L = r.length % 3, _ = N * 3 + L;
      let q;
      for (let w = 0; w < 3; w += 1) for (let a = 0; a < 2; a += 1) {
        if ((r.canOpen || a === 1) && L !== 0 && (w + L) % 3 === 0) continue;
        const g = u[N * 6 + w * 2 + a];
        g && g.position >= l[_] && (!q || g.position > q.position) && (q = g);
      }
      if (!q) {
        l[_] = r.position;
        const { next: w } = r;
        r.canOpen ? C(r) : T(r), r = w;
        continue;
      }
      if (r.code === 126) q.remaining === r.remaining && (q.opens.push("del"), r.closes.push("del"));
      else {
        const w = q.remaining >= 2 && r.remaining >= 2 ? 2 : 1, a = w === 2 ? "strong" : "em";
        q.remaining -= w, r.remaining -= w, q.opens.push(a), r.closes.push(a);
      }
      let b = r.previous;
      for (; b && b !== q; ) {
        const { previous: w } = b;
        T(b), b = w;
      }
      if ((r.code === 126 || q.remaining === 0) && T(q), r.code === 126 || r.remaining === 0) {
        const { next: w } = r;
        T(r), r = w;
      }
    }
    for (; t && t.position >= i; ) T(t);
  }, "process") };
}, "createEmphasis"), tn = s((e, t) => e >= 48 && e <= 57 ? e - 48 : t && e >= 65 && e <= 70 ? e - 55 : t && e >= 97 && e <= 102 ? e - 87 : -1, "digitValue"), nn = s((e, t) => {
  let n = t + 2;
  const o = e[n] === "x" || e[n] === "X";
  o && (n += 1);
  const i = n;
  let r = 0;
  for (; n < e.length; ) {
    const c = tn(e.charCodeAt(n), o);
    if (c < 0) break;
    r = Math.min(1114112, r * (o ? 16 : 10) + c), n += 1;
  }
  if (!(n === i || n - i > 8 || e[n] !== ";")) return { code: r !== 0 && r < 1114112 && !Ke(r) ? r : 65533, end: n };
}, "numericEntity"), on = [[1, 9, "Tab"], [1, 10, "NewLine"], [1, 33, "excl"], [1, 34, "QUOT quot"], [1, 35, "num"], [1, 36, "dollar"], [1, 37, "percnt"], [1, 38, "AMP amp"], [1, 39, "apos"], [1, 40, "lpar"], [1, 41, "rpar"], [1, 42, "ast midast"], [1, 43, "plus"], [1, 44, "comma"], [1, 46, "period"], [1, 47, "sol"], [1, 58, "colon"], [1, 59, "semi"], [1, 60, "LT lt"], [1, 61, "equals"], [1, 62, "GT gt"], [1, 63, "quest"], [1, 64, "commat"], [1, 91, "lbrack lsqb"], [1, 92, "bsol"], [1, 93, "rbrack rsqb"], [1, 94, "Hat"], [1, 95, "UnderBar lowbar"], [1, 96, "DiacriticalGrave grave"], [1, 123, "lbrace lcub"], [1, 124, "VerticalLine verbar vert"], [1, 125, "rbrace rcub"], [2, 102, "fjlig"], [4, 60, "nvlt"], [4, 61, "bne"], [4, 62, "nvgt"]];
let Oe;
const rn = s((e) => {
  if (!Oe) {
    Oe = /* @__PURE__ */ new Map();
    for (const t of on) for (const n of t[2].split(" ")) Oe.set(n, t);
  }
  return Oe.get(e);
}, "namedEntity"), ft = s((e, t) => {
  let n = t + 1;
  for (; n < e.length && n - t <= 31 && ue(e.charCodeAt(n)); ) n += 1;
  return n - t >= 3 && n < e.length && e.charCodeAt(n) === 59 ? n : -1;
}, "scanEntityName"), De = s((e, t) => {
  if (e.startsWith("&#", t)) {
    const o = nn(e, t);
    if (!o) return;
    const { code: i, end: r } = o;
    let c;
    return i === 65534 || i === 65535 || i < 128 ? c = 1 : i < 2048 ? c = 2 : i < 65536 ? c = 3 : c = 4, { bytes: c, code: i, end: r };
  }
  const n = ft(e, t);
  if (n !== -1) {
    const o = rn(e.slice(t + 1, n));
    if (o) return { bytes: o[0], code: o[1], end: n };
  }
}, "decodeEntity"), ht = s((e, t, n) => e.charCodeAt(t + 1) === 35 ? String.fromCodePoint(n.code === 65534 || n.code === 65535 ? 65533 : n.code) : e.startsWith("fjlig;", t + 1) ? "fj" : String.fromCharCode(n.code) + (n.bytes > 1 ? "\uFFFD" : ""), "decodedUnit"), ut = s((e) => {
  let t = "";
  for (let n = 0; n < e.length; n += 1) {
    const o = e.charCodeAt(n) === 38 ? De(e, n) : void 0;
    if (!o) {
      t += e[n];
      continue;
    }
    t += ht(e, n, o), n = o.end;
  }
  return t;
}, "decodeEntities"), sn = s((e) => {
  if (!e.includes("\\")) return e;
  let t = "";
  for (let n = 0; n < e.length; n += 1) e.charCodeAt(n) === 92 && ie(e.charCodeAt(n + 1)) && (n += 1), t += e[n];
  return t;
}, "unescapeBackslashes"), an = s((e, t) => {
  const n = e.charCodeAt(t);
  if (n === 94) return t + 1;
  if (n === 92) return e.charCodeAt(t + 1) === 94 ? t + 2 : -1;
  if (n === 38) {
    const o = De(e, t);
    return o?.code === 94 && o.bytes === 1 ? o.end + 1 : -1;
  }
  return -1;
}, "scanCaret"), ln = s((e, t, n) => {
  let o = "";
  for (let i = t; i < n; i += 1) {
    const r = e.charCodeAt(i);
    if (r === 92 && i + 1 < n && ie(e.charCodeAt(i + 1))) {
      i += 1, o += e[i];
      continue;
    }
    const c = r === 38 ? De(e, i) : void 0;
    if (c && c.end < n) {
      if (e.charCodeAt(i + 1) === 35) o += String.fromCodePoint(c.code);
      else if (c.bytes === 1) o += String.fromCharCode(c.code);
      else if (e.startsWith("fjlig;", i + 1)) o += "fj";
      else return;
      i = c.end;
      continue;
    }
    const u = r === 38 ? ft(e, i) : -1;
    if (u !== -1 && u < n) return;
    o += r === 0 ? "\uFFFD" : e[i];
  }
  return o;
}, "decodeReferenceLabel"), cn = s((e) => {
  let t = 0, n = 0;
  for (let b = 0; b < e.length; b += 1) {
    const w = e.charCodeAt(b);
    w === 92 && ie(e.charCodeAt(b + 1)) ? b += 1 : w === 40 || w === 41 ? t += 1 : re(w) && (n += 1);
  }
  const o = t * 2 + 2, i = new Int32Array(o), r = new Int32Array(o), c = new Int32Array(n);
  let u = 0, l = 0;
  for (let b = 0; b < e.length; b += 1) {
    const w = e.charCodeAt(b);
    w === 92 && ie(e.charCodeAt(b + 1)) ? b += 1 : w === 40 ? (l += 1, i[l + t + 1] += 1) : w === 41 ? (r[l + t + 1] += 1, l -= 1) : re(w) && (c[u] = b, u += 1);
  }
  for (let b = 1; b < o; b += 1) i[b] += i[b - 1], r[b] += r[b - 1];
  const m = new Int32Array(i[o - 1]), d = new Int32Array(r[o - 1]), C = i.slice(), T = r.slice();
  l = 0;
  for (let b = 0; b < e.length; b += 1) {
    const w = e.charCodeAt(b);
    if (w === 92 && ie(e.charCodeAt(b + 1))) b += 1;
    else if (w === 40) {
      l += 1;
      const a = l + t;
      m[C[a]] = b, C[a] += 1;
    } else if (w === 41) {
      const a = l + t;
      d[T[a]] = b, T[a] += 1, l -= 1;
    }
  }
  C.set(i), T.set(r);
  const N = s((b, w, a, g, S) => {
    if (g < 0 || g + 1 >= o) return e.length;
    let D = a[g];
    const M = w[g + 1];
    for (; D < M && b[D] < S; ) D += 1;
    return a[g] = D, D < M ? b[D] : e.length;
  }, "next");
  let L = 0, _ = 0, q = 0;
  return (b) => {
    for (; _ < b; ) {
      const M = e.charCodeAt(_);
      M === 92 && ie(e.charCodeAt(_ + 1)) ? _ += 2 : (q += +(M === 40) - +(M === 41), _ += 1);
    }
    for (; L < n && c[L] < b; ) L += 1;
    const w = L < n ? c[L] : e.length, a = q + t, g = N(d, r, T, a, b), S = N(m, i, C, a + 33, b), D = Math.min(w, g);
    return D === e.length || S < D || w === b ? -1 : D;
  };
}, "indexDestinations"), fn = s((e) => ue(e) || e === 43 || e === 46 || e === 45, "isSchemeChar"), hn = ".!#$%&'*+/=?^_`{|}~-", un = s((e, t) => ue(e.charCodeAt(t)) || hn.includes(e[t]), "isEmailLocalChar"), dn = s((e, t) => {
  if (!ae(e.charCodeAt(t))) return -1;
  let n = t + 1;
  for (; fn(e.charCodeAt(n)); ) n += 1;
  const o = n - t;
  if (o < 2 || o > 32 || e.charCodeAt(n) !== 58) return -1;
  for (n += 1; n < e.length; n += 1) {
    const i = e.charCodeAt(n);
    if (i === 62) return n + 1;
    if (i !== 0 && i <= 32 || i === 60) return -1;
  }
  return -1;
}, "matchUriAutolink"), pn = s((e, t) => {
  let n = t;
  for (; n < e.length && un(e, n); ) n += 1;
  if (n === t || e.charCodeAt(n) !== 64) return -1;
  for (; ; ) {
    const o = n + 1;
    for (n = o; ue(e.charCodeAt(n)) || e.charCodeAt(n) === 45; ) n += 1;
    if (n === o || n - o > 63 || !ue(e.charCodeAt(o)) || !ue(e.charCodeAt(n - 1))) return -1;
    const i = e.charCodeAt(n);
    if (i === 62) return n + 1;
    if (i !== 46) return -1;
  }
}, "matchEmailAutolink"), gn = s((e) => {
  const t = s((d) => {
    for (; le(e.charCodeAt(d)); ) d += 1;
    return d;
  }, "skipInlineSpaces");
  let n, o = 0, i = 0, r = 0, c = 0, u = 0;
  const l = s((d) => {
    if (!n && u > e.length && (n = cn(e)), n) return n(d);
    const C = qe(e, d);
    return u += (C === -1 ? e.length : C) - d + 1, C;
  }, "scanUnbracketedDestination");
  return { matchLinkTail: s((d) => {
    if (e.charCodeAt(d) !== 40) return -1;
    const C = t(d + 1);
    let T;
    if (e.charCodeAt(C) === 60 ? T = qe(e, C) : T = l(C), T === -1) return -1;
    const N = t(T), L = N === T ? -1 : xe(e, N), _ = t(L === -1 ? N : L);
    return e.charCodeAt(_) !== 41 ? -1 : (o = C, i = T, r = N, c = L === -1 ? N : L, _ + 1);
  }, "matchLinkTail"), inlineTarget: s(() => ({ destination: e.slice(o, i), title: e.slice(r, c) }), "inlineTarget") };
}, "createLinkTailMatcher"), Cn = s((e, t) => {
  const n = dn(e, t + 1);
  return n === -1 ? pn(e, t + 1) : n;
}, "matchAutolink"), dt = s((e, t, n) => {
  for (; t < e.length; ) if (e.charCodeAt(t) !== n) t += 1;
  else if (e.charCodeAt(t + 1) !== n) t += 2;
  else {
    if (e.charCodeAt(t + 2) === 62) return t + 3;
    t += 3;
  }
  return -1;
}, "skipToRunClose"), bn = s((e, t) => {
  for (; t < e.length; ) if (e.charCodeAt(t) !== 63) t += 1;
  else {
    if (e.charCodeAt(t + 1) === 62) return t + 2;
    t += 2;
  }
  return -1;
}, "skipProcessingInstruction"), mn = s((e) => {
  let t = false, n = false, o = false, i = false;
  return s((c) => {
    if (c + 3 > e.length) return -1;
    const u = e.charCodeAt(c + 1);
    if (u === 33) {
      if (t) return -1;
      const l = e.charCodeAt(c + 2);
      if (l === 45 && e.charCodeAt(c + 3) === 45) {
        if (e.charCodeAt(c + 4) === 62) return c + 5;
        if (e.charCodeAt(c + 4) === 45 && e.charCodeAt(c + 5) === 62) return c + 6;
        const C = dt(e, c + 4, 45);
        return t = C === -1, C;
      }
      if (l === 91) {
        if (n || !e.startsWith("CDATA[", c + 3)) return -1;
        const C = dt(e, c + 9, 93);
        return n = C === -1, C;
      }
      if (o || !Te(l)) return -1;
      let m = c + 3;
      for (; Te(e.charCodeAt(m)); ) m += 1;
      if (m >= e.length || !le(e.charCodeAt(m))) return -1;
      const d = e.indexOf(">", m);
      return o = d === -1, d === -1 ? -1 : d + 1;
    }
    if (u === 63) {
      if (i) return -1;
      const l = bn(e, c + 2);
      return i = l === -1, l;
    }
    return u === 47 || ae(u) ? ot(e, c, e.length) : -1;
  }, "matchRawHtml");
}, "createRawHtmlMatcher"), An = 80, pt = s((e, t, n, o, i, r) => {
  const c = mn(e);
  let u;
  const l = [];
  let m = 0;
  const d = /* @__PURE__ */ new Map();
  let C = false;
  const T = s(() => {
    const E = [];
    let p = e.indexOf("`");
    for (; p !== -1; ) {
      const B = p;
      for (; e.charCodeAt(p) === 96; ) p += 1;
      E.push(B), l.push(p - B), p = e.indexOf("`", p);
    }
    return E;
  }, "findRuns"), N = s((E) => {
    for (u ??= T(); u[m] + l[m] <= E; ) m += 1;
    const p = u[m] + l[m] - E;
    if (p > An || C && (d.get(p) ?? 0) <= E + p) return E + p;
    let B = m + 1;
    for (; B < u.length && l[B] !== p; ) d.set(l[B], u[B]), B += 1;
    return B === u.length ? (C = true, E + p) : (d.set(p, u[B]), u[B] + p);
  }, "skipBackticks"), { matchLinkTail: L, inlineTarget: _ } = gn(e);
  let q;
  const b = [], w = [];
  let a, g = 0, S = true, D = 0, M = 0;
  const V = i !== void 0, F = [], R = s((E) => {
    V && F.push(E);
  }, "addBoundary"), J = i?.count ? [] : void 0, Q = s((E) => {
    b.length > 0 && (b.at(-1).bracketAfter = true);
    const p = r && (o && !E || w.length > 0 || !r.inData()) ? { type: "link", image: E, state: "pending", target: void 0 } : void 0, B = H + (E ? 2 : 1), k = an(e, B);
    k !== -1 && (M += 1), b.push({ image: E, spanStart: w.length, link: p, position: B, bracketAfter: false, caret: k, boundaryStart: F.length, referenceStart: J?.length ?? 0 }), p && (w.push(p), D += 1), E ? g += 1 : S = false;
  }, "pushBracket"), Z = s((E) => {
    w.length = E.spanStart, a?.process(E.position);
    let p;
    if (i) {
      const B = F.length > E.boundaryStart ? F[E.boundaryStart] : H - 1, k = ln(e, E.caret, B);
      p = k === void 0 ? void 0 : i.find(k);
    }
    J && (J.length = E.referenceStart, p !== void 0 && J.push(p)), p !== void 0 && i.emit && w.push({ type: "footnote", definition: p });
  }, "addReference"), K = s((E, p) => {
    r && (w.length > 0 ? w.push({ type: "autolink", start: E, end: p }) : r.inData() || r.autolink(e, E, p));
  }, "addAutolink"), te = s(() => {
    if (w.length === 0) return;
    const E = [], p = s((B, k) => {
      k || E.pop(), (B !== "strong" || E.at(-1) !== "strong") && o(B, k), k && E.push(B);
    }, "emitElement");
    for (const B of w) switch (B.type) {
      case "link": {
        B.state === "open" && B.image ? r.image(B.target) : B.state === "open" ? (E.push("a"), r.open(B.target)) : B.state === "close" && (E.pop(), r.close());
        break;
      }
      case "delimiter": {
        const { opens: k, closes: O } = B.delimiter;
        for (const f of O) p(f, false);
        for (let f = k.length - 1; f >= 0; f -= 1) p(k[f], true);
        break;
      }
      case "footnote": {
        i.emit(B.definition);
        break;
      }
      case "autolink": {
        r.autolink(e, B.start, B.end);
        break;
      }
      default:
        t(B.start, B.end);
    }
    w.length = 0;
  }, "flushSpans"), ne = s((E, p) => {
    const B = e.charCodeAt(p) === 91 ? Xe(e, p, true) : -1;
    let k = B === -1 ? "" : e.slice(p + 1, B - 1), O = 0;
    for (; O < k.length && re(k.charCodeAt(O)); ) O += 1;
    const f = O === k.length;
    if ((B === -1 || f) && !E.bracketAfter && (k = e.slice(E.position, p - 1)), B === -1 && E.bracketAfter) return -1;
    const h = n(k);
    return h ? (q = h, B === -1 ? p : B) : -1;
  }, "matchReference");
  let H = 0;
  for (; H < e.length; ) switch (e.charCodeAt(H)) {
    case 42:
    case 95:
    case 126: {
      if (!o) {
        H += 1;
        break;
      }
      a ??= en(e);
      const { end: p, delimiter: B } = a.push(H);
      B && w.push({ type: "delimiter", delimiter: B }), H = p;
      break;
    }
    case 58:
    case 119: {
      const p = b.length === 0 ? xt(e, H) : -1;
      if (p === -1) {
        H += 1;
        break;
      }
      K(H, p), H = p;
      break;
    }
    case 33: {
      e.charCodeAt(H + 1) === 91 && e.charCodeAt(H + 2) !== 94 ? (Q(true), H += 2) : H += 1;
      break;
    }
    case 91: {
      Q(false), H += 1;
      break;
    }
    case 93: {
      const p = b.pop();
      if (H += 1, !p) break;
      p.caret !== -1 && (M -= 1), p.link && (D -= 1);
      let B = -1, k = false;
      (p.image || !S) && (B = L(H), B === -1 ? B = ne(p, H) : q = void 0, k = B === -1 && p.caret !== -1 && p.caret < H - 1), B !== -1 ? (H = B, a?.process(p.position), p.link && (p.link.state = "open", p.link.target = q ?? _()), p.image ? w.length = p.spanStart + (p.link ? 1 : 0) : (S = true, r && (w.length > 0 || !r.inData()) && w.push({ type: "link", image: false, state: "close", target: void 0 }))) : k && Z(p), (B !== -1 || k) && M > 0 && V && (F.length = p.boundaryStart, F.push(p.position - (p.image ? 2 : 1))), p.image && (g -= 1), g === 0 && M === 0 && D === 0 && !a && (!o || b.length === 0) && te();
      break;
    }
    case 92: {
      const p = e.charCodeAt(H + 1);
      p === 10 && M > 0 && R(H), H += ie(p) ? 2 : 1;
      break;
    }
    case 10: {
      M > 0 && R(H), H += 1;
      break;
    }
    case 96: {
      const p = N(H);
      M > 0 && p !== u[m] + l[m] && R(H), H = p;
      break;
    }
    case 60: {
      const p = Cn(e, H);
      if (p !== -1) {
        M > 0 && R(H), K(H, p), H = p;
        break;
      }
      const B = c(H);
      B === -1 ? H += 1 : (M > 0 && R(H), g > 0 || M > 0 || D > 0 || o && (b.length > 0 || a) ? w.push({ type: "html", start: H, end: B }) : t(H, B), H = B);
      break;
    }
    default:
      H += 1;
  }
  if (a?.process(0), te(), J) for (const E of J) i.count(E);
}, "lexInline"), gt = s((e, t, n, o = false, i) => {
  let r = "";
  for (let c = 0; c < t.length; c += 2) {
    c > 0 && (r += `
`), n?.push(r.length);
    const u = t[c], l = t[c + 1], m = e.slice(u, l);
    let d = o ? m.indexOf(String.raw`\|`) : -1;
    if (d === -1) {
      r += m;
      continue;
    }
    let C = 0;
    for (; d !== -1; ) r += m.slice(C, d), i?.push(r.length), C = d + 1, d = m.indexOf(String.raw`\|`, C + 1);
    r += m.slice(C);
  }
  return r;
}, "joinText"), Qe = s((e, t, n) => {
  for (; t < e.length && e[t] < n; ) t += 1;
  return t;
}, "advanceRemoved"), Se = s((e) => e.toWellFormed().replaceAll("\0", "\uFFFD"), "normalizeInput"), Pe = s((e) => e.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"), "escapeHtml"), kn = s((e) => e >= 97 && e <= 122 || e >= 63 && e <= 90 || e >= 40 && e <= 59 || e === 33 || e === 35 || e === 36 || e === 37 || e === 61 || e === 95 || e === 126, "isHrefSafe"), wn = new TextEncoder(), me = s((e) => {
  let t = "";
  for (const n of wn.encode(Se(e))) kn(n) ? t += String.fromCharCode(n) : n === 38 ? t += "&amp;" : n === 39 ? t += "&#x27;" : t += `%${n.toString(16).toUpperCase().padStart(2, "0")}`;
  return t;
}, "escapeHref"), Ct = s((e, t) => {
  let n = false;
  for (let o = 0; o < e.length; o += 1) {
    const i = o;
    let r = e.charCodeAt(o), c = Ne(e, o), u = e[o];
    if (r === 38) {
      const m = De(e, o);
      m && (r = m.code, c = m.bytes, u = ht(e, i, m), o = m.end);
    }
    const l = n;
    n = false, l ? (ie(r) || t("\\", 1), t(u, c)) : r === 92 ? n = true : t(u, c);
  }
  n && t("\\", 1);
}, "walkClean"), bt = s((e) => {
  let t = "";
  return Ct(e, (n) => {
    t += n;
  }), t;
}, "cleanText"), mt = s((e) => {
  const t = e.charCodeAt(0) === 60 ? e.slice(1, -1) : e;
  return bt($e(t));
}, "cleanUrl"), Sn = s((e) => {
  const t = e.charCodeAt(0), n = e.charCodeAt(e.length - 1), o = e.length >= 2 && (t === 34 && n === 34 || t === 39 && n === 39 || t === 40 && n === 41);
  return bt(o ? e.slice(1, -1) : e);
}, "cleanTitle"), At = s((e) => {
  let t = 0;
  return Ct(e, (n, o) => {
    t += o;
  }), t;
}, "cleanSize"), kt = s((e) => {
  const t = Sn(e);
  return t ? ` title="${Pe(Se(t))}"` : "";
}, "titleAttribute"), vn = s(({ destination: e, title: t }) => `<a href="${me(mt(e))}"${kt(t)}>`, "renderLinkOpen"), yn = s(({ destination: e, title: t }) => `<img src="${me(mt(e))}" alt=""${kt(t)} />`, "renderImage"), Ln = s((e, t, n) => {
  let o, i;
  switch (e.charCodeAt(t)) {
    case 60: {
      const r = e.slice(t + 1, n - 1);
      i = ut(r), o = (r.includes(":") ? "" : "mailto:") + i;
      break;
    }
    case 119: {
      i = e.slice(t, n), o = `http://${i}`;
      break;
    }
    default: {
      let r = t;
      for (; r > 0 && ae(e.charCodeAt(r - 1)); ) r -= 1;
      i = e.slice(r, n), o = i;
    }
  }
  return `<a href="${me(o)}">${Pe(Se(i))}</a>`;
}, "renderAutolink"), We = s((e, t = false) => {
  let n = 0;
  for (let o = 0; o < e.length; o += 1) {
    const i = e.charCodeAt(o);
    n += i > 0 && i < 128 || t && i === 0 ? 1 : Ne(e, o);
  }
  return n;
}, "byteLength"), Tn = s(({ destination: e, title: t }) => {
  const n = e.startsWith("<") ? e.slice(1, -1) : e;
  return At($e(n)) + At(t.slice(1, -1));
}, "definitionSize"), Nn = s((e, t, n) => {
  let o = 0;
  for (const { destination: T, title: N } of t.values()) o = Math.max(o, 2 * (We(T) + We(N)));
  let i = 0, r = -1;
  for (; r = e.indexOf("]", r + 1), r !== -1; ) i += 1;
  let c = 1e5, u = i * o > c;
  if (u && (c = Math.max(We(e, true), c), u = i * o > c), !u && !n) return;
  const l = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map();
  let d = 0;
  const C = Ge(e, false);
  return it(e, { html: s(() => {
  }, "html"), generated: s(() => {
  }, "generated"), wantsCode: s(() => false, "wantsCode"), text: s((T, N, L) => {
    if (T.length === 0 || !C.hasBrackets(T)) return;
    const _ = T[0];
    let q = 0;
    pt(gt(e, T, void 0, L), () => {
    }, (b) => {
      const w = q;
      q += 1;
      const a = ke(b), g = t.get(a);
      if (!g || !u) return g;
      let S = m.get(a);
      if (S === void 0 && (S = Tn(g), m.set(a, S)), S > c - d) {
        let D = l.get(_);
        D || (D = /* @__PURE__ */ new Set(), l.set(_, D)), D.add(w);
        return;
      }
      return d += S, g;
    }, void 0, n);
  }, "text") }), u ? l : void 0;
}, "createReferenceBudget"), Bn = /* @__PURE__ */ new Set(["area", "base", "basefont", "bgsound", "br", "col", "embed", "frame", "frameset", "hr", "image", "img", "input", "isindex", "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr"]), On = /* @__PURE__ */ new Set(["foreignobject", "desc", "title"]), Dn = /* @__PURE__ */ new Set(["mi", "mo", "mn", "ms", "mtext"]), wt = /* @__PURE__ */ new Set(["address", "article", "aside", "blockquote", "center", "details", "dir", "div", "dl", "fieldset", "figcaption", "figure", "footer", "header", "hgroup", "main", "menu", "nav", "ol", "p", "section", "summary", "ul", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "listing", "form", "li", "dd", "dt", "table", "hr"]), je = /* @__PURE__ */ new Set(["table", "caption", "colgroup", "tbody", "td", "tfoot", "th", "thead", "tr"]), _e = /* @__PURE__ */ new Set(["applet", "caption", "table", "td", "th", "marquee", "object", "template"]), St = /* @__PURE__ */ new Set([...wt, ...je, ..._e, "button", "noscript"]), vt = /* @__PURE__ */ new Set(["a", "b", "big", "code", "em", "font", "i", "nobr", "s", "small", "strike", "strong", "tt", "u"]), ve = s((e) => e.length === 2 && e[0] === "h" && e[1] >= "1" && e[1] <= "6", "isHeading"), Pn = s(() => {
  const e = [], t = [], n = { children: /* @__PURE__ */ new Map() }, o = s((a, g, S = false) => {
    if (S && a.length <= 16383) {
      const V = n.children.get(a);
      V.children?.size ? V.indexes = void 0 : n.children.delete(a);
      return;
    }
    let D = n;
    const M = S ? [] : void 0;
    for (let V = 0; V < a.length; V += 16383) {
      const F = a.slice(V, V + 16383);
      M?.push([D, F]);
      let R = D.children?.get(F);
      if (!R) {
        if (!g) return;
        R = {}, (D.children ??= /* @__PURE__ */ new Map()).set(F, R);
      }
      D = R;
    }
    if (M) for (D.indexes = void 0; M.length > 0 && !D.children?.size && !D.indexes; ) {
      const [V, F] = M.pop();
      V.children.delete(F), D = V;
    }
    return D;
  }, "nameNode"), i = s((a) => o(a, false)?.indexes, "findIndexes"), r = s((a) => a.integrationPoint === a.position, "isIntegrationPoint"), c = s((a) => {
    const g = e.at(-1);
    return g?.foreign ? !r(g) || a === "svg" || a === "math" || e[g.root].name === "math" && (a === "mglyph" || a === "malignmark") : a === "svg" || a === "math";
  }, "opensForeign"), u = s((a, g) => {
    const S = e.at(-1), D = o(a, true);
    D.indexes ??= [];
    const { indexes: M } = D, V = e.length, F = g && !!S?.foreign && (r(S) ? a !== "svg" && a !== "math" : a !== "svg" || S.name !== "annotation-xml" || e[S.root].name !== "math"), R = g ? F ? S.root : V : -1, J = g && (e[R]?.name ?? a) === "svg" ? On.has(a) : g && Dn.has(a), Q = !g && a.length <= 10, Z = J || (g ? a === "annotation-xml" && e[R].name === "math" : Q && _e.has(a)), K = Z || Q && St.has(a), te = { name: a, foreign: g, root: R, integrationPoint: J ? V : S?.integrationPoint ?? -1, html: g ? S?.html ?? -1 : V, special: K ? V : S?.special ?? -1, specialBlock: K && a !== "address" && a !== "div" && a !== "p" ? V : S?.specialBlock ?? -1, scope: Z ? V : S?.scope ?? -1, buttonScope: Z || !g && a === "button" ? V : S?.buttonScope ?? -1, listScope: Z || !g && (a === "ol" || a === "ul") ? V : S?.listScope ?? -1, position: V, indexes: M };
    return e.push(te), M.push(te.position), !g && ve(a) && t.push(V), te;
  }, "push"), l = s((a) => {
    for (; e.length > a; ) {
      const g = e.pop();
      !g.foreign && ve(g.name) && t.pop(), g.indexes.pop(), g.indexes.length === 0 && o(g.name, false, true);
    }
  }, "popTo"), m = s((a) => e[a.position] === a, "isOpen"), d = [], C = [], T = s(() => {
    for (; C.length > 0 && !m(C.at(-1).element); ) d.length = C.pop().start;
    return C.at(-1)?.start ?? 0;
  }, "activeStart"), N = s(() => {
    const a = T();
    let g = d.length;
    for (; g > a && !m(d[g - 1]); ) g -= 1;
    for (; g < d.length; g += 1) d[g] = u(d[g].name, false);
  }, "reconstruct"), L = s((a) => {
    const g = T();
    let S = 0, D = -1;
    for (let M = d.length - 1; M >= g; M -= 1) d[M].name === a.name && (S += 1, D = M);
    S >= 3 && d.splice(D, 1), d.push(a);
  }, "addFormatting"), _ = s(() => {
    const a = i("p")?.at(-1);
    a !== void 0 && a >= e.at(-1).buttonScope && l(a);
  }, "closeParagraph"), q = s((a, g) => {
    if (g && je.has(a) && a !== "table") {
      const S = i("table")?.at(-1);
      return S !== void 0 && !e[S].foreign;
    }
    if (g && wt.has(a)) {
      const S = a === "li" ? i("li")?.at(-1) : a === "dd" || a === "dt" ? Math.max(i("dd")?.at(-1) ?? -1, i("dt")?.at(-1) ?? -1) : -1;
      S !== void 0 && S !== -1 && S >= e.at(-1).specialBlock && l(S), _();
      const D = e.at(-1);
      return ve(a) && D && !D.foreign && ve(D.name) && l(D.position), true;
    }
    if (a === "button") {
      const S = i("button")?.at(-1);
      S !== void 0 && S >= e.at(-1).scope && l(S);
    }
    return a !== "template" && N(), true;
  }, "startTag"), b = s((a) => {
    const g = e.at(-1);
    let S = i(a)?.at(-1);
    if (S !== void 0 && g.foreign && S > g.html) {
      l(S);
      return;
    }
    ve(a) && (S = t.at(-1));
    const D = a.length <= 10;
    if (D && vt.has(a)) {
      const V = T();
      let F = d.length - 1;
      for (; F >= V && d[F].name !== a; ) F -= 1;
      if (F >= V) {
        const R = d[F];
        if (m(R) && R.position < g.scope) return;
        d.splice(F, 1), m(R) && l(R.position);
        return;
      }
    }
    if (S === void 0 || e[S].foreign) return;
    let M = -1;
    if (!(a === "template" || D && je.has(a))) {
      if (S <= g.integrationPoint) return;
      a === "p" ? M = g.buttonScope : a === "li" ? M = g.listScope : M = D && St.has(a) && a !== "noscript" ? g.scope : g.special;
    }
    S >= M && l(S);
  }, "closeElement");
  return { elements: e, processElement: s((a, g, S = false) => {
    const D = i("select")?.at(-1);
    let M = false;
    if (D !== void 0 && !e[D].foreign) {
      if (M = true, g) {
        if (a !== "select" && a !== "option" && a !== "optgroup" && a !== "template" || a === "option" && e.at(-1)?.name !== "option" || a === "optgroup" && (e.at(-1)?.name === "option" && e.at(-2)?.name === "optgroup" && l(e.length - 1), e.at(-1)?.name !== "optgroup")) return;
      } else if (a === "select" || a === "input" || a === "keygen" || a === "textarea") {
        if (l(D), a === "select") return;
        M = false;
      } else if (a === "option" || a === "optgroup") e.at(-1)?.name === "option" && l(e.length - 1), a === "optgroup" && e.at(-1)?.name === "optgroup" && l(e.length - 1);
      else if (a !== "script" && a !== "template") return;
    }
    if (g) {
      b(a);
      return;
    }
    const V = c(a), F = e.at(-1), R = !V && a.length <= 10;
    if (!(!M && (!F?.foreign || r(F)) && (!V || a === "svg" || a === "math") && !q(a, R)) && (a.length > 8 || !Bn.has(a) || V) && !(S && (V || a === "svg" || a === "math"))) {
      const J = u(a, V);
      R && vt.has(a) ? L(J) : R && a !== "table" && _e.has(a) && C.push({ element: J, start: d.length });
    }
  }, "processElement") };
}, "createElementStack"), I = { Data: 0, Comment: 1, BogusComment: 2, TagName: 3, BeforeAttributeName: 4, AttributeName: 5, AfterAttributeName: 6, BeforeAttributeValue: 7, DoubleQuotedValue: 8, SingleQuotedValue: 9, UnquotedValue: 10, AfterQuotedValue: 11, Cdata: 12 }, In = ["title", "textarea", "style", "xmp", "iframe", "noembed", "noframes", "script", "plaintext"], Ae = s((e) => e === 32 || e === 9 || e === 10 || e === 12 || e === 13, "isHtmlWhitespace"), Fn = s((e, t, n) => {
  const o = x(e, "<"), i = x(e, ">"), r = x(e, "-->"), c = x(e, "--!>"), u = x(e, '"'), l = x(e, "'"), m = x(e, "]]>");
  let d = e, C = false, T = false, N = 0;
  const L = /* @__PURE__ */ new Map(), _ = s((k, O) => {
    const f = L.get(k);
    if (f?.[0] === N) {
      const [, z, P] = f;
      if (P === -1 ? z <= O : P >= O) return P;
    }
    const h = d.slice(O, Q).indexOf(k), y = h === -1 ? -1 : O + h;
    return L.set(k, [N, O, y]), y;
  }, "searchSegment"), q = s((k, O, f) => C ? d.indexOf(O, f) : T ? _(O, f) : k(f), "search"), { elements: b, processElement: w } = Pn();
  let a = I.Data, g = 0, S = false, D = "", M = false, V = -1, F = "", R = false, J = false, Q = 0;
  const Z = s((k) => k < Q ? d.charCodeAt(k) : 10, "peek"), K = s((k) => {
    let O = k + 1;
    d.charCodeAt(O) === 47 && (O += 1);
    for (const f of In) {
      let h = true;
      for (let y = 0; y < f.length; y += 1) if (Fe(Z(O + y)) !== f.charCodeAt(y)) {
        h = false;
        break;
      }
      if (h) {
        const y = Z(O + f.length);
        return le(y) || y === 62 || y === 47 && Z(O + f.length + 1) === 62;
      }
    }
    return false;
  }, "isFilteredTag"), te = s((k) => {
    if (n) {
      D = "";
      for (let O = g; O < k; O += 1) {
        const f = d.charCodeAt(O);
        if (f === 0 || Ke(f)) {
          const h = d.charCodeAt(O + 1);
          pe(f) && O + 1 < k && ge(h) ? (D += d[O] + d[O + 1], O += 1) : D += "\uFFFD";
        } else D += String.fromCharCode(Fe(f));
      }
    }
  }, "endTagName"), ne = s(() => {
    n && w(D, S, M), a = I.Data;
  }, "emitTag"), H = s((k, O, f) => {
    const h = q(o, "<", k);
    if (h === -1 || h >= Q) return Q;
    const y = Z(h + 1);
    if (y === 33) {
      if (b.at(-1)?.foreign && h + 9 <= Q && d.startsWith("<![CDATA[", h)) return a = I.Cdata, h + 9;
      if (Z(h + 2) !== 45 || Z(h + 3) !== 45) return a = I.BogusComment, h + 2;
      const A = Z(h + 4) === 62 ? h + 5 : Z(h + 4) === 45 && Z(h + 5) === 62 ? h + 6 : -1;
      return A !== -1 ? (C || t.push({ start: h, end: A, contentStart: h + 4, contentEnd: h + 4, nextLinePrefix: O, onCommentLine: f }), A) : (a = I.Comment, V = C ? -1 : h, J = false, F = O, R = f, h + 4);
    }
    if (y === 63) return a = I.BogusComment, h + 2;
    const z = y === 47, P = z ? h + 2 : h + 1, X = Z(P);
    return ae(X) ? !C && K(h) ? h + 1 : (a = I.TagName, S = z, M = false, g = P, P + 1) : z ? X === 62 ? h + 3 : (a = I.BogusComment, h + 2) : h + 1;
  }, "readData"), E = s((k) => {
    const O = d.charCodeAt(k);
    switch (a) {
      case I.TagName:
        return Ae(O) || O === 47 ? (te(k), M = O === 47, a = I.BeforeAttributeName) : O === 62 && (te(k), ne()), k + 1;
      case I.BeforeAttributeName:
        return O === 62 ? ne() : O === 47 ? M = true : Ae(O) ? M = false : (M = false, a = I.AttributeName), k + 1;
      case I.AttributeName:
      case I.AfterAttributeName: {
        switch (O) {
          case 47: {
            M = true, a = I.BeforeAttributeName;
            break;
          }
          case 61: {
            a = I.BeforeAttributeValue;
            break;
          }
          case 62: {
            ne();
            break;
          }
          default:
            a = Ae(O) ? I.AfterAttributeName : I.AttributeName;
        }
        return k + 1;
      }
      case I.BeforeAttributeValue: {
        switch (O) {
          case 34: {
            a = I.DoubleQuotedValue;
            break;
          }
          case 39: {
            a = I.SingleQuotedValue;
            break;
          }
          case 62: {
            ne();
            break;
          }
          default:
            Ae(O) || (a = I.UnquotedValue);
        }
        return k + 1;
      }
      case I.UnquotedValue:
        return Ae(O) ? a = I.BeforeAttributeName : O === 62 && ne(), k + 1;
      default:
        return O === 62 ? ne() : Ae(O) || O === 47 ? (M = O === 47, a = I.BeforeAttributeName) : (M = false, a = I.AttributeName), k + 1;
    }
  }, "readTag"), p = s((k, O, f) => {
    switch (a) {
      case I.Data:
        return H(k, O, f);
      case I.Comment: {
        const h = q(r, "-->", k), y = q(c, "--!>", k), z = h !== -1 && h + 3 <= Q, P = y !== -1 && y + 4 <= Q;
        if (!z && !P) return Q;
        a = I.Data;
        const X = z && (!P || h < y), A = X ? h : y, v = A + (X ? 3 : 4);
        return !C && V !== -1 && t.push({ start: V, end: J ? e.length : v, contentStart: V + 4, contentEnd: J ? e.length : A, nextLinePrefix: F, onCommentLine: R }), v;
      }
      case I.BogusComment: {
        const h = q(i, ">", k);
        return h === -1 || h >= Q ? Q : (a = I.Data, h + 1);
      }
      case I.DoubleQuotedValue:
      case I.SingleQuotedValue: {
        const h = a === I.DoubleQuotedValue ? q(u, '"', k) : q(l, "'", k);
        return h === -1 || h >= Q ? Q : (a = I.AfterQuotedValue, h + 1);
      }
      case I.Cdata: {
        const h = q(m, "]]>", k);
        return h === -1 || h + 3 > Q ? Q : (a = I.Data, h + 3);
      }
      default:
        return E(k);
    }
  }, "read"), B = s((k) => {
    switch (M = false, a) {
      case I.TagName: {
        te(Q), a = I.BeforeAttributeName;
        break;
      }
      case I.AttributeName: {
        a = I.AfterAttributeName;
        break;
      }
      case I.UnquotedValue:
      case I.AfterQuotedValue: {
        a = I.BeforeAttributeName;
        break;
      }
    }
    return k && a !== I.Data && a !== I.Comment && a !== I.DoubleQuotedValue && a !== I.SingleQuotedValue && a !== I.Cdata ? (a === I.BogusComment ? a = I.Data : ne(), true) : false;
  }, "separate");
  return { wantsCode: s(() => a !== I.Data, "wantsCode"), inComment: s(() => a === I.Comment, "inComment"), finish: s(() => {
    a === I.Comment && V !== -1 && t.push({ start: V, end: e.length, contentStart: V + 4, contentEnd: e.length, nextLinePrefix: F, onCommentLine: R });
  }, "finish"), boundary: s(() => {
    T = true, J ||= a === I.Comment && V !== -1;
  }, "boundary"), generated: s((k, O, f) => {
    if (B(k), a === I.Data) {
      if (n) for (const y of O) y.charCodeAt(0) === 47 ? w(y.slice(1), true) : w(y, false);
      return;
    }
    d = f(), C = true, Q = d.length;
    let h = 0;
    for (; h < Q; ) h = p(h, "", false);
  }, "generated"), open: s((k) => {
    const O = B(true);
    n && !O && a === I.Data && w(k, false);
  }, "open"), close: s((k) => {
    const O = B(true);
    n && !O && a === I.Data && w(k, true);
  }, "close"), feed: s((k, O, f, h, y) => {
    B(f), d = e, C = false, Q = O, N += 1;
    let z = false;
    if (y) {
      let X = k;
      for (; X < Q && (d.charCodeAt(X) === 32 || d.charCodeAt(X) === 9); ) X += 1;
      z = a === I.Data && d.startsWith("<!--", X) || a === I.Comment && R;
    }
    let P = k;
    for (; P < Q; ) P = p(P, h, z);
  }, "feed") };
}, "createHtmlTokenizer"), Mn = s((e) => {
  const t = sn($e(ut(e)));
  let n = 0;
  for (; n < t.length && !re(t.charCodeAt(n)); ) n += 1;
  return t.slice(0, n);
}, "codeLanguage"), $n = s((e, t) => {
  if (t.type === "thematicBreak") return `<hr />
`;
  const n = Mn(Se(e.slice(t.infoStart, t.infoEnd))), o = [];
  let i = 0;
  for (let c = 0; c < t.lines.length; c += 1) {
    const u = t.lines[c];
    let l = u;
    for (; l < e.length && e.charCodeAt(l) !== 10 && e.charCodeAt(l) !== 13; ) l += 1;
    const m = t.tabSpaces[i] === c ? t.tabSpaces[i + 1] : 0;
    m && (i += 2), o.push(" ".repeat(m), e.slice(u, l), `
`);
  }
  return `${n ? `<pre lang="${Pe(n)}"><code>` : "<pre><code>"}${Pe(Se(o.join("")))}</code></pre>
`;
}, "renderGeneratedBlock"), Vn = s((e, t) => {
  const n = me(e.label), o = t > 1 ? `-${t}` : "";
  return `<sup class="footnote-ref"><a href="#fn-${n}" id="fnref-${n}${o}" data-footnote-ref>${e.index}</a></sup>`;
}, "renderReference"), qn = s((e, t) => `${t ? `<section class="footnotes" data-footnotes>
<ol>
` : ""}<li id="fn-${me(e.label)}">
`, "renderHead"), En = s((e) => {
  const t = me(e.label), { index: n } = e;
  let o = `<a href="#fnref-${t}" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${n}" aria-label="Back to reference ${n}">\u21A9</a>`;
  return e.references > 1 && (o += ` <a href="#fnref-${t}-2" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${n}-2" aria-label="Back to reference ${n}-2">\u21A9<sup class="footnote-ref">2</sup></a>`), e.lastIsParagraph ? ` ${o}</p>
</li>
` : `${o}
</li>
`;
}, "renderTail"), zn = `</ol>
</section>
`, Hn = s((e) => {
  const t = e.lastIndexOf("<!--");
  return t === -1 ? [] : _n(e, t);
}, "findComments"), Un = ["pre", "code", "/code", "/pre"], Rn = ["a"], Qn = ["/a"], Ie = [], Wn = { th: ["th"], td: ["td"] }, jn = s(() => "</a>", "renderLinkClose"), _n = s((e, t) => {
  let n = false;
  const o = s((f) => Fe(e.charCodeAt(f)), "asciiLower");
  for (let f = e.indexOf("<"); f !== -1; f = e.indexOf("<", f + 1)) {
    const h = o(f + 1);
    if (h === 115 && o(f + 2) === 118 && o(f + 3) === 103 || h === 109 && o(f + 2) === 97 && o(f + 3) === 116 && o(f + 4) === 104) {
      n = true;
      break;
    }
  }
  const i = [], r = Fn(e, i, n), c = /* @__PURE__ */ new Map();
  let u = false;
  const l = /* @__PURE__ */ new Map(), m = [], d = [], C = s((f) => l.get(ke(f)), "findFootnote");
  let T, N, L, _ = 0;
  const q = s((f) => {
    const h = ke(f), y = L?.has(_);
    return _ += 1, y || h === "" ? void 0 : c.get(h);
  }, "lookupLabel");
  let b = false;
  const w = { inData: s(() => !r.wantsCode(), "inData"), open: s((f) => {
    r.generated(b, Rn, () => vn(f)), b = false;
  }, "open"), close: s(() => {
    r.generated(b, Qn, jn), b = false;
  }, "close"), image: s((f) => {
    r.generated(b, Ie, () => yn(f)), b = false;
  }, "image"), autolink: s((f, h, y) => {
    r.generated(b, Ie, () => Ln(f, h, y)), b = false;
  }, "autolink") }, a = n ? (f, h) => {
    h ? r.open(f) : r.close(f), b = true;
  } : void 0, g = s(({ segments: f, nextLinePrefix: h, unescapePipes: y, textType: z }) => {
    z === "paragraph" && r.open("p"), L = N?.get(f[0]), _ = 0;
    const P = [], X = [], A = gt(e, f, P, y, X);
    let v = 0, U = 0, G = 0, $ = 0;
    b = true, pt(A, (Y, oe) => {
      for (; v + 1 < P.length && P[v + 1] <= Y; ) v += 1;
      for (let W = v; W < P.length && P[W] < oe; W += 1) {
        const ee = f[W * 2], fe = Math.max(Y, P[W]), he = W + 1 < P.length ? P[W + 1] - 1 : A.length, ye = Math.min(oe, he);
        $ = Qe(X, $, P[W]), U = Qe(X, U, fe + 1), G = Qe(X, G, ye);
        const de = ee + U - $, Le = ee + G - $, yt = fe - P[W] + de, Lt = ye - P[W] + Le;
        r.feed(yt, Lt, b, h, false), b = false;
      }
    }, q, a, T, w), z === "paragraph" && r.close("p");
  }, "lexText"), S = x(e, `
`), D = x(e, "\r"), M = s((f, h, y, z) => {
    let P = f;
    for (; ; ) {
      const X = S(P), A = D(P), v = Math.min(X === -1 ? h : X, A === -1 ? h : A, h);
      if (v === h) break;
      r.feed(P, v, y, z, true), y = false, P = v + (e.startsWith(`\r
`, v) ? 2 : 1);
    }
    r.feed(P, h, y, z, true);
  }, "feedHtml"), V = s((f) => {
    switch (f.type) {
      case "text": {
        (!f.generatedOnly || r.wantsCode()) && g(f);
        break;
      }
      case "html": {
        M(f.start, f.end, f.afterMarkup, f.nextLinePrefix);
        break;
      }
      case "open": {
        r.open(f.name);
        break;
      }
      case "close": {
        r.close(f.name);
        break;
      }
      case "cell": {
        const { name: h, align: y } = f;
        r.generated(true, Wn[h], () => `<${h} align="${y}">`);
        break;
      }
      case "generated": {
        const { block: h } = f;
        r.generated(f.afterMarkup, h.type === "code" ? Un : Ie, () => $n(e, h));
        break;
      }
    }
  }, "dispatch"), F = [];
  let R = false, J = false;
  const Q = x(e, "<?"), Z = x(e, "<!["), K = x(e, "--!>"), te = s((f) => {
    const h = f[0], y = f.at(-1), z = s((P) => P === -1 || P >= y, "isAfter");
    return z(Q(h)) && z(Z(h)) && z(K(h));
  }, "inlineKeepsData"), ne = x(e, "<"), H = x(e, "-->"), E = s((f, h) => {
    const y = ne(f);
    if (y === -1 || y >= h) return true;
    if (!e.startsWith("<!--", y)) return false;
    const z = H(y + 2);
    if (z === -1 || z + 3 > h) return false;
    const P = ne(y + 1);
    return P === -1 || P >= h;
  }, "keepsData"), p = s((f) => {
    const h = m.at(-1);
    h ? h.events.push(f) : R ? (J ||= f.type === "text" && !f.generatedOnly && !te(f.segments), F.push(f)) : V(f);
  }, "record"), B = s(() => m.length > 0 || R && J || r.wantsCode(), "mayLeaveData"), k = Ge(e, n), O = it(e, { wantsCode: B, generated: s((f, h) => p({ type: "generated", block: f, afterMarkup: h }), "generated"), text: s((f, h, y, z) => {
    if (f.length === 0) return;
    const P = k.needsInline(f, z);
    if (!P && !B()) return;
    const X = k.hasBrackets(f);
    !P && !X && !k.hasBareAutolink(f) || (X && !R && m.length === 0 && (R = true, J = r.wantsCode()), p({ type: "text", segments: f, nextLinePrefix: h, unescapePipes: y, textType: z, generatedOnly: !P }));
  }, "text"), html: s((f, h, y, z) => {
    if (m.length === 0) {
      if (!R) {
        r.feed(f, h, y, z, true);
        return;
      }
      J ||= !E(f, h);
      const P = F.at(-1);
      if (P?.type === "html" && !y && P.nextLinePrefix === z && (f - P.end === 1 && (e.charCodeAt(P.end) === 10 || e.charCodeAt(P.end) === 13) || f - P.end === 2 && e.startsWith(`\r
`, P.end))) {
        P.end = h;
        return;
      }
    }
    p({ type: "html", start: f, end: h, afterMarkup: y, nextLinePrefix: z });
  }, "html"), open: n ? (f) => p({ type: "open", name: f }) : void 0, close: n ? (f) => p({ type: "close", name: f }) : void 0, alignedCell: s((f, h) => p({ type: "cell", name: f, align: h }), "alignedCell"), definition: s((f, h, y) => {
    const z = ke(f);
    z && !c.has(z) && c.set(z, { destination: h, title: y });
  }, "definition"), footnoteStart: s((f, h) => {
    u = true, m.push({ start: h, end: e.length, label: f.replaceAll("\0", "\uFFFD"), index: 0, references: 0, rendered: 0, lastIsParagraph: false, markup: false, events: [] });
  }, "footnoteStart"), footnoteEnd: s((f, h, y) => {
    const z = m.pop();
    z.end = y, z.lastIsParagraph = f, z.markup = h;
    const P = ke(z.label);
    P && !l.has(P) && l.set(P, z);
  }, "footnoteEnd") }, { after: t, canStop: s(() => !R && !u && !r.inComment(), "canStop") });
  (l.size > 0 || R && c.size > 0) && (N = Nn(e, c, l.size > 0 ? { find: C, count: s((f) => {
    f.index === 0 && (d.push(f), f.index = d.length), f.references += 1;
  }, "count") } : void 0)), d.length > 0 && (T = { find: C, emit: s((f) => {
    f.rendered += 1;
    const h = f.rendered;
    r.generated(false, Ie, () => Vn(f, h));
  }, "emit") });
  for (const f of F) V(f);
  for (const [f, h] of d.entries()) {
    r.boundary(), r.generated(f === 0 && O, f === 0 ? ["section", "ol", "li"] : ["li"], () => qn(h, f === 0));
    for (const y of h.events) V(y);
    r.generated(h.markup, ["/li"], () => En(h));
  }
  if (d.length > 0 && r.generated(false, ["/ol", "/section"], () => zn), r.finish(), d.length > 0) {
    i.sort((y, z) => y.start - z.start);
    const f = [];
    for (const y of d) f.push(y.start, y.end);
    f.sort((y, z) => y - z);
    let h = 0;
    for (const y of i) {
      for (; h < f.length && f[h] <= y.start; ) h += 1;
      h < f.length && f[h] < y.end && (y.contentEnd = f[h], y.end = f[h]);
    }
  }
  return i;
}, "scanDocument");

const openDelimiter = "<!--";
const closeDelimiter = "-->";
const classifyComment = (source, innerStart, innerEnd) => {
  let index = skipWhitespace(source, innerStart, innerEnd);
  if (index >= innerEnd) {
    return { type: "other" };
  }
  let closing = false;
  if (source[index] === "/") {
    closing = true;
    index = skipWhitespace(source, index + 1, innerEnd);
  }
  const tag = readName(source, index, innerEnd);
  if (!tag) {
    return { type: "other" };
  }
  if (closing) {
    if (skipWhitespace(source, tag.end, innerEnd) < innerEnd) {
      return { type: "other" };
    }
    return {
      type: "closer",
      tagName: tag.name
    };
  }
  if (tag.end < innerEnd && !isWhitespace(source[tag.end])) {
    return { type: "other" };
  }
  return {
    type: "opener",
    tagName: tag.name,
    attributesStart: tag.end
  };
};
const parseDocument = (source) => {
  if (!source.includes(openDelimiter)) {
    return [];
  }
  const openers = [];
  const topByTag = /* @__PURE__ */ new Map();
  let openTop;
  for (const {
    start,
    end,
    contentStart,
    contentEnd,
    nextLinePrefix,
    onCommentLine
  } of Hn(source)) {
    if (source.slice(contentEnd, end) !== closeDelimiter) {
      continue;
    }
    const kind = classifyComment(source, contentStart, contentEnd);
    if (kind.type === "closer") {
      const opener = topByTag.get(kind.tagName);
      if (!opener) {
        continue;
      }
      let dropped = openTop;
      while (dropped && dropped !== opener) {
        topByTag.set(dropped.kind.tagName, dropped.previousSameTag);
        dropped = dropped.previousOpen;
      }
      opener.matched = true;
      opener.closerStart = start;
      topByTag.set(opener.kind.tagName, opener.previousSameTag);
      openTop = opener.previousOpen;
      continue;
    }
    if (kind.type === "opener") {
      const opener = {
        kind,
        openingStart: start,
        openingEnd: contentEnd,
        nextLinePrefix,
        onCommentLine,
        closerStart: -1,
        matched: false,
        previousOpen: openTop,
        previousSameTag: topByTag.get(kind.tagName)
      };
      openers.push(opener);
      topByTag.set(kind.tagName, opener);
      openTop = opener;
    }
  }
  const markers = [];
  let enclosingMarker;
  for (const opener of openers) {
    if (!opener.matched) {
      continue;
    }
    if (enclosingMarker && enclosingMarker.closerStart >= opener.openingStart) {
      continue;
    }
    enclosingMarker = opener;
    markers.push({
      tagName: opener.kind.tagName,
      attributes: parseAttributeNodes(source, opener.kind.attributesStart, opener.openingEnd),
      openingStart: opener.openingStart,
      contentStart: opener.openingEnd + closeDelimiter.length,
      contentEnd: opener.closerStart,
      nextLinePrefix: opener.nextLinePrefix,
      onCommentLine: opener.onCommentLine,
      attributesStart: opener.kind.attributesStart
    });
  }
  return markers;
};

const isSelectorValueChar = (char) => !isWhitespace(char) && char !== "]" && char !== '"' && char !== "'" && char !== "=";
const invalidSelector = (selector) => {
  throw new Error(`[comment-mark] Invalid selector: ${JSON.stringify(selector)}`);
};
const parseSelector = (selector) => {
  const end = selector.length;
  const tag = readName(selector, 0, end);
  if (!tag) {
    return invalidSelector(selector);
  }
  const attributes = [];
  let index = tag.end;
  while (index < end) {
    if (selector[index] !== "[") {
      return invalidSelector(selector);
    }
    index += 1;
    index = skipWhitespace(selector, index, end);
    const name = readName(selector, index, end);
    if (!name) {
      return invalidSelector(selector);
    }
    index = skipWhitespace(selector, name.end, end);
    let value;
    if (selector[index] === "=") {
      index = skipWhitespace(selector, index + 1, end);
      const quote = selector[index];
      if (quote === '"' || quote === "'") {
        const valueEnd = selector.indexOf(quote, index + 1);
        if (valueEnd === -1) {
          return invalidSelector(selector);
        }
        value = selector.slice(index + 1, valueEnd);
        index = valueEnd + 1;
      } else {
        const valueStart = index;
        while (index < end && isSelectorValueChar(selector[index])) {
          index += 1;
        }
        if (index === valueStart) {
          return invalidSelector(selector);
        }
        value = selector.slice(valueStart, index);
      }
      index = skipWhitespace(selector, index, end);
    }
    if (selector[index] !== "]") {
      return invalidSelector(selector);
    }
    index += 1;
    attributes.push({
      name: name.name,
      value
    });
  }
  return {
    tagName: tag.name,
    attributes
  };
};

const currentContent = (state) => {
  if (state.content !== void 0) {
    return state.content;
  }
  const content = state.source.slice(state.node.contentStart, state.node.contentEnd);
  const { nextLinePrefix } = state.node;
  if (!nextLinePrefix) {
    return content;
  }
  const trimmed = nextLinePrefix.trimEnd();
  let result = "";
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "\r" && content[index] !== "\n") {
      continue;
    }
    if (content[index] === "\r" && content[index + 1] === "\n") {
      index += 1;
    }
    result += content.slice(start, index + 1);
    start = index + 1;
    if (content.startsWith(nextLinePrefix, start)) {
      start += nextLinePrefix.length;
    } else if (trimmed && content.startsWith(trimmed, start)) {
      start += trimmed.length;
    }
    index = start - 1;
  }
  return result + content.slice(start);
};
const currentAttributes = (state) => {
  const attributes = [];
  for (const [name, value] of state.values) {
    if (value !== null) {
      attributes.push([name, value]);
    }
  }
  return Object.fromEntries(attributes);
};
const setContent = (state, content, getLineEnding) => {
  if (state.node.onCommentLine && content) {
    const lineEnding = getLineEnding();
    const leading = content.startsWith("\n") || content.startsWith("\r") ? "" : lineEnding;
    const trailing = content.endsWith("\n") || content.endsWith("\r") ? "" : lineEnding;
    state.content = `${leading}${content}${trailing}`;
  } else {
    state.content = content;
  }
  state.changed = true;
};
const assertAttribute = (name, value) => {
  if (!isAttributeName(name)) {
    throw new Error(`[comment-mark] Invalid attribute name: ${JSON.stringify(name)}`);
  }
  encodeAttributeValue(value, void 0);
};
const replaceAttributes = (state, attributes) => {
  const entries = Object.entries(attributes);
  for (const [name, value] of entries) {
    assertAttribute(name, value);
  }
  for (const name of state.values.keys()) {
    state.values.set(name, null);
  }
  for (const [name, value] of entries) {
    state.values.set(name, value);
  }
  state.changed = true;
};
const renderOpeningTag = (state) => {
  const { source, node } = state;
  const written = new Set(node.attributes.map((attribute) => attribute.name));
  const parts = [source.slice(node.openingStart, node.attributesStart)];
  let cursor = node.attributesStart;
  for (const attribute of node.attributes) {
    const value = state.values.get(attribute.name);
    if (value === null || value === void 0) {
      cursor = attribute.end;
      continue;
    }
    parts.push(
      source.slice(cursor, attribute.valueStart),
      value === attribute.value ? source.slice(attribute.valueStart, attribute.valueEnd) : encodeAttributeValue(value, attribute.quote)
    );
    cursor = attribute.valueEnd;
  }
  for (const [name, value] of state.values) {
    if (written.has(name) || value === null) {
      continue;
    }
    parts.push(` ${name}=${encodeAttributeValue(value, '"')}`);
  }
  parts.push(source.slice(cursor, node.contentStart));
  return parts.join("");
};
const renderDocument = (document, boundaries) => {
  const { source } = document;
  let output = "";
  let cursor = 0;
  for (const state of document.markers) {
    if (!state.changed) {
      boundaries?.push([
        output.length + state.node.openingStart - cursor,
        output.length + state.node.contentEnd - cursor
      ]);
      continue;
    }
    output += source.slice(cursor, state.node.openingStart);
    const openingStart = output.length;
    output += renderOpeningTag(state);
    if (state.content !== void 0 && state.node.nextLinePrefix) {
      const { nextLinePrefix } = state.node;
      const trimmed = nextLinePrefix.trimEnd();
      const { content } = state;
      let start = 0;
      for (let index = 0; index < content.length; index += 1) {
        if (content[index] !== "\r" && content[index] !== "\n") {
          continue;
        }
        if (content[index] === "\r" && content[index + 1] === "\n") {
          index += 1;
        }
        output += content.slice(start, index + 1);
        const next = content[index + 1];
        output += next === "\n" || next === "\r" ? trimmed : nextLinePrefix;
        start = index + 1;
      }
      output += content.slice(start);
    } else {
      output += state.content ?? source.slice(state.node.contentStart, state.node.contentEnd);
    }
    boundaries?.push([openingStart, output.length]);
    cursor = state.node.contentEnd;
  }
  return output + source.slice(cursor);
};
const markerData = (state) => ({
  tagName: state.node.tagName,
  attributes: currentAttributes(state),
  content: currentContent(state)
});
const matchesSelector = (state, selector) => {
  if (state.node.tagName !== selector.tagName) {
    return false;
  }
  return selector.attributes.every(({ name, value }) => {
    const current = state.values.get(name);
    if (current === null || current === void 0) {
      return false;
    }
    return value === void 0 || current === value;
  });
};
const selectMarkers = (document, selectorText) => {
  if (selectorText === void 0) {
    return document.markers.slice();
  }
  const selector = parseSelector(selectorText);
  return document.markers.filter((state) => matchesSelector(state, selector));
};
const createDocument = (input) => {
  const source = Buffer.isBuffer(input) ? input.toString() : input;
  return {
    source,
    markers: parseDocument(source).map((node, index) => ({
      index,
      source,
      node,
      values: new Map(node.attributes.map((attribute) => [attribute.name, attribute.value])),
      content: void 0,
      changed: false,
      selectorText: void 0
    }))
  };
};
const collectClaims = (document, replacements) => {
  const claims = [];
  const claimed = /* @__PURE__ */ new Map();
  for (const [selectorText, replacement] of Object.entries(replacements)) {
    const matches = selectMarkers(document, selectorText);
    const positional = Array.isArray(replacement);
    if (positional && replacement.length > matches.length) {
      throw new Error(
        `[comment-mark] Selector ${JSON.stringify(selectorText)} matched ${matches.length} marker${matches.length === 1 ? "" : "s"} but received ${replacement.length} values`
      );
    }
    if (positional && replacement.length === 0) {
      continue;
    }
    const resolver = !positional && typeof replacement === "function";
    if (matches.length === 0) {
      if (resolver) {
        continue;
      }
      throw new Error(`[comment-mark] Selector ${JSON.stringify(selectorText)} matched no markers`);
    }
    const count = positional ? replacement.length : resolver ? matches.length : 1;
    for (let index = 0; index < count; index += 1) {
      const value = positional ? replacement[index] : replacement;
      if (value === null || value === void 0) {
        continue;
      }
      if (positional && typeof value === "function") {
        throw new Error(
          `[comment-mark] Selector ${JSON.stringify(selectorText)} received a function at position ${index}; a function must be the selector value, not an array entry`
        );
      }
      const state = matches[index];
      const owner = claimed.get(state);
      if (owner !== void 0) {
        throw new Error(
          `[comment-mark] Selectors ${JSON.stringify(owner)} and ${JSON.stringify(selectorText)} both target the marker ${JSON.stringify(state.node.tagName)}`
        );
      }
      claimed.set(state, selectorText);
      claims.push({
        state,
        value,
        index,
        selectorText
      });
    }
  }
  return claims;
};
const applyReplacements = async (document, replacements) => {
  const claims = collectClaims(document, replacements);
  claims.sort((a, b) => a.state.index - b.state.index);
  let lineEnding;
  const getLineEnding = () => {
    if (lineEnding === void 0) {
      const { source, markers } = document;
      let lineFeed = source.indexOf("\n");
      let carriageReturn = source.indexOf("\r");
      for (const { node } of markers) {
        if (lineFeed !== -1 && lineFeed < node.openingStart || carriageReturn !== -1 && carriageReturn < node.openingStart) {
          break;
        }
        if (lineFeed !== -1 && lineFeed < node.contentEnd) {
          lineFeed = source.indexOf("\n", node.contentEnd);
        }
        if (carriageReturn !== -1 && carriageReturn < node.contentEnd) {
          carriageReturn = source.indexOf("\r", node.contentEnd);
        }
      }
      lineEnding = carriageReturn !== -1 && (lineFeed === -1 || carriageReturn < lineFeed) ? source[carriageReturn + 1] === "\n" ? "\r\n" : "\r" : "\n";
    }
    return lineEnding;
  };
  for (const {
    state,
    value,
    index,
    selectorText
  } of claims) {
    const resolver = typeof value === "function";
    const updated = resolver ? await value(markerData(state), index) : value;
    if (updated === null || updated === void 0) {
      continue;
    }
    state.selectorText = selectorText;
    if (typeof updated === "string") {
      setContent(state, updated, getLineEnding);
      continue;
    }
    if (updated.attributes !== void 0) {
      replaceAttributes(state, updated.attributes);
    }
    if (updated.content !== void 0) {
      setContent(state, updated.content, getLineEnding);
    }
  }
};

const commentMark = async (input, replacements) => {
  if (typeof input !== "string" && !Buffer.isBuffer(input) || typeof replacements !== "object" || replacements === null) {
    return input;
  }
  const document = createDocument(input);
  await applyReplacements(document, replacements);
  if (!document.markers.some((marker) => marker.changed)) {
    return document.source;
  }
  const boundaries = [];
  const output = renderDocument(document, boundaries);
  if (output === document.source) {
    return output;
  }
  let valid = false;
  try {
    const markers = parseDocument(output);
    valid = markers.length === document.markers.length && markers.every((marker, index) => marker.tagName === document.markers[index].node.tagName && marker.onCommentLine === document.markers[index].node.onCommentLine && marker.nextLinePrefix === document.markers[index].node.nextLinePrefix && marker.openingStart === boundaries[index][0] && marker.contentEnd === boundaries[index][1]);
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("[comment-mark] "))) {
      throw error;
    }
  }
  if (!valid) {
    const selectors = /* @__PURE__ */ new Set();
    for (const [index, state] of document.markers.entries()) {
      const original = document.source.slice(state.node.openingStart, state.node.contentEnd);
      if (state.selectorText !== void 0 && output.slice(...boundaries[index]) !== original) {
        selectors.add(state.selectorText);
      }
    }
    throw new Error(`[comment-mark] Replacement for ${[...selectors].map((selector) => JSON.stringify(selector)).join(", ")} would change the document's markers`);
  }
  return output;
};
const getCommentMark = (input, selector) => {
  const [first] = selectMarkers(createDocument(input), selector);
  return first ? markerData(first) : null;
};
const getCommentMarkAll = (input, selector) => selectMarkers(createDocument(input), selector).map(markerData);

export { commentMark as a, getCommentMark as b, createDocument as c, encodeAttributeValue as e, getCommentMarkAll as g, isAttributeName as i, markerData as m, selectMarkers as s };

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

const tabSize = 4;
const isBlank = (line, start) => {
  for (let index = start; index < line.length; index += 1) {
    const char = line[index];
    if (char !== " " && char !== "	") {
      return false;
    }
  }
  return true;
};
const consumeIndent = (line, cursor, columns) => {
  let { index, column, pending } = cursor;
  let remaining = columns;
  if (pending >= remaining) {
    cursor.pending = pending - remaining;
    return true;
  }
  remaining -= pending;
  pending = 0;
  while (remaining > 0) {
    const char = line[index];
    if (char === " ") {
      index += 1;
      column += 1;
      remaining -= 1;
    } else if (char === "	") {
      const width = tabSize - column % tabSize;
      index += 1;
      column += width;
      if (width > remaining) {
        cursor.index = index;
        cursor.column = column;
        cursor.pending = width - remaining;
        return true;
      }
      remaining -= width;
    } else {
      return false;
    }
  }
  cursor.index = index;
  cursor.column = column;
  cursor.pending = pending;
  return true;
};
const matchBlockquote = (line, cursor) => {
  let { index, column } = cursor;
  let indent = cursor.pending;
  while (indent < 3 && line[index] === " ") {
    index += 1;
    column += 1;
    indent += 1;
  }
  if (line[index] !== ">") {
    return false;
  }
  index += 1;
  column += 1;
  const char = line[index];
  if (char === " ") {
    index += 1;
    column += 1;
  } else if (char === "	") {
    const width = tabSize - column % tabSize;
    index += 1;
    column += width;
    cursor.index = index;
    cursor.column = column;
    cursor.pending = width - 1;
    return true;
  }
  cursor.index = index;
  cursor.column = column;
  cursor.pending = 0;
  return true;
};
const continueContainer = (line, cursor, container) => {
  if (container.type === "blockquote") {
    return matchBlockquote(line, cursor);
  }
  return isBlank(line, cursor.index) || consumeIndent(line, cursor, container.indent);
};
const matchListMarker = (line, cursor, inParagraph) => {
  let { index, column } = cursor;
  let indent = cursor.pending;
  while (indent < 4 && line[index] === " ") {
    index += 1;
    column += 1;
    indent += 1;
  }
  if (indent > 3) {
    return void 0;
  }
  const char = line[index];
  let markerWidth = 1;
  if (char !== "-" && char !== "+" && char !== "*") {
    let digits = 0;
    while (digits < 9) {
      const digit = line[index + digits];
      if (digit === void 0 || digit < "0" || digit > "9") {
        break;
      }
      digits += 1;
    }
    const terminator = line[index + digits];
    if (digits === 0 || terminator !== "." && terminator !== ")") {
      return void 0;
    }
    if (inParagraph && (digits !== 1 || char !== "1")) {
      return void 0;
    }
    markerWidth = digits + 1;
  }
  const afterMarker = index + markerWidth;
  if (afterMarker < line.length) {
    const next = line[afterMarker];
    if (next !== " " && next !== "	") {
      return void 0;
    }
  }
  if (inParagraph && isBlank(line, afterMarker)) {
    return void 0;
  }
  let paddingIndex = afterMarker;
  let paddingColumn = column + markerWidth;
  let padding = 0;
  while (padding < 5) {
    const paddingChar = line[paddingIndex];
    if (paddingChar === " ") {
      paddingIndex += 1;
      paddingColumn += 1;
      padding += 1;
    } else if (paddingChar === "	") {
      const width = tabSize - paddingColumn % tabSize;
      paddingIndex += 1;
      paddingColumn += width;
      padding += width;
    } else {
      break;
    }
  }
  if (padding < 1 || padding > 4) {
    const first = line[afterMarker];
    if (first === "	") {
      const width = tabSize - (column + markerWidth) % tabSize;
      cursor.index = afterMarker + 1;
      cursor.column = column + markerWidth + width;
      cursor.pending = width - 1;
    } else if (first === " ") {
      cursor.index = afterMarker + 1;
      cursor.column = column + markerWidth + 1;
      cursor.pending = 0;
    } else {
      cursor.index = afterMarker;
      cursor.column = column + markerWidth;
      cursor.pending = 0;
    }
    return {
      contentIndent: indent + markerWidth + 1
    };
  }
  cursor.index = paddingIndex;
  cursor.column = paddingColumn;
  cursor.pending = 0;
  return {
    contentIndent: indent + markerWidth + padding
  };
};
const matchFence = (line, cursor) => {
  let { index } = cursor;
  let spaces = cursor.pending;
  while (spaces < 3 && line[index] === " ") {
    index += 1;
    spaces += 1;
  }
  if (line[index] === " ") {
    return void 0;
  }
  const char = line[index];
  if (char !== "`" && char !== "~") {
    return void 0;
  }
  let length = 0;
  while (line[index + length] === char) {
    length += 1;
  }
  if (length < 3) {
    return void 0;
  }
  const end = index + length;
  if (char === "`" && line.slice(end).includes("`")) {
    return void 0;
  }
  return {
    char,
    length,
    end
  };
};
const closesFence = (line, cursor, fence) => {
  const match = matchFence(line, cursor);
  return Boolean(
    match && match.char === fence.char && match.length >= fence.length && isBlank(line, match.end)
  );
};
const isThematicBreak = (line, cursor) => {
  let { index } = cursor;
  let indent = cursor.pending;
  while (indent < 4 && line[index] === " ") {
    index += 1;
    indent += 1;
  }
  if (indent > 3) {
    return false;
  }
  let marker = "";
  let count = 0;
  for (; index < line.length; index += 1) {
    const char = line[index];
    if (char === " " || char === "	") {
      continue;
    }
    if (char !== "-" && char !== "_" && char !== "*") {
      return false;
    }
    if (marker === "") {
      marker = char;
    } else if (char !== marker) {
      return false;
    }
    count += 1;
  }
  return count >= 3;
};
const matchAtxHeading = (line, cursor) => {
  let { index } = cursor;
  let indent = cursor.pending;
  while (indent < 4 && line[index] === " ") {
    index += 1;
    indent += 1;
  }
  if (indent > 3) {
    return void 0;
  }
  let hashes = 0;
  while (hashes < 7 && line[index + hashes] === "#") {
    hashes += 1;
  }
  if (hashes < 1 || hashes > 6) {
    return void 0;
  }
  const next = line[index + hashes];
  if (next !== void 0 && next !== " " && next !== "	") {
    return void 0;
  }
  let content = index + hashes;
  while (line[content] === " " || line[content] === "	") {
    content += 1;
  }
  return content;
};
const isSetextUnderline = (line, cursor) => {
  let { index } = cursor;
  let indent = cursor.pending;
  while (indent < 4 && line[index] === " ") {
    index += 1;
    indent += 1;
  }
  if (indent > 3) {
    return false;
  }
  const char = line[index];
  if (char !== "=" && char !== "-") {
    return false;
  }
  let underline = 0;
  while (line[index + underline] === char) {
    underline += 1;
  }
  return isBlank(line, index + underline);
};

const openDelimiter$1 = "<!--";
const closeDelimiter$1 = "-->";
const startsBlockComment = (line, cursor) => {
  let { index, column } = cursor;
  let indent = cursor.pending;
  while (indent <= 3 && (line[index] === " " || line[index] === "	")) {
    const width = line[index] === " " ? 1 : tabSize - column % tabSize;
    indent += width;
    column += width;
    index += 1;
  }
  return indent <= 3 && line.startsWith(openDelimiter$1, index);
};
const findBacktickRuns = (line, start) => {
  const runs = /* @__PURE__ */ new Map();
  let index = start;
  while (index < line.length) {
    if (line[index] !== "`") {
      index += 1;
      continue;
    }
    let backslashes = 0;
    let cursor = index - 1;
    while (cursor >= 0 && line[cursor] === "\\") {
      backslashes += 1;
      cursor -= 1;
    }
    const escaped = backslashes % 2 === 1;
    let length = 0;
    while (line[index + length] === "`") {
      length += 1;
    }
    runs.set(index, {
      start: index,
      length,
      escaped,
      synthetic: false,
      next: -1
    });
    if (escaped && length > 1) {
      runs.set(index + 1, {
        start: index + 1,
        length: length - 1,
        escaped: false,
        synthetic: true,
        next: -1
      });
    }
    index += length;
  }
  const lastByLength = /* @__PURE__ */ new Map();
  for (const run of [...runs.values()].toReversed()) {
    const next = lastByLength.get(run.length);
    if (next !== void 0) {
      run.next = next;
    }
    if (!run.synthetic) {
      lastByLength.set(run.length, run.start);
    }
  }
  return runs;
};
const scanComments = (source, visit) => {
  const containers = [];
  let fence;
  let commentStart = -1;
  let commentContinuation = "";
  let commentStartsLine = false;
  let inParagraph = false;
  const cursor = {
    index: 0,
    column: 0,
    pending: 0
  };
  const scanInline = (line, lineStart2, start, startsLine) => {
    const runs = line.includes("`", start) ? findBacktickRuns(line, start) : void 0;
    let index = start;
    while (index < line.length) {
      const run = runs?.get(index);
      if (run) {
        if (run.escaped) {
          index += 1;
        } else if (run.next === -1) {
          index += run.length;
        } else {
          const close = runs?.get(run.next);
          index = run.next + (close?.length ?? run.length);
        }
        continue;
      }
      if (line.startsWith(openDelimiter$1, index)) {
        const continuation = containers.length === 0 ? "" : containers.map((container) => container.type === "blockquote" ? "> " : " ".repeat(container.indent)).join("");
        const close = line.indexOf(closeDelimiter$1, index + openDelimiter$1.length);
        if (close === -1) {
          commentStart = lineStart2 + index;
          commentContinuation = continuation;
          commentStartsLine = startsLine;
          return;
        }
        visit(
          lineStart2 + index,
          lineStart2 + index + openDelimiter$1.length,
          lineStart2 + close,
          continuation,
          startsLine
        );
        index = close + closeDelimiter$1.length;
        continue;
      }
      index += 1;
    }
  };
  const scanLine = (line, lineStart2) => {
    cursor.index = 0;
    cursor.column = 0;
    cursor.pending = 0;
    if (commentStart !== -1) {
      const close = line.indexOf(closeDelimiter$1);
      if (close === -1) {
        return;
      }
      visit(
        commentStart,
        commentStart + openDelimiter$1.length,
        lineStart2 + close,
        commentContinuation,
        commentStartsLine
      );
      commentStart = -1;
      scanInline(line, lineStart2, close + closeDelimiter$1.length, commentStartsLine);
      return;
    }
    let matched = 0;
    for (const container of containers) {
      if (!continueContainer(line, cursor, container)) {
        break;
      }
      matched += 1;
    }
    if (fence) {
      if (matched < fence.depth) {
        fence = void 0;
        containers.length = matched;
      } else {
        if (closesFence(line, cursor, fence)) {
          fence = void 0;
        }
        return;
      }
    } else if (matched < containers.length) {
      containers.length = matched;
      inParagraph = false;
    }
    if (isBlank(line, cursor.index)) {
      inParagraph = false;
      return;
    }
    for (; ; ) {
      if (matchBlockquote(line, cursor)) {
        containers.push({ type: "blockquote" });
        continue;
      }
      if (isThematicBreak(line, cursor)) {
        inParagraph = false;
        return;
      }
      if (inParagraph && isSetextUnderline(line, cursor)) {
        inParagraph = false;
        return;
      }
      const list = matchListMarker(line, cursor, inParagraph);
      if (!list) {
        break;
      }
      containers.push({
        type: "listItem",
        indent: list.contentIndent
      });
    }
    const headingContent = matchAtxHeading(line, cursor);
    if (headingContent !== void 0) {
      inParagraph = false;
      scanInline(line, lineStart2, headingContent, false);
      return;
    }
    const match = matchFence(line, cursor);
    if (match) {
      fence = {
        char: match.char,
        length: match.length,
        depth: containers.length
      };
      inParagraph = false;
      return;
    }
    const blockComment = startsBlockComment(line, cursor);
    inParagraph = !blockComment;
    scanInline(line, lineStart2, cursor.index, blockComment);
  };
  let lineStart = source.startsWith("\uFEFF") ? 1 : 0;
  let lineFeed = source.indexOf("\n", lineStart);
  let carriageReturn = source.indexOf("\r", lineStart);
  while (lineFeed !== -1 || carriageReturn !== -1) {
    let lineEnd;
    let endingLength;
    if (carriageReturn !== -1 && (lineFeed === -1 || carriageReturn < lineFeed)) {
      lineEnd = carriageReturn;
      endingLength = source[carriageReturn + 1] === "\n" ? 2 : 1;
    } else {
      lineEnd = lineFeed;
      endingLength = 1;
    }
    scanLine(source.slice(lineStart, lineEnd), lineStart);
    lineStart = lineEnd + endingLength;
    if (lineFeed !== -1 && lineFeed < lineStart) {
      lineFeed = source.indexOf("\n", lineStart);
    }
    if (carriageReturn !== -1 && carriageReturn < lineStart) {
      carriageReturn = source.indexOf("\r", lineStart);
    }
  }
  scanLine(source.slice(lineStart), lineStart);
};

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
  scanComments(source, (start, innerStart, innerEnd, continuation, startsLine) => {
    const kind = classifyComment(source, innerStart, innerEnd);
    if (kind.type === "closer") {
      const opener = topByTag.get(kind.tagName);
      if (!opener) {
        return;
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
      return;
    }
    if (kind.type === "opener") {
      const opener = {
        kind,
        openingStart: start,
        openingEnd: innerEnd,
        continuation,
        startsLine,
        closerStart: -1,
        matched: false,
        previousOpen: openTop,
        previousSameTag: topByTag.get(kind.tagName)
      };
      openers.push(opener);
      topByTag.set(kind.tagName, opener);
      openTop = opener;
    }
  });
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
      continuation: opener.continuation,
      startsLine: opener.startsLine,
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
  const { continuation } = state.node;
  if (!continuation) {
    return content;
  }
  const trimmed = continuation.trimEnd();
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
    if (content.startsWith(continuation, start)) {
      start += continuation.length;
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
  if (state.node.startsLine && content) {
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
    if (state.content !== void 0 && state.node.continuation) {
      const { continuation } = state.node;
      const trimmed = continuation.trimEnd();
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
        output += next === "\n" || next === "\r" ? trimmed : continuation;
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
    valid = markers.length === document.markers.length && markers.every((marker, index) => marker.tagName === document.markers[index].node.tagName && marker.startsLine === document.markers[index].node.startsLine && marker.continuation === document.markers[index].node.continuation && marker.openingStart === boundaries[index][0] && marker.contentEnd === boundaries[index][1]);
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

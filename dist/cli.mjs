#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { i as isAttributeName, g as getCommentMarkAll, a as getCommentMark, c as commentMark, e as encodeAttributeValue } from './index-BsP2XUGH.mjs';

var name = "comment-mark";
var version = "0.0.0-semantic-release";
var description = "Interpolate strings with HTML comment markers";

const exitWithError = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};
const fromLibrary = async (call) => {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Error) {
      exitWithError(error.message);
    }
    throw error;
  }
};
const helpOptions = {
  description,
  usage: `${name} <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]`,
  examples: [
    `${name} README.md --lastUpdated="$(date -Iseconds)"`,
    `${name} README.md --item.status="archived"`,
    `${name} README.md --"contributors[role='maintainer']"="$(git shortlog -se HEAD -- .)"`
  ]
};
const argv = cli({
  name,
  // Keep `[file]` optional: a required `<file>` aborts inside cli() with
  // "Missing required parameter" before the manual `--help`/`--version`
  // handlers below can run. The requirement is enforced after those flags.
  parameters: ["[file]"],
  // Markers accept arbitrary names, so a marker can be named `help`. cleye's
  // default Boolean `help` flag (alias `-h`) would consume `--help=<value>`
  // and print help instead, so it's disabled; bare flags are handled below.
  help: false
});
const { showHelp } = argv;
const updates = /* @__PURE__ */ new Map();
const findSeparator = (text, delimiter) => {
  let inPredicate = false;
  let quote = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== "") {
      if (character === quote) {
        quote = "";
      }
      continue;
    }
    switch (character) {
      case '"':
      case "'": {
        quote = character;
        break;
      }
      case "[": {
        inPredicate = true;
        break;
      }
      case "]": {
        inPredicate = false;
        break;
      }
      default: {
        if (character === delimiter && !inPredicate) {
          return index;
        }
        break;
      }
    }
  }
  return -1;
};
const flagCounts = /* @__PURE__ */ new Map();
const bareFlags = /* @__PURE__ */ new Set();
for (const argument of process.argv.slice(2)) {
  if (argument === "--") {
    break;
  }
  if (!argument.startsWith("-") || argument === "-") {
    continue;
  }
  if (argument === "-h") {
    flagCounts.set("help", (flagCounts.get("help") ?? 0) + 1);
    bareFlags.add("help");
    continue;
  }
  if (!argument.startsWith("--")) {
    exitWithError(`Unknown flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
  }
  const flag = argument.slice(2);
  const separator = findSeparator(flag, "=");
  const target = separator === -1 ? flag : flag.slice(0, separator);
  if (separator === -1 && (target === "help" || target === "version")) {
    flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);
    bareFlags.add(target);
    continue;
  }
  const attributeSeparator = findSeparator(target, ".");
  const selector = attributeSeparator === -1 ? target : target.slice(0, attributeSeparator);
  const attribute = attributeSeparator === -1 ? void 0 : target.slice(attributeSeparator + 1);
  if (selector === "") {
    exitWithError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value> or --<selector>.<attribute>=<value>)`);
  }
  if (attribute !== void 0 && !isAttributeName(attribute)) {
    exitWithError(`Invalid attribute name in flag ${JSON.stringify(argument)} (expected --<selector>.<attribute>=<value>)`);
  }
  flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);
  if (separator === -1) {
    exitWithError(`No value provided for flag "--${target}" (expected --${target}=<value>)`);
  }
  const value = flag.slice(separator + 1);
  if (attribute !== void 0) {
    await fromLibrary(() => encodeAttributeValue(value, void 0));
  }
  let update = updates.get(selector);
  if (!update) {
    update = {
      content: void 0,
      attributes: /* @__PURE__ */ new Map()
    };
    updates.set(selector, update);
  }
  if (attribute === void 0) {
    update.content = value;
  } else {
    update.attributes.set(attribute, value);
  }
}
for (const [selector, count] of flagCounts) {
  if (count > 1) {
    exitWithError(`Flag "--${selector}" was specified ${count} times; each flag can only be set once`);
  }
}
if (bareFlags.has("help")) {
  showHelp(helpOptions);
  process.exit(0);
}
if (bareFlags.has("version")) {
  console.log(version);
  process.exit(0);
}
const filePath = argv._.file;
if (!filePath) {
  console.error('Error: Missing required parameter "<file>"');
  process.exit(1);
}
if (argv._.length > 1) {
  exitWithError(`Unexpected extra arguments: ${argv._.slice(1).join(", ")}`);
}
if (updates.size === 0) {
  const content = await readFile(filePath, "utf8");
  process.stdout.write(`${JSON.stringify(getCommentMarkAll(content), null, "	")}
`);
  process.exit(0);
}
const original = await readFile(filePath, "utf8");
const buildReplacement = ({ content, attributes }) => {
  if (attributes.size === 0) {
    return content;
  }
  const requestedContent = content !== void 0 && content.includes("\n") ? `
${content}
` : content;
  const requestedAttributes = Object.fromEntries(attributes);
  return ({ attributes: current }, index) => {
    if (index > 0) {
      return void 0;
    }
    return {
      attributes: {
        ...current,
        ...requestedAttributes
      },
      content: requestedContent
    };
  };
};
const updated = [];
const unchanged = [];
const missing = [];
const matched = /* @__PURE__ */ Object.create(null);
for (const [selector, update] of updates) {
  const marker = await fromLibrary(() => getCommentMark(original, selector));
  if (marker === null) {
    missing.push(selector);
    continue;
  }
  const replacement = buildReplacement(update);
  matched[selector] = replacement;
  const applied = await fromLibrary(() => commentMark(original, { [selector]: replacement }));
  if (applied === original) {
    unchanged.push(selector);
  } else {
    updated.push(selector);
  }
}
const updatedSource = await fromLibrary(() => commentMark(original, matched));
const report = () => {
  if (updated.length > 0) {
    console.error(`Updated: ${updated.join(", ")}`);
  }
  if (unchanged.length > 0) {
    console.error(`Unchanged: ${unchanged.join(", ")}`);
  }
  if (missing.length > 0) {
    console.error(`Missing: ${missing.join(", ")}`);
  }
};
if (missing.length === updates.size) {
  report();
  exitWithError(`No matching markers found for any of the ${missing.length} requested selectors`);
}
if (updated.length === 0) {
  report();
  if (missing.length > 0) {
    process.exit(1);
  }
  console.error(`${filePath} is unchanged. All ${updates.size} requested selectors already match.`);
  process.exit(0);
}
await writeFile(filePath, updatedSource);
report();
const summary = [
  unchanged.length > 0 && `${unchanged.length} unchanged`,
  missing.length > 0 && `${missing.length} missing`
].filter(Boolean).join("; ");
console.error(`Saved ${filePath}. Updated ${updated.length} selector${updated.length === 1 ? "" : "s"}${summary ? `; ${summary}` : ""}.`);
if (missing.length > 0) {
  process.exitCode = 1;
}

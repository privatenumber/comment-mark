#!/usr/bin/env node
import { cli } from 'cleye';
import { i as isAttributeName, e as encodeAttributeValue, g as getCommentMarkAll, c as createDocument, s as selectMarkers, m as markerData, a as commentMark } from './index-CIXS2ZE-.mjs';
import { readFile, writeFile } from 'node:fs/promises';

var name$1 = "comment-mark";
var version = "0.0.0-semantic-release";
var description$1 = "Read and update sections of Markdown using HTML comment placeholders";
var packageJson = {
	name: name$1,
	version: version,
	description: description$1};

class CliError extends Error {
  name = "CliError";
}

const { description, name } = packageJson;
const helpOptions = {
  description,
  usage: `${name} <file> [--<selector>=<value>...] [--<selector>.<attribute>=<value>...]`,
  examples: [
    `${name} README.md --lastUpdated="$(date -Iseconds)"`,
    `${name} README.md --item.status="archived"`,
    `${name} README.md --"contributors[role='maintainer']"="$(git shortlog -se HEAD -- .)"`
  ]
};
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
const parseArguments = (argv) => {
  const parsed = cli({
    name,
    // Keep `[file]` optional: a required `<file>` aborts inside cli() with
    // "Missing required parameter" before the `--help`/`--version` checks
    // below can run. The requirement is enforced after those flags.
    parameters: ["[file]"],
    // Markers accept arbitrary names, so a marker can be named `help`. cleye's
    // default Boolean `help` flag (alias `-h`) would consume `--help=<value>`
    // and print help instead, so it's disabled; bare flags are handled below.
    help: false
  }, void 0, argv);
  const updates = /* @__PURE__ */ new Map();
  const flagCounts = /* @__PURE__ */ new Map();
  const bareFlags = /* @__PURE__ */ new Set();
  for (const argument of argv) {
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
      throw new CliError(`Unknown flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
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
      throw new CliError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value> or --<selector>.<attribute>=<value>)`);
    }
    if (attribute !== void 0 && !isAttributeName(attribute)) {
      throw new CliError(`Invalid attribute name in flag ${JSON.stringify(argument)} (expected --<selector>.<attribute>=<value>)`);
    }
    flagCounts.set(target, (flagCounts.get(target) ?? 0) + 1);
    if (separator === -1) {
      throw new CliError(`No value provided for flag "--${target}" (expected --${target}=<value>)`);
    }
    const value = flag.slice(separator + 1);
    if (attribute !== void 0) {
      encodeAttributeValue(value, void 0);
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
      throw new CliError(`Flag "--${selector}" was specified ${count} times; each flag can only be set once`);
    }
  }
  if (bareFlags.has("help")) {
    return {
      type: "help",
      showHelp: () => parsed.showHelp(helpOptions)
    };
  }
  if (bareFlags.has("version")) {
    return { type: "version" };
  }
  const filePath = parsed._.file;
  if (!filePath) {
    throw new CliError('Missing required parameter "<file>"');
  }
  if (parsed._.length > 1) {
    throw new CliError(`Unexpected extra arguments: ${parsed._.slice(1).join(", ")}`);
  }
  if (updates.size === 0) {
    return {
      type: "read",
      filePath
    };
  }
  return {
    type: "update",
    filePath,
    updates
  };
};

const readMarkers = async (filePath) => {
  const content = await readFile(filePath, "utf8");
  const markers = getCommentMarkAll(content);
  process.stdout.once("error", () => {
  });
  const error = await new Promise((resolve) => {
    process.stdout.write(`${JSON.stringify(markers, null, "	")}
`, resolve);
  });
  if (error && error.code !== "EPIPE" && error.code !== "ENOTCONN") {
    throw new CliError(error.message);
  }
};

const planUpdate = async (original, updates) => {
  const updated = [];
  const unchanged = [];
  const missing = [];
  const matched = /* @__PURE__ */ Object.create(null);
  const originalDocument = createDocument(original);
  const matchedIndexes = /* @__PURE__ */ new Map();
  for (const [selector, update] of updates) {
    const state = selectMarkers(originalDocument, selector)[0];
    if (!state) {
      missing.push(selector);
      continue;
    }
    const current = markerData(state).attributes;
    matched[selector] = update.attributes.size === 0 ? update.content : {
      // Spread preserves an own `__proto__` data property, so an attribute
      // with that name survives as data instead of hitting the prototype setter.
      attributes: {
        ...current,
        ...Object.fromEntries(update.attributes)
      },
      content: update.content
    };
    matchedIndexes.set(selector, state.index);
  }
  const output = await commentMark(original, matched);
  const outputDocument = createDocument(output);
  for (const [selector, index] of matchedIndexes) {
    const before = originalDocument.markers[index];
    const after = outputDocument.markers[index];
    if (original.slice(before.node.openingStart, before.node.contentEnd) === output.slice(after.node.openingStart, after.node.contentEnd)) {
      unchanged.push(selector);
    } else {
      updated.push(selector);
    }
  }
  return {
    output,
    updated,
    unchanged,
    missing
  };
};
const updateMarkers = async (filePath, updates) => {
  const original = await readFile(filePath, "utf8");
  const {
    output,
    updated,
    unchanged,
    missing
  } = await planUpdate(original, updates);
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
    throw new CliError(`No matching markers found for any of the ${missing.length} requested selectors`);
  }
  const exitCode = missing.length > 0 ? 1 : 0;
  if (updated.length === 0) {
    report();
    if (missing.length === 0) {
      console.error(`${filePath} is unchanged. All ${updates.size} requested selectors already match.`);
    }
    return exitCode;
  }
  await writeFile(filePath, output);
  report();
  const summary = [
    unchanged.length > 0 && `${unchanged.length} unchanged`,
    missing.length > 0 && `${missing.length} missing`
  ].filter(Boolean).join("; ");
  console.error(`Saved ${filePath}. Updated ${updated.length} selector${updated.length === 1 ? "" : "s"}${summary ? `; ${summary}` : ""}.`);
  return exitCode;
};

const run = async () => {
  const command = parseArguments(process.argv.slice(2));
  if (command.type === "help") {
    command.showHelp();
    return 0;
  }
  if (command.type === "version") {
    console.log(packageJson.version);
    return 0;
  }
  if (command.type === "read") {
    await readMarkers(command.filePath);
    return 0;
  }
  return updateMarkers(command.filePath, command.updates);
};
try {
  process.exitCode = await run();
} catch (error) {
  if (error instanceof CliError || error instanceof Error && error.message.startsWith("[comment-mark] ")) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}

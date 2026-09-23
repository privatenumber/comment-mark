#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { getCommentMarkAll, commentMark, getCommentMark } from './index.mjs';

var name = "comment-mark";
var version = "0.0.0-semantic-release";
var description = "Interpolate strings with HTML comment markers";

const exitWithError = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};
const helpOptions = {
  description,
  usage: `${name} <file> [--<selector>=<value>...]`,
  examples: [
    `${name} README.md --lastUpdated="$(date -Iseconds)"`,
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
const data = /* @__PURE__ */ Object.create(null);
const findFlagSeparator = (flag) => {
  let depth = 0;
  let quote = "";
  for (let index = 0; index < flag.length; index += 1) {
    const character = flag[index];
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
        depth += 1;
        break;
      }
      case "]": {
        depth -= 1;
        break;
      }
      case "=": {
        if (depth === 0) {
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
  const separator = findFlagSeparator(flag);
  const selector = separator === -1 ? flag : flag.slice(0, separator);
  if (separator === -1 && (selector === "help" || selector === "version")) {
    flagCounts.set(selector, (flagCounts.get(selector) ?? 0) + 1);
    bareFlags.add(selector);
    continue;
  }
  if (selector === "") {
    exitWithError(`Invalid flag ${JSON.stringify(argument)} (expected --<selector>=<value>)`);
  }
  flagCounts.set(selector, (flagCounts.get(selector) ?? 0) + 1);
  if (separator === -1) {
    exitWithError(`No value provided for flag "--${selector}" (expected --${selector}=<value>)`);
  }
  data[selector] = flag.slice(separator + 1);
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
if (Object.keys(data).length === 0) {
  const content = await readFile(filePath, "utf8");
  process.stdout.write(`${JSON.stringify(getCommentMarkAll(content), null, "	")}
`);
  process.exit(0);
}
const original = await readFile(filePath, "utf8");
const fromLibrary = (call) => {
  try {
    return call();
  } catch (error) {
    if (error instanceof Error) {
      exitWithError(error.message);
    }
    throw error;
  }
};
const updated = [];
const unchanged = [];
const missing = [];
const matched = /* @__PURE__ */ Object.create(null);
for (const [selector, value] of Object.entries(data)) {
  if (fromLibrary(() => getCommentMark(original, selector)) === null) {
    missing.push(selector);
    continue;
  }
  matched[selector] = value;
  if (fromLibrary(() => commentMark(original, { [selector]: value })) === original) {
    unchanged.push(selector);
  } else {
    updated.push(selector);
  }
}
const updatedSource = fromLibrary(() => commentMark(original, matched));
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
if (missing.length === Object.keys(data).length) {
  report();
  exitWithError(`No matching markers found for any of the ${missing.length} requested selectors`);
}
if (updated.length === 0) {
  report();
  if (missing.length > 0) {
    process.exit(1);
  }
  console.error(`${filePath} is unchanged. All ${Object.keys(data).length} requested values already match.`);
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

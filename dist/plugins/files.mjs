import { readFile } from 'node:fs/promises';
import path from 'node:path';

const files = ({
  baseDirectory,
  tagName = "file"
}) => {
  if (typeof baseDirectory !== "string" || baseDirectory === "") {
    throw new Error("[comment-mark] files() requires a baseDirectory");
  }
  return {
    [tagName]: async ({ attributes }) => {
      const filePath = attributes.path;
      if (filePath === void 0) {
        throw new Error(`[comment-mark] The ${JSON.stringify(tagName)} marker has no "path" attribute`);
      }
      try {
        return await readFile(path.resolve(baseDirectory, filePath), "utf8");
      } catch (error) {
        throw new Error(
          `[comment-mark] Cannot read ${JSON.stringify(filePath)} for the ${JSON.stringify(tagName)} marker`,
          { cause: error }
        );
      }
    }
  };
};

export { files };

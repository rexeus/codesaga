// What the package check knows about `oxc-parser`, the CLI's one runtime dependency.
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Reads a nested field without trusting the shape on the way.
 * @param {string} json
 * @param {ReadonlyArray<string>} fields
 * @returns {unknown}
 */
export const valueAt = (json, ...fields) =>
  fields.reduce(
    /** @type {(value: unknown, field: string) => unknown} */
    (value, field) =>
      typeof value === "object" && value !== null
        ? Object.getOwnPropertyDescriptor(value, field)?.value
        : undefined,
    JSON.parse(json),
  );

/**
 * The exact version of `oxc-parser` that the workspace catalog pins.
 * @param {string} repository the workspace root
 * @returns {string}
 */
export const pinnedParserVersion = (repository) => {
  const catalog = readFileSync(join(repository, "pnpm-workspace.yaml"), "utf8");
  const pinned = /^ {2}oxc-parser: (\d+\.\d+\.\d+)$/mu.exec(catalog)?.[1];
  if (pinned === undefined) {
    throw new Error(
      "pnpm-workspace.yaml's catalog does not pin oxc-parser to an exact version.",
    );
  }
  return pinned;
};

/**
 * Removes every installed platform binding of oxc-parser, whichever layout the
 * package manager chose; links that now dangle go too.
 * @param {string} directory
 */
export const removeParserBindings = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const location = join(directory, entry.name);
    const isBinding =
      entry.name.startsWith("@oxc-parser+binding-") ||
      (entry.name.startsWith("binding-") &&
        basename(directory) === "@oxc-parser");
    if (isBinding) {
      rmSync(location, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      removeParserBindings(location);
    }
  }
};

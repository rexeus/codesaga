import packageJson from "../package.json" with { type: "json" };

/** The published `codesaga` version, shown by `--version` and written to reports. */
export const version = packageJson.version;

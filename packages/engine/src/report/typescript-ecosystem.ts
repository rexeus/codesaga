// Owns the shape of `deepDives.typescript.ecosystem`: the frameworks and tools the code uses, from its imports and manifests.
// Detection comes from a curated table, so a tool missing from it is absent here, not unused.
import { Schema } from "effect";

const Count = Schema.Natural;

/** What a detected tool is for. */
const ToolCategory = Schema.Literals([
  "framework",
  "server",
  "data",
  "library",
  "validation",
  "test",
  "lint",
  "format",
  "build",
  "monorepo",
]);

const ImportedPackage = Schema.Struct({ name: Schema.String, files: Count });

/**
 * The stack in data. Imports are counted per file, once per package however
 * many statements name it; a package imported only by config files or
 * scripts counts like any other.
 */
export const Ecosystem = Schema.Struct({
  /**
   * Tools of the curated table that the code imports or a `package.json`
   * declares (in `dependencies`, `devDependencies` or `peerDependencies`),
   * most importing files first, then most declaring manifests, then by name.
   */
  tools: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      category: ToolCategory,
      /** Parsed files that import it. */
      files: Count,
      /** `package.json` files that declare it. */
      declaredIn: Count,
    }),
  ),
  /** The ten packages imported by the most files, without Node built-ins and the repository's own workspace packages, most files first, then by name. */
  packages: Schema.Array(ImportedPackage).check(Schema.isMaxLength(10)),
  /** The ten Node built-ins (`fs`, `node:path/posix` as `path`) imported by the most files, most first, then by name. */
  nodeBuiltins: Schema.Array(ImportedPackage).check(Schema.isMaxLength(10)),
  /** Dependencies of the `package.json` files read, distinct by name over all of them; workspace packages (`workspace:` ranges) are left out. */
  dependencies: Schema.Struct({
    manifests: Count,
    runtime: Count,
    dev: Count,
  }),
  /** Calls of functions named `use` and a capital or digit, such as React hooks, and the files that make them. Counted whether or not React is used. */
  hooks: Schema.Struct({ calls: Count, files: Count }),
});
export type Ecosystem = typeof Ecosystem.Type;

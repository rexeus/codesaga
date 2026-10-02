// Owns the shape of `deepDives.typescript.modules`: which module system the code uses and how much of it Node can run unbuilt.
// Counts of files and statements, never a verdict on either system.
import { Schema } from "effect";

const Count = Schema.Natural;

/**
 * The module systems of the parsed files, tests included. A file is ESM when
 * it has an `import` or `export` declaration or uses `import.meta`, and
 * CommonJS when it calls `require`, assigns `module.exports` or `exports.x`,
 * or uses `import x = require()` or `export =`; a file can be both, and a
 * file with neither (a script that imports nothing) is in neither count.
 */
export const Modules = Schema.Struct({
  /** Parsed files, the denominator of the file counts. */
  files: Count,
  esmFiles: Count,
  commonjsFiles: Count,
  /** Files in both counts: they use ESM syntax and CommonJS. */
  bothFiles: Count,
  /**
   * Import declarations that bind something (`import "x"` for its effect is
   * not one), and how many bind only types, with `import type` or a `type`
   * marker on every binding.
   */
  imports: Schema.Struct({ declarations: Count, typeOnly: Count }),
  /**
   * What Node's type stripping cannot erase, and so cannot run unbuilt: the
   * files that use any of it, and the uses. Enums count when not ambient,
   * namespaces when they hold runtime code.
   */
  nonErasable: Schema.Struct({
    files: Count,
    enums: Count,
    namespaces: Count,
    parameterProperties: Count,
    decorators: Count,
  }),
  /** The `package.json` files read, by their `type`; `unspecified` has none, which Node reads as CommonJS. */
  packageTypes: Schema.Struct({
    module: Count,
    commonjs: Count,
    unspecified: Count,
  }),
});
export type Modules = typeof Modules.Type;

// Owns the module facts of one file: which module system its syntax uses and what it imports and re-exports.
// Read from the syntax tree, so `require` and `module.exports` count where the parser's module record has no entry for them.

import type { Node } from "@oxc-project/types";

import { identifierName, staticString } from "../node-guards.js";
import type { FactsCollector } from "../parsed-source.js";
import { onNodes } from "../walk.js";
import type { NodeHandlers, NodeOfType } from "../walk.js";
import { shadowing } from "./shadowing.js";
import type { Shadowing } from "./shadowing.js";

/** How a file reaches another module. */
type ModuleRequestKind =
  /** `import ... from "x"` and `import "x"`. */
  | "import"
  /** `export ... from "x"`: a re-export. */
  | "export"
  /** `import("x")` with a string literal, and `import("x").T` in a type. */
  | "dynamic"
  /** `require("x")` with a string literal, and `import x = require("x")`. */
  | "require";

/** A module a file names by a literal specifier. */
type ModuleRequest = {
  readonly specifier: string;
  readonly kind: ModuleRequestKind;
  /** The request only brings types: `import type`, or every binding marked `type`. */
  readonly isType: boolean;
};

/**
 * Module facts of one file. `esm` counts its `import` and `export`
 * declarations and `import.meta` uses, `commonjs` its `require` calls,
 * `module.exports` and `exports.x` assignments, `import x = require()` and
 * `export =`; both add up over files. `imports` counts the import
 * declarations that bind something, `typeImports` those that bind only types.
 * `requests` lists each distinct request once; `dynamicUnresolvable` counts
 * the `import()` and `require()` calls whose argument is not a constant text.
 */
export type ModuleFacts = {
  readonly esm: number;
  readonly commonjs: number;
  readonly imports: number;
  readonly typeImports: number;
  readonly dynamicUnresolvable: number;
  readonly requests: ReadonlyArray<ModuleRequest>;
};

/** Whether the node is `exports`, `module.exports` or a member of either, with those names not bound by the file. */
const isExportsRoot = (node: Node, isBound: Shadowing["isBound"]): boolean => {
  if (node.type === "Identifier") {
    return node.name === "exports" && !isBound("exports");
  }
  if (node.type !== "MemberExpression") {
    return false;
  }
  const isModuleExports =
    identifierName(node.object) === "module" &&
    !isBound("module") &&
    !node.computed &&
    identifierName(node.property) === "exports";
  return isModuleExports || isExportsRoot(node.object, isBound);
};

const isTypeOnlySpecifier = (specifier: Node): boolean =>
  specifier.type === "ImportSpecifier" && specifier.importKind === "type";

type Declaration = NodeOfType<"ImportDeclaration">;

const isTypeOnlyImport = ({ importKind, specifiers }: Declaration): boolean =>
  importKind === "type" ||
  (specifiers.length > 0 &&
    specifiers.every((specifier) => isTypeOnlySpecifier(specifier)));

/** The counts and requests while a file is read. */
type Tally = {
  esm: number;
  commonjs: number;
  imports: number;
  typeImports: number;
  dynamicUnresolvable: number;
  readonly requests: Map<string, ModuleRequest>;
};

const record = (
  tally: Tally,
  source: Node | null | undefined,
  kind: ModuleRequestKind,
  isType: boolean,
): void => {
  const specifier = staticString(source);
  if (specifier === undefined) {
    const isComputed =
      source !== null &&
      source !== undefined &&
      kind !== "import" &&
      kind !== "export";
    tally.dynamicUnresolvable += isComputed ? 1 : 0;
  } else {
    tally.requests.set(`${kind}\0${isType}\0${specifier}`, {
      specifier,
      kind,
      isType,
    });
  }
};

/** `import` and `export` declarations, `import.meta` and `import()`. */
const esmHandlers = (tally: Tally): NodeHandlers => ({
  ImportDeclaration: (node) => {
    const isType = isTypeOnlyImport(node);
    const binds = node.specifiers.length > 0;
    tally.esm += 1;
    tally.imports += binds ? 1 : 0;
    tally.typeImports += binds && isType ? 1 : 0;
    record(tally, node.source, "import", isType);
  },
  ExportNamedDeclaration: (node) => {
    tally.esm += 1;
    const isType =
      node.exportKind === "type" ||
      (node.specifiers.length > 0 &&
        node.specifiers.every(({ exportKind }) => exportKind === "type"));
    record(tally, node.source, "export", isType);
  },
  ExportAllDeclaration: (node) => {
    tally.esm += 1;
    record(tally, node.source, "export", node.exportKind === "type");
  },
  ExportDefaultDeclaration: () => {
    tally.esm += 1;
  },
  MetaProperty: (node) => {
    tally.esm += node.meta.name === "import" ? 1 : 0;
  },
  ImportExpression: (node) => {
    record(tally, node.source, "dynamic", false);
  },
  TSImportType: (node) => {
    record(tally, node.source, "dynamic", true);
  },
});

/** `require`, `module.exports`, `exports.x`, `import x = require()` and `export =`. */
const commonjsHandlers = (
  tally: Tally,
  isBound: Shadowing["isBound"],
): NodeHandlers => ({
  TSImportEqualsDeclaration: (node) => {
    if (node.moduleReference.type === "TSExternalModuleReference") {
      tally.commonjs += 1;
      record(
        tally,
        node.moduleReference.expression,
        "require",
        node.importKind === "type",
      );
    }
  },
  TSExportAssignment: () => {
    tally.commonjs += 1;
  },
  CallExpression: ({ callee, arguments: args }) => {
    if (
      identifierName(callee) === "require" &&
      !isBound("require") &&
      args[0] !== undefined
    ) {
      tally.commonjs += 1;
      record(tally, args[0], "require", false);
    }
  },
  AssignmentExpression: ({ left }) => {
    tally.commonjs +=
      left.type === "MemberExpression" && isExportsRoot(left, isBound) ? 1 : 0;
  },
});

/** Counts module facts over one walk. */
export const moduleCollector = (): FactsCollector<ModuleFacts> => {
  const tally: Tally = {
    esm: 0,
    commonjs: 0,
    imports: 0,
    typeImports: 0,
    dynamicUnresolvable: 0,
    requests: new Map(),
  };
  const scope = shadowing();
  const handlers = onNodes({
    ...esmHandlers(tally),
    ...commonjsHandlers(tally, scope.isBound),
  });
  return {
    enter: (node) => {
      scope.enter(node);
      handlers(node);
    },
    leave: scope.leave,
    finish: () => ({ ...tally, requests: [...tally.requests.values()] }),
  };
};

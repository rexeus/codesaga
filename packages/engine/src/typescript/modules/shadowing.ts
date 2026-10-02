// Owns knowing whether `require`, `exports` or `module` still mean CommonJS where a file uses them.
// A file that declares its own `require` (`const require = createRequire(import.meta.url)`) or a function that takes `exports` as a parameter is not using CommonJS there. Top-level declarations and the parameters of the functions around a node are enough; block-scoped shadowing is not tracked.

import type { Node } from "@oxc-project/types";

import { declarationOf, identifierName } from "../node-guards.js";
import { onNodes } from "../walk.js";
import type { NodeHandlers } from "../walk.js";

const TRACKED = new Set(["require", "exports", "module"]);

/** The tracked names a pattern of a declaration or a parameter binds directly. */
const trackedNamesOf = (
  pattern: Node | null | undefined,
): ReadonlyArray<string> => {
  if (pattern?.type === "AssignmentPattern") {
    return trackedNamesOf(pattern.left);
  }
  const name = identifierName(pattern);
  return name !== undefined && TRACKED.has(name) ? [name] : [];
};

/** The tracked names a top-level statement declares. */
const declaredBy = (statement: Node): ReadonlyArray<string> => {
  if (statement.type === "ImportDeclaration") {
    return statement.specifiers.flatMap(({ local }) => trackedNamesOf(local));
  }
  if (statement.type === "VariableDeclaration") {
    return statement.declarations.flatMap(({ id }) => trackedNamesOf(id));
  }
  if (
    statement.type === "FunctionDeclaration" ||
    statement.type === "ClassDeclaration" ||
    statement.type === "TSImportEqualsDeclaration"
  ) {
    return trackedNamesOf(statement.id);
  }
  return [];
};

/** The tracked names a function takes as parameters. */
const parametersOf = (node: {
  readonly params: ReadonlyArray<Node>;
}): ReadonlyArray<string> =>
  node.params.flatMap((parameter) => trackedNamesOf(parameter));

/** Which of `require`, `exports` and `module` the file has bound, as the walk goes. */
export type Shadowing = {
  readonly isBound: (name: string) => boolean;
  /** Tables for the walk's `enter` and `leave`. */
  readonly enter: (node: Node) => void;
  readonly leave: (node: Node) => void;
};

/** A tracker that learns the top-level declarations at the program and the parameters at each function. */
export const shadowing = (): Shadowing => {
  const topLevel = new Set<string>();
  const parameters = new Map<string, number>();
  const adjust = (names: ReadonlyArray<string>, by: 1 | -1): void => {
    for (const name of names) {
      parameters.set(name, (parameters.get(name) ?? 0) + by);
    }
  };
  const entering = (node: { readonly params: ReadonlyArray<Node> }): void => {
    adjust(parametersOf(node), 1);
  };
  const leaving = (node: { readonly params: ReadonlyArray<Node> }): void => {
    adjust(parametersOf(node), -1);
  };
  const enter: NodeHandlers = {
    Program: ({ body }) => {
      for (const statement of body) {
        const declaration = declarationOf(statement);
        for (const name of [
          ...declaredBy(statement),
          ...(declaration === null ? [] : declaredBy(declaration)),
        ]) {
          topLevel.add(name);
        }
      }
    },
    FunctionDeclaration: entering,
    FunctionExpression: entering,
    ArrowFunctionExpression: entering,
  };
  const leave: NodeHandlers = {
    FunctionDeclaration: leaving,
    FunctionExpression: leaving,
    ArrowFunctionExpression: leaving,
  };
  return {
    isBound: (name) => topLevel.has(name) || (parameters.get(name) ?? 0) > 0,
    enter: onNodes(enter),
    leave: onNodes(leave),
  };
};

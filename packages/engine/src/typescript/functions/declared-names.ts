// Owns finding the names a function declares in its own scope: its parameters, its variables, the functions and classes declared in it and its catch parameters.
// Used to tell a call of the function's own name from a call of a local that shadows it. Block scopes are not told apart: a name declared anywhere in the function shadows throughout.

import type { Node } from "@oxc-project/types";

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string";

/** The patterns nested in a binding pattern: the elements of `[a, b]`, the values of `{ a, b: c }`, the target of `...rest` and of `a = 1`. */
const partsOf = (pattern: Node): ReadonlyArray<Node | null> => {
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.map((property) =>
      property.type === "Property" ? property.value : property,
    );
  }
  if (pattern.type === "ArrayPattern") {
    return pattern.elements;
  }
  if (pattern.type === "AssignmentPattern") {
    return [pattern.left];
  }
  if (pattern.type === "RestElement") {
    return [pattern.argument];
  }
  return pattern.type === "TSParameterProperty" ? [pattern.parameter] : [];
};

/** Adds the names a binding pattern declares: `a`, `{ a, b: [c] }`, `...rest`, `a = 1`. */
const addPattern = (
  pattern: Node | null | undefined,
  names: Set<string>,
): void => {
  if (pattern === null || pattern === undefined) {
    return;
  }
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return;
  }
  for (const part of partsOf(pattern)) {
    addPattern(part, names);
  }
};

/** Adds what the node itself declares, and says whether the walk goes on below it: not into a function. */
const declare = (node: Node, names: Set<string>): boolean => {
  if (
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return false;
  }
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    names.add(node.id?.name ?? "");
    return node.type === "ClassDeclaration";
  }
  if (node.type === "VariableDeclarator") {
    addPattern(node.id, names);
  } else if (node.type === "CatchClause") {
    addPattern(node.param, names);
  }
  return true;
};

/** Collects the names declared in a scope below `value`, leaving nested functions out. */
const scan = (value: unknown, names: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      scan(item, names);
    }
  } else if (isNode(value) && declare(value, names)) {
    for (const key in value) {
      if (key !== "parent") {
        scan(Reflect.get(value, key), names);
      }
    }
  }
};

/** The names declared in the scope of a function with these parameters and this body. */
export const declaredNames = (
  params: ReadonlyArray<Node>,
  body: Node | null,
): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const parameter of params) {
    addPattern(parameter, names);
  }
  scan(body, names);
  names.delete("");
  return names;
};

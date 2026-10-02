// Owns naming functions from the code around them: the variable, property, method or export a function is bound to.
// The walk meets the binding before the function, so the binding registers the name and the function reads it when it opens.

import type { Class, Node } from "@oxc-project/types";

import { identifierName } from "../node-guards.js";
import type { NodeHandlers } from "../walk.js";

/** What the code around a function says about it. */
type FunctionName = {
  readonly name: string;
  readonly binding?: string;
  readonly method?: string;
  /** Where the member that holds the function starts, when that is before the function itself. */
  readonly start?: number;
};

/** The names registered for functions not yet entered. */
export type FunctionNames = WeakMap<Node, FunctionName>;

/** The name of a function nothing around it names. */
export const ANONYMOUS = "(anonymous)";

const MAX_NAME_LENGTH = 80;

/** A name short enough to keep in the facts of every file. */
export const shortName = (name: string): string =>
  name.length > MAX_NAME_LENGTH
    ? `${name.slice(0, MAX_NAME_LENGTH - 1)}…`
    : name;

/** The function an expression is, below the wrappers that change nothing at run time; undefined for any other node. */
const functionOf = (node: Node | null | undefined): Node | undefined => {
  if (node === null || node === undefined) {
    return undefined;
  }
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return node;
  }
  return node.type === "ParenthesizedExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
    ? functionOf(node.expression)
    : undefined;
};

/** The name a key gives a member. */
const keyName = (key: Node, computed: boolean): string => {
  if (computed) {
    return "[computed]";
  }
  if (key.type === "PrivateIdentifier") {
    return `#${key.name}`;
  }
  if (key.type === "Literal") {
    return String(key.value);
  }
  return identifierName(key) ?? "[computed]";
};

const register = (
  names: FunctionNames,
  value: Node | null | undefined,
  name: FunctionName,
): void => {
  const target = functionOf(value);
  if (target !== undefined) {
    names.set(target, name);
  }
};

/** Names the methods, accessors, function-valued fields and static blocks of a class `Class.member`. */
const nameMembers = (names: FunctionNames, node: Class): void => {
  const owner = node.id?.name;
  const qualified = (member: string): string =>
    owner === undefined ? member : `${owner}.${member}`;
  for (const member of node.body.body) {
    if (member.type === "StaticBlock") {
      names.set(member, { name: qualified("static") });
    } else if (
      member.type === "MethodDefinition" ||
      member.type === "PropertyDefinition"
    ) {
      const key = keyName(member.key, member.computed);
      register(names, member.value, {
        name: qualified(key),
        method: key,
        start: member.start,
      });
    }
  }
};

/** Handlers that register the name of every function a binding or a member holds, before the walk reaches it. */
export const nameHandlers = (names: FunctionNames): NodeHandlers => ({
  VariableDeclarator: ({ id, init }) => {
    const name = identifierName(id);
    if (name !== undefined) {
      register(names, init, { name, binding: name });
    }
  },
  AssignmentExpression: ({ operator, left, right }) => {
    if (operator !== "=") {
      return;
    }
    const bound = identifierName(left);
    if (bound !== undefined) {
      register(names, right, { name: bound, binding: bound });
    } else if (left.type === "MemberExpression" && !left.computed) {
      const member = identifierName(left.property);
      if (member !== undefined) {
        register(names, right, { name: member, method: member });
      }
    }
  },
  Property: ({ key, value, computed, method }) => {
    const member = keyName(key, computed);
    register(names, value, {
      name: member,
      ...(method ? { method: member } : {}),
    });
  },
  ClassDeclaration: (node) => {
    nameMembers(names, node);
  },
  ClassExpression: (node) => {
    nameMembers(names, node);
  },
  ExportDefaultDeclaration: ({ declaration }) => {
    const unnamed =
      declaration.type !== "FunctionDeclaration" || declaration.id === null;
    if (unnamed) {
      register(names, declaration, { name: "default" });
    }
  },
});

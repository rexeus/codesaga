// Owns walking an ESTree program: every node once, parents before children.
// Generic over the node's own properties, so it needs no oxc runtime code and follows the parser's node set.

import type { Node } from "@oxc-project/types";

/** What a walk reports: each node when it is entered, and again when its children are done. */
export type NodeVisitor = {
  readonly enter: (node: Node) => void;
  readonly leave?: ((node: Node) => void) | undefined;
};

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string";

const visit = (value: unknown, visitor: NodeVisitor): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor);
    }
  } else if (isNode(value)) {
    walk(value, visitor);
  }
};

/**
 * Calls `visitor.enter` for `root` and every node below it, in source order
 * of the properties, and `visitor.leave` for each after its children. Nested deeper than the stack allows, it throws a
 * `RangeError` for the caller to count as a skipped file.
 */
export const walk = (root: Node, visitor: NodeVisitor): void => {
  visitor.enter(root);
  for (const key in root) {
    // `parent` points upwards when a parser option adds it; following it would loop.
    if (key !== "parent") {
      visit(Reflect.get(root, key), visitor);
    }
  }
  visitor.leave?.(root);
};

/**
 * The node interfaces whose `type` can be `Type`. `Extract` would miss the
 * interfaces whose `type` is a union of several, such as `Function` or `Class`.
 */
export type NodeOfType<Type extends string> = Node extends infer Candidate
  ? Candidate extends { readonly type: infer Own }
    ? Type extends Own
      ? Candidate
      : never
    : never
  : never;

/** What to do for the nodes of each type; a handler receives its type's node. */
export type NodeHandlers = {
  readonly [Type in Node["type"]]?: (node: NodeOfType<Type>) => void;
};

/**
 * One function for a table of handlers, to pass as `enter` or `leave`, which calls the handler of the node's
 * type. The table's keys type each handler's node, so a handler cannot read a
 * field its node lacks; the lookup by the node's own `type` is the one place
 * the types cannot follow.
 */
export const onNodes = (handlers: NodeHandlers): ((node: Node) => void) => {
  return (node) => {
    const handler: unknown = Reflect.get(handlers, node.type);
    if (typeof handler === "function") {
      Reflect.apply(handler, handlers, [node]);
    }
  };
};

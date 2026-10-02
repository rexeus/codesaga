// Owns counting the sequences of logical operators: one increment for each run of like operators, as the whitepaper has it.
// `a && b && c` is one run, `a && b || c` two, and `a && !(b && c)` two, since the negation starts a sequence of its own.
// `??` is not in the whitepaper's list: it is a leaf operand that adds nothing.

import type { Expression, LogicalExpression, Node } from "@oxc-project/types";

import { unwrapExpression } from "../node-guards.js";

/** Whether the operator is one of the two whose sequences the whitepaper counts. */
export const isCountedOperator = (operator: string): boolean =>
  operator === "&&" || operator === "||";

/** The operators of the sequence the expression starts, in source order; each of its logical nodes is added to `seen`. */
const operatorsOf = (
  expression: Expression,
  seen: WeakSet<Node>,
): ReadonlyArray<string> => {
  const inner = unwrapExpression(expression);
  if (
    inner.type !== "LogicalExpression" ||
    !isCountedOperator(inner.operator)
  ) {
    return [];
  }
  seen.add(inner);
  return [
    ...operatorsOf(inner.left, seen),
    inner.operator,
    ...operatorsOf(inner.right, seen),
  ];
};

/**
 * The increments of the sequence that begins at `node`: 1 for the operators
 * in a row, and 1 more each time the operator changes along the expression
 * read left to right, through parentheses. `seen` receives every logical node
 * the sequence spans, so a caller counts each sequence once, at its root.
 */
export const sequenceIncrements = (
  node: LogicalExpression,
  seen: WeakSet<Node>,
): number => {
  const operators = operatorsOf(node, seen);
  return operators.filter(
    (operator, index) => index === 0 || operator !== operators[index - 1],
  ).length;
};

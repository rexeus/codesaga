// Owns the small questions the fact collectors ask of a node: a name, a string, the method a call names.
// They read untrusted syntax, so each answers undefined rather than assuming a shape.

import type { Expression, Node, Statement } from "@oxc-project/types";

/** The name of an identifier node, undefined for any other node. */
export const identifierName = (
  node: Node | null | undefined,
): string | undefined => (node?.type === "Identifier" ? node.name : undefined);

/** The value of a string literal, undefined for any other node. */
export const stringValue = (
  node: Node | null | undefined,
): string | undefined =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : undefined;

/**
 * The text of a string literal or of a template literal without
 * expressions, which names the same constant; undefined for any other node.
 */
export const staticString = (
  node: Node | null | undefined,
): string | undefined => {
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return stringValue(node);
};

/** The name in `callee.name(...)`, undefined for a call that is not a plain method call. */
export const calledMethod = (
  callee: Node,
): { readonly object: Node; readonly name: string } | undefined => {
  if (callee.type !== "MemberExpression" || callee.computed) {
    return undefined;
  }
  const name = identifierName(callee.property);
  return name === undefined ? undefined : { object: callee.object, name };
};

/** The top-level declaration a statement holds, looking through `export` and `export default`. */
export const declarationOf = (statement: Statement): Node | null =>
  statement.type === "ExportNamedDeclaration" ||
  statement.type === "ExportDefaultDeclaration"
    ? statement.declaration
    : statement;

/** The expression below any parentheses, `as`, `satisfies`, `!` and type-assertion wrappers around it. */
export const unwrapExpression = (expression: Expression): Expression =>
  expression.type === "ParenthesizedExpression" ||
  expression.type === "TSAsExpression" ||
  expression.type === "TSSatisfiesExpression" ||
  expression.type === "TSNonNullExpression" ||
  expression.type === "TSTypeAssertion"
    ? unwrapExpression(expression.expression)
    : expression;

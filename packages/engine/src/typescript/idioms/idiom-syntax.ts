// Owns the syntax questions behind the idiom counts: what an alias, a namespace or an export declares.

import type { Node, TSType } from "@oxc-project/types";

import { stringValue } from "../node-guards.js";
import type { NodeOfType } from "../walk.js";

/** Whether the type is a union of at least two string literals, such as `"a" | "b"`. */
export const isStringUnion = (type: TSType): boolean =>
  type.type === "TSUnionType" &&
  type.types.length > 1 &&
  type.types.every(
    (member) =>
      member.type === "TSLiteralType" &&
      stringValue(member.literal) !== undefined,
  );

const isTypeOnlyStatement = (statement: Node): boolean =>
  statement.type === "TSInterfaceDeclaration" ||
  statement.type === "TSTypeAliasDeclaration" ||
  (statement.type === "ExportNamedDeclaration" &&
    statement.declaration !== null &&
    isTypeOnlyStatement(statement.declaration));

/**
 * Whether a namespace has runtime code: it is not ambient, and its body is
 * not only types, which erase.
 */
export const isRuntimeNamespace = (
  node: NodeOfType<"TSModuleDeclaration">,
): boolean =>
  !node.declare &&
  node.body !== null &&
  !node.body.body.every((statement) => isTypeOnlyStatement(statement));

const declaredNames = (declaration: Node | null): number => {
  if (declaration === null) {
    return 0;
  }
  return declaration.type === "VariableDeclaration"
    ? declaration.declarations.length
    : 1;
};

/** How many names an `export { }` or `export <declaration>` exports; `export * from` and the default specifier are counted elsewhere. */
export const exportedNames = (
  node: NodeOfType<"ExportNamedDeclaration">,
): number => {
  const named = node.specifiers.filter(
    ({ exported }) =>
      !(exported.type === "Identifier" && exported.name === "default"),
  );
  return declaredNames(node.declaration) + named.length;
};

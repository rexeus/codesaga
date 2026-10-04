// Owns which `any` keywords are benign: the ones TypeScript offers no better type for.
// A rest parameter `...args: any[]` and a generic constraint `T extends any` say "anything", which is what they mean; an `any` anywhere else is a hole.

import type { Node, TSType } from "@oxc-project/types";

/** The `any` keyword node of `any`, `any[]`, `Array<any>` and `ReadonlyArray<any>`; undefined for any other type. */
const anyKeywordOf = (type: TSType): Node | undefined => {
  if (type.type === "TSAnyKeyword") {
    return type;
  }
  if (type.type === "TSArrayType") {
    return anyKeywordOf(type.elementType) === undefined
      ? undefined
      : type.elementType;
  }
  const isArrayReference =
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    (type.typeName.name === "Array" || type.typeName.name === "ReadonlyArray");
  const argument = isArrayReference ? type.typeArguments?.params[0] : undefined;
  return argument?.type === "TSAnyKeyword" ? argument : undefined;
};

/** Adds to `benign` the `any` keyword that `type`, the type of a rest parameter or a generic constraint, consists of. */
export const benignAnyOf = (
  type: TSType | null | undefined,
  benign: WeakSet<Node>,
): void => {
  const keyword =
    type === null || type === undefined ? undefined : anyKeywordOf(type);
  if (keyword !== undefined) {
    benign.add(keyword);
  }
};

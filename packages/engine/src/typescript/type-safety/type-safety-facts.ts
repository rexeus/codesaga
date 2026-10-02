// Owns the type-safety facts of one file: the escape hatches it uses from the type system and the counterparts that keep types honest.
// Escapes are read from syntax nodes and, for suppressions, from the parser's comments; no checker runs, so a count is a use, never a verdict.

import type { Expression, Node, TSType } from "@oxc-project/types";

import type { FactsCollector } from "../parsed-source.js";
import { enterWith } from "../walk.js";
import { suppressionsOf } from "./suppression-comments.js";

/**
 * Counts of one file. `assertions` counts every `as T` and `<T>x` except
 * `as const`; `doubleAssertions` is the part of them that cast a value that
 * was itself cast to `unknown` or `any`, and `asAny` the part that cast to
 * `any`. `any` counts every `any` keyword in a type, `as any` included, and
 * `unknown` every `unknown` keyword. A count is additive across files.
 */
export type TypeSafetyFacts = {
  readonly any: number;
  readonly assertions: number;
  readonly doubleAssertions: number;
  readonly asAny: number;
  /** Non-null assertions `x!`; `!=` and `!x` are not. */
  readonly nonNull: number;
  readonly tsIgnore: number;
  readonly tsExpectError: number;
  readonly tsNocheck: number;
  /** `eslint-disable*`, `oxlint-disable*` and `biome-ignore` comments. */
  readonly lintDisables: number;
  readonly satisfies: number;
  readonly unknown: number;
  /** Type predicates `x is T` and `asserts x is T`. */
  readonly typePredicates: number;
};

const unwrapParentheses = (expression: Expression): Expression =>
  expression.type === "ParenthesizedExpression"
    ? unwrapParentheses(expression.expression)
    : expression;

const isConstType = (type: TSType): boolean =>
  type.type === "TSTypeReference" &&
  type.typeName.type === "Identifier" &&
  type.typeName.name === "const";

const isEscapeThroughType = ({ type }: TSType): boolean =>
  type === "TSUnknownKeyword" || type === "TSAnyKeyword";

/** Whether the node is a cast to `unknown` or `any`, the first half of a double assertion. */
const isViaCast = (expression: Expression): boolean => {
  const inner = unwrapParentheses(expression);
  return (
    (inner.type === "TSAsExpression" || inner.type === "TSTypeAssertion") &&
    isEscapeThroughType(inner.typeAnnotation)
  );
};

/** Counts type-safety facts over one walk and the file's comments. */
export const typeSafetyCollector = (): FactsCollector<TypeSafetyFacts> => {
  let any = 0;
  let assertions = 0;
  let doubleAssertions = 0;
  let asAny = 0;
  let nonNull = 0;
  let satisfies = 0;
  let unknown = 0;
  let typePredicates = 0;
  const countAssertion = ({
    expression,
    typeAnnotation,
  }: Extract<Node, { type: "TSAsExpression" | "TSTypeAssertion" }>): void => {
    if (isConstType(typeAnnotation)) {
      return;
    }
    assertions += 1;
    asAny += typeAnnotation.type === "TSAnyKeyword" ? 1 : 0;
    doubleAssertions += isViaCast(expression) ? 1 : 0;
  };
  return {
    enter: enterWith({
      TSAnyKeyword: () => {
        any += 1;
      },
      TSUnknownKeyword: () => {
        unknown += 1;
      },
      TSAsExpression: countAssertion,
      TSTypeAssertion: countAssertion,
      TSNonNullExpression: () => {
        nonNull += 1;
      },
      TSSatisfiesExpression: () => {
        satisfies += 1;
      },
      TSTypePredicate: () => {
        typePredicates += 1;
      },
    }),
    finish: ({ comments }) => ({
      any,
      assertions,
      doubleAssertions,
      asAny,
      nonNull,
      satisfies,
      unknown,
      typePredicates,
      ...suppressionsOf(comments),
    }),
  };
};

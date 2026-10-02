// Owns the type-safety facts of one file: the escape hatches it uses from the type system and the counterparts that keep types honest.
// Escapes are read from syntax nodes and, for suppressions, from the parser's comments; no checker runs, so a count is a use, never a verdict.

import type { Expression, Node, TSType } from "@oxc-project/types";

import type { FactsCollector } from "../parsed-source.js";
import { onNodes } from "../walk.js";
import type { NodeHandlers } from "../walk.js";
import { benignAnyOf } from "./benign-any.js";
import { suppressionsOf } from "./suppression-comments.js";
import type { SuppressionCounts } from "./suppression-comments.js";

/**
 * Counts of one file. A count is additive across files.
 *
 * Each field counts one thing: `any` every `any` keyword in a type, `unknown`
 * every `unknown` keyword, `assertions` every `as T` and `<T>x` except
 * `as const`, `doubleAssertions` the part of them that cast a value that was
 * itself cast to `unknown` or `any`, and `asAny` the part that cast to `any`.
 *
 * Three fields exist so that escape _sites_ can be counted without counting
 * one hole twice: `assertionChains` counts an assertion and the assertions
 * it wraps once (`x as unknown as T` is one site), `anyOutsideAssertions`
 * the `any` keywords that are neither inside the type of an assertion nor
 * benign, and `benignAny` the `any` of a rest parameter (`...args: any[]`) and
 * of a generic constraint (`T extends any`).
 */
export type TypeSafetyFacts = {
  readonly any: number;
  readonly assertions: number;
  readonly doubleAssertions: number;
  readonly asAny: number;
  readonly assertionChains: number;
  readonly anyOutsideAssertions: number;
  readonly benignAny: number;
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

type Assertion = Extract<Node, { type: "TSAsExpression" | "TSTypeAssertion" }>;

const unwrapParentheses = (expression: Expression): Expression =>
  expression.type === "ParenthesizedExpression"
    ? unwrapParentheses(expression.expression)
    : expression;

const isConstType = (type: TSType): boolean =>
  type.type === "TSTypeReference" &&
  type.typeName.type === "Identifier" &&
  type.typeName.name === "const";

const isCountedAssertion = (node: Node): node is Assertion =>
  (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
  !isConstType(node.typeAnnotation);

const isEscapeThroughType = ({ type }: TSType): boolean =>
  type === "TSUnknownKeyword" || type === "TSAnyKeyword";

/** Whether the operand is a cast to `unknown` or `any`, the first half of a double assertion. */
const isViaCast = (operand: Expression): boolean =>
  (operand.type === "TSAsExpression" || operand.type === "TSTypeAssertion") &&
  isEscapeThroughType(operand.typeAnnotation);

/** The counts and the nodes the walk has marked, while a file is read. */
type Tally = {
  -readonly [
    Key in keyof Omit<TypeSafetyFacts, keyof SuppressionCounts>
  ]: number;
} & {
  /** The `any` nodes that are benign, found at the rest parameter or constraint that holds them. */
  readonly benign: WeakSet<Node>;
  /** Assertions that another assertion wraps: part of its chain. */
  readonly wrapped: WeakSet<Node>;
  /** The target types of assertions: an `any` inside one belongs to the assertion. */
  readonly targets: WeakSet<Node>;
  insideTarget: number;
};

const noTally = (): Tally => ({
  any: 0,
  assertions: 0,
  doubleAssertions: 0,
  asAny: 0,
  assertionChains: 0,
  anyOutsideAssertions: 0,
  benignAny: 0,
  nonNull: 0,
  satisfies: 0,
  unknown: 0,
  typePredicates: 0,
  benign: new WeakSet(),
  wrapped: new WeakSet(),
  targets: new WeakSet(),
  insideTarget: 0,
});

/** `as`, `<T>` and the `any` keywords, whose counts depend on each other. */
const assertionHandlers = (tally: Tally): NodeHandlers => {
  const countAssertion = (node: Node): void => {
    if (!isCountedAssertion(node)) {
      return;
    }
    const operand = unwrapParentheses(node.expression);
    tally.assertions += 1;
    tally.asAny += node.typeAnnotation.type === "TSAnyKeyword" ? 1 : 0;
    tally.doubleAssertions += isViaCast(operand) ? 1 : 0;
    tally.assertionChains += tally.wrapped.has(node) ? 0 : 1;
    tally.wrapped.add(operand);
    tally.targets.add(node.typeAnnotation);
  };
  return {
    TSAnyKeyword: (node) => {
      tally.any += 1;
      if (tally.benign.has(node)) {
        tally.benignAny += 1;
      } else if (tally.insideTarget === 0) {
        tally.anyOutsideAssertions += 1;
      }
    },
    TSAsExpression: countAssertion,
    TSTypeAssertion: countAssertion,
    RestElement: ({ typeAnnotation }) => {
      benignAnyOf(typeAnnotation?.typeAnnotation, tally.benign);
    },
    TSTypeParameter: ({ constraint }) => {
      benignAnyOf(constraint, tally.benign);
    },
  };
};

/** The counterparts and the plainly counted escapes. */
const simpleHandlers = (tally: Tally): NodeHandlers => ({
  TSUnknownKeyword: () => {
    tally.unknown += 1;
  },
  TSNonNullExpression: () => {
    tally.nonNull += 1;
  },
  TSSatisfiesExpression: () => {
    tally.satisfies += 1;
  },
  TSTypePredicate: () => {
    tally.typePredicates += 1;
  },
});

/** Counts type-safety facts over one walk and the file's comments. */
export const typeSafetyCollector = (): FactsCollector<TypeSafetyFacts> => {
  const tally = noTally();
  const handlers = onNodes({
    ...assertionHandlers(tally),
    ...simpleHandlers(tally),
  });
  return {
    enter: (node) => {
      tally.insideTarget += tally.targets.has(node) ? 1 : 0;
      handlers(node);
    },
    leave: (node) => {
      tally.insideTarget -= tally.targets.has(node) ? 1 : 0;
    },
    finish: ({ comments }) => ({
      any: tally.any,
      assertions: tally.assertions,
      doubleAssertions: tally.doubleAssertions,
      asAny: tally.asAny,
      assertionChains: tally.assertionChains,
      anyOutsideAssertions: tally.anyOutsideAssertions,
      benignAny: tally.benignAny,
      nonNull: tally.nonNull,
      satisfies: tally.satisfies,
      unknown: tally.unknown,
      typePredicates: tally.typePredicates,
      ...suppressionsOf(comments),
    }),
  };
};

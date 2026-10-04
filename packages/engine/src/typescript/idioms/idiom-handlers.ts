// Owns what each kind of node adds to the idiom counts.
// Split by the kind of syntax, so each table stays small; the tables have disjoint keys and the collector merges them.

import type { Node } from "@oxc-project/types";

import { calledMethod } from "../node-guards.js";
import type { NodeHandlers } from "../walk.js";
import type { IdiomCounts } from "./idiom-facts.js";
import { isRuntimeNamespace, isStringUnion } from "./idiom-syntax.js";

const MUTATION_METHODS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);
const TRANSFORM_METHODS = new Set([
  "map",
  "filter",
  "reduce",
  "reduceRight",
  "flatMap",
  "flat",
  "toSorted",
  "toReversed",
  "toSpliced",
]);

/** Declarations of types, enums and namespaces, and the members of classes. */
export const declarationHandlers = (counts: IdiomCounts): NodeHandlers => {
  const countMember = (member: {
    readonly key: { readonly type: string };
    readonly accessibility?: string | null | undefined;
  }): void => {
    counts.hashPrivate += member.key.type === "PrivateIdentifier" ? 1 : 0;
    counts.privateModifiers += member.accessibility === "private" ? 1 : 0;
  };
  return {
    TSInterfaceDeclaration: () => {
      counts.interfaces += 1;
    },
    TSTypeAliasDeclaration: ({ typeAnnotation }) => {
      counts.objectTypes += typeAnnotation.type === "TSTypeLiteral" ? 1 : 0;
      counts.stringUnions += isStringUnion(typeAnnotation) ? 1 : 0;
    },
    TSEnumDeclaration: ({ declare }) => {
      counts.enums += declare ? 0 : 1;
    },
    TSModuleDeclaration: (node) => {
      counts.namespaces += isRuntimeNamespace(node) ? 1 : 0;
    },
    TSParameterProperty: (node) => {
      counts.parameterProperties += 1;
      counts.privateModifiers += node.accessibility === "private" ? 1 : 0;
    },
    Decorator: () => {
      counts.decorators += 1;
    },
    PropertyDefinition: countMember,
    MethodDefinition: countMember,
    AccessorProperty: countMember,
  };
};

/** Variable declarations. */
export const bindingHandlers = (counts: IdiomCounts): NodeHandlers => ({
  VariableDeclaration: ({ kind }) => {
    counts.consts += kind === "const" ? 1 : 0;
    counts.lets += kind === "let" ? 1 : 0;
    counts.vars += kind === "var" ? 1 : 0;
  },
});

/**
 * Whether the receiver of a call is a namespace or a string, whose methods
 * are not the array methods the lists name: `Effect.map`, `Arr.filter`,
 * `"a-b".split`. A PascalCase identifier, a string literal and a template.
 */
const isNamespaceOrText = (receiver: Node): boolean =>
  (receiver.type === "Identifier" && /^[A-Z]/u.test(receiver.name)) ||
  receiver.type === "TemplateLiteral" ||
  (receiver.type === "Literal" && typeof receiver.value === "string");

/** Calls, loops, operators and literals. */
export const expressionHandlers = (counts: IdiomCounts): NodeHandlers => ({
  AwaitExpression: () => {
    counts.awaits += 1;
  },
  CallExpression: ({ callee }) => {
    const call = calledMethod(callee);
    if (call === undefined) {
      return;
    }
    const { name, object } = call;
    counts.thenCalls += name === "then" ? 1 : 0;
    counts.forEachCalls += name === "forEach" ? 1 : 0;
    if (!isNamespaceOrText(object)) {
      counts.mutationCalls += MUTATION_METHODS.has(name) ? 1 : 0;
      counts.transformCalls += TRANSFORM_METHODS.has(name) ? 1 : 0;
    }
  },
  ForOfStatement: () => {
    counts.forOf += 1;
  },
  ChainExpression: () => {
    counts.optionalChains += 1;
  },
  LogicalExpression: ({ operator }) => {
    counts.nullishCoalescing += operator === "??" ? 1 : 0;
  },
  AssignmentExpression: ({ operator }) => {
    counts.nullishCoalescing += operator === "??=" ? 1 : 0;
  },
  ArrayExpression: ({ elements }) => {
    counts.spreads += elements.filter(
      (element) => element?.type === "SpreadElement",
    ).length;
  },
  ObjectExpression: ({ properties }) => {
    counts.spreads += properties.filter(
      (property) => property.type === "SpreadElement",
    ).length;
  },
});

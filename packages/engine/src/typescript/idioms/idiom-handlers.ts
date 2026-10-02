// Owns what each kind of node adds to the idiom counts.
// Split by the kind of syntax, so each table stays small; the tables have disjoint keys and the collector merges them.

import { calledMethod } from "../node-guards.js";
import type { NodeHandlers } from "../walk.js";
import type { IdiomCounts } from "./idiom-facts.js";
import {
  exportedNames,
  isRuntimeNamespace,
  isStringUnion,
} from "./idiom-syntax.js";

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
  "slice",
  "concat",
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

/** Exports and variable declarations. */
export const bindingHandlers = (counts: IdiomCounts): NodeHandlers => ({
  ExportDefaultDeclaration: () => {
    counts.defaultExports += 1;
  },
  ExportNamedDeclaration: (node) => {
    counts.namedExports += exportedNames(node);
    counts.defaultExports += node.specifiers.filter(
      ({ exported }) =>
        exported.type === "Identifier" && exported.name === "default",
    ).length;
  },
  VariableDeclaration: ({ kind }) => {
    counts.consts += kind === "const" ? 1 : 0;
    counts.lets += kind === "let" ? 1 : 0;
    counts.vars += kind === "var" ? 1 : 0;
  },
});

/** Calls, loops, operators and literals. */
export const expressionHandlers = (counts: IdiomCounts): NodeHandlers => ({
  AwaitExpression: () => {
    counts.awaits += 1;
  },
  CallExpression: ({ callee }) => {
    const method = calledMethod(callee)?.name;
    if (method !== undefined) {
      counts.thenCalls += method === "then" ? 1 : 0;
      counts.forEachCalls += method === "forEach" ? 1 : 0;
      counts.mutationCalls += MUTATION_METHODS.has(method) ? 1 : 0;
      counts.transformCalls += TRANSFORM_METHODS.has(method) ? 1 : 0;
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

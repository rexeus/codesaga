// Owns which node types the digest reads little or nothing of: nodes that only describe types, and leaves.
// A digest collector acts on the types it has a handler for; none of the types here is one of them besides `TSAnyKeyword` and `TSTypeParameter`, which the type-safety collector reads to tell a benign `any` from an escape. The walk still enters the children of such a node, so an expression inside one is read as ever.

/** Type nodes that no collector but type safety looks at. Assertions, `!`, `satisfies`, imports and enums are not here: they are code. */
const TYPE_NODE_TYPES: ReadonlySet<string> = new Set([
  "TSAnyKeyword",
  "TSBigIntKeyword",
  "TSBooleanKeyword",
  "TSIntrinsicKeyword",
  "TSNeverKeyword",
  "TSNullKeyword",
  "TSNumberKeyword",
  "TSObjectKeyword",
  "TSStringKeyword",
  "TSSymbolKeyword",
  "TSUndefinedKeyword",
  "TSUnknownKeyword",
  "TSVoidKeyword",
  "TSThisType",
  "TSArrayType",
  "TSCallSignatureDeclaration",
  "TSClassImplements",
  "TSConditionalType",
  "TSConstructSignatureDeclaration",
  "TSConstructorType",
  "TSFunctionType",
  "TSIndexSignature",
  "TSIndexSignatureName",
  "TSIndexedAccessType",
  "TSInferType",
  "TSInterfaceBody",
  "TSInterfaceDeclaration",
  "TSInterfaceHeritage",
  "TSIntersectionType",
  "TSLiteralType",
  "TSMappedType",
  "TSMethodSignature",
  "TSNamedTupleMember",
  "TSOptionalType",
  "TSPropertySignature",
  "TSQualifiedName",
  "TSRestType",
  "TSTemplateLiteralType",
  "TSTupleType",
  "TSTypeAliasDeclaration",
  "TSTypeAnnotation",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypeParameter",
  "TSTypeParameterDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUnionType",
]);

/**
 * Nodes that are leaves, or only wrap a type or a decorator, and that no
 * collector acts on. The one thing a collector does for any node is to deepen
 * the function around it while the walk is inside a body that a structure
 * nests, and a node without a body below it changes nothing by that.
 */
const INERT_NODE_TYPES: ReadonlySet<string> = new Set([
  "DebuggerStatement",
  "EmptyStatement",
  "Identifier",
  "Literal",
  "PrivateIdentifier",
  "Super",
  "TemplateElement",
  "ThisExpression",
]);

/** What a digest does with a node: nothing for an inert node, only type safety's reading for a type node, and everything for code. */
type NodeKind = "inert" | "type" | "code";

const KINDS: ReadonlyMap<string, NodeKind> = new Map([
  ...[...INERT_NODE_TYPES].map((type): [string, NodeKind] => [type, "inert"]),
  ...[...TYPE_NODE_TYPES].map((type): [string, NodeKind] => [type, "type"]),
]);

export const kindOf = (node: { readonly type: string }): NodeKind =>
  KINDS.get(node.type) ?? "code";

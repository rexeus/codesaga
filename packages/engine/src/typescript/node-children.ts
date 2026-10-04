// Owns which properties of each ESTree node type hold child nodes, so that a walk reads those and no others.
// The table is oxc-parser's `visitorKeys` plus `Program.hashbang`, which its visitor skips. `node-children.test.ts` holds it to the installed parser: a parser release that adds a child property fails there until the table follows. A node type that is not in the table is walked by enumerating its properties.

/** One line per node type: the type, then the properties that hold child nodes, in the order the parser makes them. */
const TABLE = `
DebuggerStatement
EmptyStatement
Literal
PrivateIdentifier
Super
TemplateElement
ThisExpression
JSXClosingFragment
JSXEmptyExpression
JSXIdentifier
JSXOpeningFragment
JSXText
TSAnyKeyword
TSBigIntKeyword
TSBooleanKeyword
TSIntrinsicKeyword
TSJSDocUnknownType
TSNeverKeyword
TSNullKeyword
TSNumberKeyword
TSObjectKeyword
TSStringKeyword
TSSymbolKeyword
TSThisType
TSUndefinedKeyword
TSUnknownKeyword
TSVoidKeyword
AccessorProperty decorators key typeAnnotation value
ArrayExpression elements
ArrayPattern decorators elements typeAnnotation
ArrowFunctionExpression typeParameters params returnType body
AssignmentExpression left right
AssignmentPattern decorators left right typeAnnotation
AwaitExpression argument
BinaryExpression left right
BlockStatement body
BreakStatement label
CallExpression callee typeArguments arguments
CatchClause param body
ChainExpression expression
ClassBody body
ClassDeclaration decorators id typeParameters superClass superTypeArguments implements body
ClassExpression decorators id typeParameters superClass superTypeArguments implements body
ConditionalExpression test consequent alternate
ContinueStatement label
Decorator expression
DoWhileStatement body test
ExportAllDeclaration exported source attributes
ExportDefaultDeclaration declaration
ExportNamedDeclaration declaration specifiers source attributes
ExportSpecifier local exported
ExpressionStatement expression
ForInStatement left right body
ForOfStatement left right body
ForStatement init test update body
FunctionDeclaration id typeParameters params returnType body
FunctionExpression id typeParameters params returnType body
Identifier decorators typeAnnotation
IfStatement test consequent alternate
ImportAttribute key value
ImportDeclaration specifiers source attributes
ImportDefaultSpecifier local
ImportExpression source options
ImportNamespaceSpecifier local
ImportSpecifier imported local
LabeledStatement label body
LogicalExpression left right
MemberExpression object property
MetaProperty meta property
MethodDefinition decorators key value
NewExpression callee typeArguments arguments
ObjectExpression properties
ObjectPattern decorators properties typeAnnotation
ParenthesizedExpression expression
Program body hashbang
Property key value
PropertyDefinition decorators key typeAnnotation value
RestElement decorators argument typeAnnotation
ReturnStatement argument
SequenceExpression expressions
SpreadElement argument
StaticBlock body
SwitchCase test consequent
SwitchStatement discriminant cases
TaggedTemplateExpression tag typeArguments quasi
TemplateLiteral quasis expressions
ThrowStatement argument
TryStatement block handler finalizer
UnaryExpression argument
UpdateExpression argument
V8IntrinsicExpression name arguments
VariableDeclaration declarations
VariableDeclarator id init
WhileStatement test body
WithStatement object body
YieldExpression argument
JSXAttribute name value
JSXClosingElement name
JSXElement openingElement children closingElement
JSXExpressionContainer expression
JSXFragment openingFragment children closingFragment
JSXMemberExpression object property
JSXNamespacedName namespace name
JSXOpeningElement name typeArguments attributes
JSXSpreadAttribute argument
JSXSpreadChild expression
TSAbstractAccessorProperty decorators key typeAnnotation
TSAbstractMethodDefinition key value
TSAbstractPropertyDefinition decorators key typeAnnotation
TSArrayType elementType
TSAsExpression expression typeAnnotation
TSCallSignatureDeclaration typeParameters params returnType
TSClassImplements expression typeArguments
TSConditionalType checkType extendsType trueType falseType
TSConstructSignatureDeclaration typeParameters params returnType
TSConstructorType typeParameters params returnType
TSDeclareFunction id typeParameters params returnType body
TSEmptyBodyFunctionExpression id typeParameters params returnType
TSEnumBody members
TSEnumDeclaration id body
TSEnumMember id initializer
TSExportAssignment expression
TSExternalModuleReference expression
TSFunctionType typeParameters params returnType
TSImportEqualsDeclaration id moduleReference
TSImportType source options qualifier typeArguments
TSIndexSignature parameters typeAnnotation
TSIndexedAccessType objectType indexType
TSInferType typeParameter
TSInstantiationExpression expression typeArguments
TSInterfaceBody body
TSInterfaceDeclaration id typeParameters extends body
TSInterfaceHeritage expression typeArguments
TSIntersectionType types
TSJSDocNonNullableType typeAnnotation
TSJSDocNullableType typeAnnotation
TSLiteralType literal
TSMappedType key constraint nameType typeAnnotation
TSMethodSignature key typeParameters params returnType
TSModuleBlock body
TSModuleDeclaration id body
TSNamedTupleMember label elementType
TSNamespaceExportDeclaration id
TSNonNullExpression expression
TSOptionalType typeAnnotation
TSParameterProperty decorators parameter
TSParenthesizedType typeAnnotation
TSPropertySignature key typeAnnotation
TSQualifiedName left right
TSRestType typeAnnotation
TSSatisfiesExpression expression typeAnnotation
TSTemplateLiteralType quasis types
TSTupleType elementTypes
TSTypeAliasDeclaration id typeParameters typeAnnotation
TSTypeAnnotation typeAnnotation
TSTypeAssertion typeAnnotation expression
TSTypeLiteral members
TSTypeOperator typeAnnotation
TSTypeParameter name constraint default
TSTypeParameterDeclaration params
TSTypeParameterInstantiation params
TSTypePredicate parameterName typeAnnotation
TSTypeQuery exprName typeArguments
TSTypeReference typeName typeArguments
TSUnionType types
Hashbang
`;

/** The child properties of each node type the table knows, in walk order; a type without any is a leaf. */
export const CHILD_KEYS: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
  TABLE.trim()
    .split("\n")
    .map((line): [string, ReadonlyArray<string>] => {
      const [type = "", ...keys] = line.split(" ");
      return [type, keys];
    }),
);

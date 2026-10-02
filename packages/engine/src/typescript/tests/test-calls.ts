// Owns recognizing the calls of a test file: a test case or suite declared the way Jest, Vitest, Mocha, node:test, Bun and Playwright do, and its assertions.
// Recognition is by name over the call's shape, since no imports or types are resolved: `it`, `test` and `describe` are taken for the runners' own.

import type {
  CallExpression,
  MemberExpression,
  Node,
} from "@oxc-project/types";

import { stringValue } from "../node-guards.js";

/** A declared test case or suite and how it is marked. */
export type TestCall = {
  readonly kind: "case" | "suite";
  /** A parameterized declaration: `test.each(table)(name, fn)`, counted once however many rows. */
  readonly each: boolean;
  readonly skipped: boolean;
  readonly focused: boolean;
  readonly todo: boolean;
};

const CASE_ROOTS = new Set(["it", "test", "specify", "fit", "xit", "xtest"]);
const SUITE_ROOTS = new Set([
  "describe",
  "suite",
  "context",
  "fdescribe",
  "xdescribe",
]);
const SKIP_ROOTS = new Set(["xit", "xtest", "xdescribe"]);
const FOCUS_ROOTS = new Set(["fit", "fdescribe"]);
/** Members of `it` and `test` that do something else than declare: hooks, fixtures and steps. */
const NOT_DECLARING = new Set([
  "step",
  "beforeEach",
  "afterEach",
  "beforeAll",
  "afterAll",
  "use",
  "extend",
  "configure",
  "setTimeout",
  "expect",
]);
/** Members that turn a declaration into a suite: `test.describe`, `it.layer(layer)("name", ...)`. */
const SUITE_MODIFIERS = new Set(["describe", "suite", "layer"]);

/** A callee read as a chain: its root name, the members after it in order, and which of them were called on the way. */
type Chain = {
  readonly root: string;
  readonly members: ReadonlyArray<string>;
  readonly called: ReadonlyArray<string>;
};

/** The callee a call or a tagged template applies, undefined for any other node. */
const appliedCallee = (node: Node): Node | undefined => {
  if (node.type === "CallExpression") {
    return node.callee;
  }
  return node.type === "TaggedTemplateExpression" ? node.tag : undefined;
};

/** The chain of `it.effect.each(table)("name", fn)`'s callee, undefined for anything that is not names, members and calls. */
const chainOf = (callee: Node): Chain | undefined => {
  if (callee.type === "Identifier") {
    return { root: callee.name, members: [], called: [] };
  }
  if (callee.type === "MemberExpression" && !callee.computed) {
    const inner = chainOf(callee.object);
    return inner === undefined || callee.property.type !== "Identifier"
      ? undefined
      : { ...inner, members: [...inner.members, callee.property.name] };
  }
  const target = appliedCallee(callee);
  const applied = target === undefined ? undefined : chainOf(target);
  const last = applied?.members.at(-1);
  return applied === undefined || last === undefined
    ? undefined
    : { ...applied, called: [...applied.called, last] };
};

type Shape = {
  readonly root: string;
  readonly modifiers: ReadonlyArray<string>;
  /** The modifier that was called before the test's own call, if any. */
  readonly applied?: string;
};

/** The dotted path of an assertion's callee: the root name and the members after it; a call only where a modifier is applied. */
const shapeOf = (callee: Node): Shape | undefined => {
  if (callee.type === "Identifier") {
    return { root: callee.name, modifiers: [] };
  }
  if (callee.type === "MemberExpression" && !callee.computed) {
    const inner = shapeOf(callee.object);
    return inner === undefined ||
      inner.applied !== undefined ||
      callee.property.type !== "Identifier"
      ? undefined
      : { ...inner, modifiers: [...inner.modifiers, callee.property.name] };
  }
  const target = appliedCallee(callee);
  const tagged = target === undefined ? undefined : shapeOf(target);
  const last = tagged?.modifiers.at(-1);
  return tagged !== undefined && last !== undefined && last === "each"
    ? { ...tagged, applied: last }
    : undefined;
};

const isFunction = (node: Node | undefined): boolean =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression";

/** How a call's arguments read as a test's: no test, a pending one without a body, or one with a body. */
const bodyOf = (
  args: CallExpression["arguments"],
): "none" | "pending" | "body" => {
  const [title] = args;
  if (title === undefined) {
    return "none";
  }
  if (stringValue(title) !== undefined || title.type === "TemplateLiteral") {
    return args.length === 1 ? "pending" : "body";
  }
  const named =
    title.type === "Identifier" ||
    title.type === "MemberExpression" ||
    (title.type === "BinaryExpression" && title.operator === "+");
  return named && args.some((argument) => isFunction(argument))
    ? "body"
    : "none";
};

/** Whether the chain is rooted at a test or suite name and uses no member that does something else than declare. */
const isDeclaringChain = ({ root, members }: Chain): boolean =>
  (CASE_ROOTS.has(root) || SUITE_ROOTS.has(root)) &&
  !members.some((member) => NOT_DECLARING.has(member));

/** The declaration a chain makes, read from its root and members. */
const callOf = (chain: Chain, pending: boolean): TestCall => {
  const marked = (name: string): boolean => chain.members.includes(name);
  const isSuite =
    SUITE_ROOTS.has(chain.root) ||
    chain.members.some((member) => SUITE_MODIFIERS.has(member));
  return {
    kind: isSuite ? "suite" : "case",
    each: chain.called.includes("each"),
    skipped: SKIP_ROOTS.has(chain.root) || marked("skip") || marked("fixme"),
    focused: FOCUS_ROOTS.has(chain.root) || marked("only"),
    todo: marked("todo") || pending,
  };
};

/**
 * The test case or suite a call declares, undefined for any other call. Any
 * member chain rooted at `it`, `test` or `describe` (and their aliases) counts
 * that ends in a call with a title and a function, so `it.effect`, `it.live`,
 * `it.prop`, `it.effect.each(table)(...)`, `it.layer(layer)(...)` and
 * `.only`, `.skip` and `.todo` anywhere in the chain are seen; a title alone
 * is a pending case, which Mocha reports as todo.
 */
export const testCallOf = ({
  callee,
  arguments: args,
}: CallExpression): TestCall | undefined => {
  const chain = chainOf(callee);
  if (chain === undefined || !isDeclaringChain(chain)) {
    return undefined;
  }
  const body = bodyOf(args);
  return body === "none" ? undefined : callOf(chain, body === "pending");
};

/** A bare call that asserts: `assert(...)` and the `assertX(...)` helpers, and node's equality functions imported by name. */
const ASSERT_HELPER = /^assert(?:[A-Z]\w*)?$/u;
const EQUALITY = new Set([
  "strictEqual",
  "deepStrictEqual",
  "notStrictEqual",
  "notDeepStrictEqual",
  "deepEqual",
  "notDeepEqual",
]);
const EXPECT_VARIANTS = new Set(["soft", "poll"]);
const TYPE_TESTS = new Set(["expectTypeOf", "assertType", "expectType"]);
const SNAPSHOT_MATCHERS = new Set([
  "toMatchSnapshot",
  "toMatchInlineSnapshot",
  "toMatchFileSnapshot",
  "toThrowErrorMatchingSnapshot",
  "toThrowErrorMatchingInlineSnapshot",
  "toMatchImageSnapshot",
  "toHaveScreenshot",
]);

/** What a call that is not a test declaration is, among the things a test file counts. */
export type TestSignal = "assertion" | "type-test" | "snapshot";

/**
 * Whether the call asserts: `expect(x)`, `expect.soft(x)`, `expect.poll(fn)`,
 * `assert(x)`, `assert.equal(a, b)` and `chai.assert.equal(a, b)`, a bare
 * `assertTrue(x)` or `strictEqual(a, b)`, and a member named `expect` such as
 * supertest's `request(app).get("/").expect(200)`.
 */
const isAssertion = (callee: Node): boolean => {
  if (
    callee.type === "Identifier" &&
    (ASSERT_HELPER.test(callee.name) || EQUALITY.has(callee.name))
  ) {
    return true;
  }
  const path = shapeOf(callee);
  if (path === undefined) {
    return callee.type === "MemberExpression" && isNamedExpect(callee);
  }
  if (path.root === "expect") {
    const [variant, ...more] = path.modifiers;
    return (
      variant === undefined ||
      (more.length === 0 && EXPECT_VARIANTS.has(variant))
    );
  }
  return (
    path.root === "assert" ||
    path.modifiers.slice(0, -1).includes("assert") ||
    path.modifiers.at(-1) === "expect"
  );
};

const isNamedExpect = (callee: MemberExpression): boolean =>
  !callee.computed &&
  callee.property.type === "Identifier" &&
  callee.property.name === "expect";

/** What a call is among the things a test file counts, if anything. `expect(x).toMatchSnapshot()` is two calls: an assertion and a snapshot matcher. */
export const signalOf = ({
  callee,
}: CallExpression): TestSignal | undefined => {
  if (callee.type === "Identifier" && TYPE_TESTS.has(callee.name)) {
    return "type-test";
  }
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    SNAPSHOT_MATCHERS.has(callee.property.name)
  ) {
    return "snapshot";
  }
  return isAssertion(callee) ? "assertion" : undefined;
};

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

const CASE_ROOTS = new Set(["it", "test", "fit", "xit", "xtest"]);
const SUITE_ROOTS = new Set(["describe", "suite", "fdescribe", "xdescribe"]);
const SKIP_ROOTS = new Set(["xit", "xtest", "xdescribe"]);
const FOCUS_ROOTS = new Set(["fit", "fdescribe"]);
/** Modifiers written as a property: `it.only`, `test.describe.serial`. */
const PROPERTY_MODIFIERS = new Set([
  "only",
  "skip",
  "todo",
  "concurrent",
  "sequential",
  "fails",
  "failing",
  "serial",
  "parallel",
  "describe",
  "suite",
]);
/** Modifiers that are called with a table or a condition before the name: `it.each(table)(name, fn)`. */
const APPLIED_MODIFIERS = new Set(["each", "skipIf", "runIf", "for"]);

type Shape = {
  readonly root: string;
  readonly modifiers: ReadonlyArray<string>;
  /** The modifier that was called before the test's own call, if any. */
  readonly applied?: string;
};

/** The dotted path of a callee, the root name and the properties after it. */
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
  if (callee.type === "CallExpression") {
    return appliedShape(shapeOf(callee.callee));
  }
  return callee.type === "TaggedTemplateExpression"
    ? appliedShape(shapeOf(callee.tag))
    : undefined;
};

/** The shape once its last modifier has been called, or undefined when that modifier is not one that is. */
const appliedShape = (shape: Shape | undefined): Shape | undefined => {
  const last = shape?.modifiers.at(-1);
  return shape !== undefined &&
    last !== undefined &&
    APPLIED_MODIFIERS.has(last)
    ? { ...shape, applied: last }
    : undefined;
};

const isFunction = (node: Node | undefined): boolean =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression";

/** Whether the arguments read like a test's: a title, and a body unless the title is a literal. */
const hasTestArguments = (
  [title, body]: CallExpression["arguments"],
  todo: boolean,
): boolean => {
  if (title === undefined) {
    return false;
  }
  if (stringValue(title) !== undefined || title.type === "TemplateLiteral") {
    return todo || body !== undefined;
  }
  const named =
    title.type === "Identifier" ||
    title.type === "MemberExpression" ||
    (title.type === "BinaryExpression" && title.operator === "+");
  return named && isFunction(body);
};

const isKnownShape = ({ modifiers, applied }: Shape): boolean => {
  const called = modifiers.filter((modifier) =>
    APPLIED_MODIFIERS.has(modifier),
  );
  return (
    modifiers.every(
      (modifier) =>
        PROPERTY_MODIFIERS.has(modifier) || APPLIED_MODIFIERS.has(modifier),
    ) && (applied === undefined ? called.length === 0 : called.length === 1)
  );
};

/** The test case or suite a call declares, undefined for any other call. */
export const testCallOf = ({
  callee,
  arguments: args,
}: CallExpression): TestCall | undefined => {
  const shape = shapeOf(callee);
  if (
    shape === undefined ||
    !(CASE_ROOTS.has(shape.root) || SUITE_ROOTS.has(shape.root)) ||
    !isKnownShape(shape)
  ) {
    return undefined;
  }
  const todo = shape.modifiers.includes("todo");
  if (!hasTestArguments(args, todo)) {
    return undefined;
  }
  const isSuite =
    SUITE_ROOTS.has(shape.root) ||
    shape.modifiers.includes("describe") ||
    shape.modifiers.includes("suite");
  return {
    kind: isSuite ? "suite" : "case",
    each: shape.applied === "each",
    skipped: SKIP_ROOTS.has(shape.root) || shape.modifiers.includes("skip"),
    focused: FOCUS_ROOTS.has(shape.root) || shape.modifiers.includes("only"),
    todo,
  };
};

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
 * `assert(x)`, `assert.equal(a, b)` and `chai.assert.equal(a, b)`, and a
 * member named `expect` such as supertest's `request(app).get("/").expect(200)`.
 */
const isAssertion = (callee: Node): boolean => {
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

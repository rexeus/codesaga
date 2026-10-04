import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const testsOf = (text: string) => factsOfText("a.test.ts", text).tests;

/** A test case for each call, which is the only thing in it. */
const oneCallPerCase = (calls: ReadonlyArray<string>): string =>
  calls.map((call, index) => `it("c${index}", () => { ${call}; });`).join("\n");

describe("test facts: cases and their marks", () => {
  it("counts a focused case and the case itself", () => {
    const facts = testsOf(`it.only("a", () => { expect(1).toBe(1); });`);

    expect(facts).toMatchObject({ cases: 1, focused: 1, skipped: 0, todo: 0 });
  });

  it("counts a parameterized case once however many rows, in the call and the template form", () => {
    const facts = testsOf(`
test.each([1, 2, 3])("n %i", (n) => { expect(n).toBeTruthy(); });
test.each\`
  a | b
  \${1} | \${2}
\`("adds $a", ({ a }) => { expect(a).toBe(1); });
it.skip.each([[1]])("skipped %i", () => {});`);

    expect(facts).toMatchObject({ cases: 3, parameterized: 3, skipped: 1 });
  });

  it("counts every skip, focus and todo spelling, a marked suite once as the marker it is", () => {
    const facts = testsOf(`
it.skip("a", () => {});
xit("b", () => {});
xtest("c", () => {});
xdescribe("d", () => {});
describe.skip("e", () => {});
test.describe.skip("f", () => {});
fit("g", () => {});
fdescribe("h", () => {});
describe.only("i", () => {});
test.only("j", () => {});
it.todo("k");
test.todo("l");
it.concurrent("m", async () => {});`);

    expect(facts).toMatchObject({
      cases: 8,
      skipped: 6,
      focused: 4,
      todo: 2,
    });
  });
});

describe("test facts: what is a case", () => {
  it("counts the cases of nested suites and does not count a suite as a case", () => {
    const facts = testsOf(`
describe("a", () => {
  describe("b", () => {
    it("c", () => {});
    test("d", () => {});
  });
});`);

    expect(facts.cases).toBe(2);
  });

  it("does not take other calls on the same names for test cases", () => {
    const facts = testsOf(`
test.step("a", async () => {});
test.beforeEach(() => {});
test.use({ locale: "de" });
test.extend({});
test.skip(browserName === "firefox", "not supported");
test.skip(isCI, "slow");
test(condition, 1);
it.each([1, 2]);
test.describe.configure({ mode: "serial" });
describe();`);

    expect(facts).toMatchObject({ cases: 0, skipped: 0, parameterized: 0 });
  });

  it("takes a title that is a variable or a concatenation when a function follows", () => {
    const facts = testsOf(`
for (const row of rows) { it(row.name, () => {}); }
it("a " + b, () => {});
it(title, helper);`);

    expect(facts.cases).toBe(2);
  });
});

describe("test facts: assertions", () => {
  it("bands the cases by their direct assertions as 0, 1, 2 to 3 and 4 or more", () => {
    const facts = testsOf(`
it("none", () => { helper(); });
it("one", () => { expect(1).toBe(1); });
it("two", () => { expect(1).toBe(1); expect(2).toBe(2); });
it("three", () => { expect(1); expect(2); expect(3); });
it("four", () => { expect(1); expect(2); expect(3); expect(4); });
it("five", () => { expect(1); expect(2); expect(3); expect(4); expect(5); });`);

    expect(facts.assertions).toStrictEqual([1, 1, 2, 2]);
  });

  it("counts assertions in callbacks of the case and leaves out helpers and todo cases", () => {
    const facts = testsOf(`
function check() { expect(1).toBe(1); }
it("a", () => { [1, 2].forEach((x) => expect(x).toBe(x)); check(); });
it.todo("b");`);

    expect(facts.cases).toBe(2);
    expect(facts.assertions).toStrictEqual([0, 1, 0, 0]);
  });

  it("counts the calls of expect, assert, chai and supertest as assertions", () => {
    const facts = testsOf(
      oneCallPerCase([
        "expect(1)",
        "expect.soft(2)",
        "await expect.poll(fn)",
        "assert(true)",
        "assert.equal(1, 1)",
        "assert.strict.deepEqual(1, 1)",
        "chai.assert.equal(1, 1)",
        "chai.expect(1)",
        'request(app).get("/").expect(200)',
      ]),
    );

    expect(facts.assertions).toStrictEqual([0, 9, 0, 0]);
  });

  it("does not count other members of expect or calls that only look alike", () => {
    const facts = testsOf(
      oneCallPerCase([
        "expect.assertions(1)",
        "expect.any(Number)",
        "expect.hasAssertions()",
        "assertions.check(1)",
        "should.equal(1, 1)",
        "check(expect)",
      ]),
    );

    expect(facts.assertions).toStrictEqual([6, 0, 0, 0]);
  });

  it("counts snapshots and type tests apart from assertions", () => {
    const facts = testsOf(`
it("a", () => {
  expect(x).toMatchSnapshot();
  expect(y).toMatchInlineSnapshot();
  expectTypeOf(x).toEqualTypeOf<number>();
  assertType<number>(1);
});`);

    expect(facts).toMatchObject({ snapshots: 2, typeTests: 2 });
    expect(facts.assertions).toStrictEqual([0, 0, 1, 0]);
  });
});

describe("test facts: effect-vitest and mocha shapes", () => {
  it("counts any member of it as a case, with the variants and modifiers anywhere in the chain", () => {
    const facts = testsOf(`
it.effect("a", () => Effect.sync(() => {}));
it.live("b", () => Effect.sync(() => {}));
it.scoped("c", () => Effect.sync(() => {}));
it.scopedLive("d", () => Effect.sync(() => {}));
it.prop("e", [fc.integer()], ([n]) => { expect(n).toBe(n); });
it.effect.only("f", () => Effect.sync(() => {}));
it.live.skip("g", () => Effect.sync(() => {}));
it.effect.skip.each([1, 2])("h %i", (n) => Effect.sync(() => {}));
it.effect.each([1, 2])("i %i", (n) => Effect.sync(() => {}));
it.effect.fails("j", () => Effect.sync(() => {}));
it.effect.todo("k");`);

    expect(facts).toMatchObject({
      cases: 11,
      parameterized: 2,
      skipped: 2,
      focused: 1,
      todo: 1,
    });
  });

  it("counts the cases inside it.layer as cases and the layer as a suite", () => {
    const facts = testsOf(`
it.layer(TestLayer)("service", (it) => {
  it.effect("a", () => Effect.sync(() => { assert.strictEqual(1, 1); }));
  it.effect("b", () => Effect.sync(() => {}));
});
it.layer(TestLayer, { timeout: 1 }).skip("other", (it) => {});`);

    expect(facts).toMatchObject({ cases: 2, skipped: 1 });
    expect(facts.assertions).toStrictEqual([1, 1, 0, 0]);
  });
});

describe("test facts: assertion helpers and mocha shapes", () => {
  it("counts bare assertion helpers inside a case", () => {
    const facts = testsOf(
      oneCallPerCase([
        "assertTrue(x)",
        "assertSome(x, 1)",
        "strictEqual(a, 1)",
        "deepStrictEqual(a, b)",
        "assertJsonSchemaDocument(d)",
        "assertions(x)",
        "equal(a, b)",
      ]),
    );

    expect(facts.assertions).toStrictEqual([2, 5, 0, 0]);
  });

  it("takes mocha's specify and context, and a pending it without a function as a todo case", () => {
    const facts = testsOf(`
context("a", () => {
  specify("b", () => { expect(1); });
  it("pending");
  test.skip("c");
});`);

    expect(facts).toMatchObject({ cases: 3, todo: 2, skipped: 1 });
    expect(facts.assertions).toStrictEqual([0, 1, 0, 0]);
  });

  it("still leaves out steps, hooks and fixtures of the same roots", () => {
    const facts = testsOf(`
test.step("a", async () => {});
test.beforeAll("setup", async () => {});
test.describe.configure("x", () => {});
it.layer.use("x", () => {});`);

    expect(facts.cases).toBe(0);
  });
});

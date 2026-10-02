import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const functionsOf = (text: string, path = "a.ts") =>
  factsOfText(path, text).functions;

/** Three nested ifs: 1 + 2 + 3. */
const SIX = "if (a) { if (b) { if (c) {} } }";

/** The inside of a function that has `lines` non-blank lines with its braces, each comment line followed by a blank one. */
const body = (lines: number): string =>
  Array.from({ length: lines - 2 }, () => "  // x\n\n").join("");

const manyIfs = (count: number): string =>
  Array.from({ length: count }, (_, index) => `  if (c${index}) {}`).join("\n");

describe("function facts: which functions count", () => {
  it("counts declared bodies only, not overloads, ambient functions or abstract methods", () => {
    const facts = functionsOf(
      [
        "declare function ambient(): void;",
        "function overloaded(a: string): void;",
        "function overloaded(a: number): void;",
        "function overloaded(a: unknown): void {}",
        "abstract class A { abstract m(): void; n() {} }",
        "class B { static { init(); } }",
      ].join("\n"),
    );

    expect(facts.count).toBe(3);
  });

  it("counts a function nested in another as a function of its own", () => {
    const facts = functionsOf(`function f(a) { if (a) { return () => 1; } }`);

    expect(facts.count).toBe(2);
  });
});

describe("function facts: names and positions", () => {
  it("names a function by what binds it and records where it starts and how many non-blank lines it has", () => {
    const facts = functionsOf(
      [
        "export function hard(a, b) {",
        "  if (a) {",
        "    if (b) {",
        "      if (a && b) {}",
        "    }",
        "",
        "  }",
        "}",
        "",
        "class Box {",
        "  open(a) {",
        "    if (a) {",
        "      if (a.b) {}",
        "    }",
        "  }",
        "}",
      ].join("\n"),
    );

    expect(facts.notable).toStrictEqual([
      { name: "hard", line: 1, complexity: 7, lines: 7 },
      { name: "Box.open", line: 11, complexity: 3, lines: 5 },
    ]);
  });
});

describe("function facts: names of other bindings", () => {
  it("names variables, properties, assignments, defaults, class members and anonymous callbacks", () => {
    const facts = functionsOf(
      [
        `const handler = (a, b, c) => { ${SIX} };`,
        `const object = { run(a, b, c) { ${SIX} } };`,
        `exports.go = function (a, b, c) { ${SIX} };`,
        `export default function (a, b, c) { ${SIX} }`,
        `register((a, b, c) => { ${SIX} });`,
        `class K { static field = (a, b, c) => { ${SIX} }; static { ${SIX} } }`,
      ].join("\n"),
    );

    expect(facts.notable.map(({ name }) => name)).toStrictEqual([
      "handler",
      "run",
      "go",
      "default",
      "(anonymous)",
      "K.field",
      "K.static",
    ]);
  });

  it("names a function that nothing binds after the function around it", () => {
    const facts = functionsOf(
      `const make = (x) => (a, b, c) => { ${SIX} };\nconst x = 1;`,
    );

    expect(facts.notable.map(({ name }) => name)).toStrictEqual([
      "make > (anonymous)",
    ]);
  });

  it("counts lines from the parser's UTF-16 offsets after astral characters", () => {
    const facts = functionsOf(
      `const face = "🙂🙂";\n// ÄÖü\nfunction f(a, b, c) {\n  ${SIX}\n}\n`,
    );

    expect(facts.notable).toStrictEqual([
      { name: "f", line: 3, complexity: 6, lines: 3 },
    ]);
  });
});

describe("function facts: the list", () => {
  it("lists the functions of 3 or more, hardest first and then by line, forty at most", () => {
    const easy = Array.from(
      { length: 44 },
      (_, index) => `function f${index}(a, b) { if (a) { if (b) {} } }`,
    );
    const facts = functionsOf(
      [
        ...easy,
        `function hardest(a, b, c) { ${SIX} }`,
        "function trivial() {}",
      ].join("\n"),
    );

    expect(facts.count).toBe(46);
    expect(facts.notable).toHaveLength(40);
    expect(facts.notable[0]).toMatchObject({ name: "hardest", complexity: 6 });
    expect(facts.notable.slice(1, 3).map(({ name }) => name)).toStrictEqual([
      "f0",
      "f1",
    ]);
  });
});

describe("function facts: distributions", () => {
  it("bands the scores and sums the lines inside functions of 15 or more", () => {
    const facts = functionsOf(
      [
        `function trivial() {}`,
        `function four(c) {\n${manyIfs(4)}\n}`,
        `function sixteen(c) {\n${manyIfs(16)}\n}`,
        `function twentyFive(c) {\n${manyIfs(25)}\n}`,
      ].join("\n"),
    );

    expect(facts.count).toBe(4);
    expect(facts.complexity).toStrictEqual([2, 0, 0, 1, 1]);
    expect(facts.scores).toStrictEqual([
      [0, 1],
      [4, 1],
      [16, 1],
      [25, 1],
    ]);
    expect(facts.hardLines).toBe(18 + 27);
  });

  it("counts the lines of a function of 15 or more inside another once", () => {
    const facts = functionsOf(
      `function outer(c) {\n  const f = (d) => {\n${manyIfs(16)}\n  };\n${manyIfs(16)}\n}`,
    );

    expect(facts.complexity).toStrictEqual([0, 0, 0, 2, 0]);
    expect(facts.hardLines).toBe(36);
  });

  it("bands the length in non-blank lines, blank lines not counted and comment lines counted", () => {
    const facts = functionsOf(
      [
        `function a() {\n${body(15)}}`,
        `function b() {\n${body(16)}}`,
        `function c() {\n${body(60)}}`,
        `function d() {\n${body(61)}}`,
      ].join("\n"),
    );

    expect(facts.lengths).toStrictEqual([1, 1, 1, 1]);
  });
});

describe("function facts: shape", () => {
  it("counts functions with more than four parameters, a destructured one as one and a typed this as none", () => {
    const facts = functionsOf(
      [
        "function a(this: Window, x, { y, z }, ...rest) {}",
        "function b(a, b, c, d) {}",
        "function c(a, b, c, d, e) {}",
        "const d = (a, { b, c }, [d, e], f, g) => 1;",
      ].join("\n"),
    );

    expect(facts.longParameterLists).toBe(2);
  });

  it("measures the deepest nesting of structures within one function, and a nested function starts again", () => {
    const deep = functionsOf(
      "function a(x) { if (x) { for (;;) { while (x) {} } } }",
    );
    const nested = functionsOf(
      "function b(xs) { if (xs) { xs.map((x) => { if (x) {} }); } }",
    );

    expect([deep.maxDepth, nested.maxDepth]).toStrictEqual([3, 1]);
  });
});

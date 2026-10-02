import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const safety = (text: string, path = "a.ts") =>
  factsOfText(path, text).typeSafety;

describe("type-safety facts: escape hatches in syntax", () => {
  it("counts an explicit any, wherever a type stands", () => {
    const facts = safety(
      "let a: any; function f(x: any[]): any { return x; }\ntype T = Array<any>;\n",
    );

    expect(facts.any).toBe(4);
  });

  it("counts an assertion in both syntaxes and leaves as const alone", () => {
    const facts = safety(
      "const a = x as string;\nconst b = <string>y;\nconst c = [1] as const;\nconst d = <const>[1];\n",
      "a.ts",
    );

    expect(facts.assertions).toBe(2);
  });

  it("counts as unknown as T once as a double assertion, and as any as an assertion to any", () => {
    const facts = safety(
      "const a = x as unknown as T;\nconst b = (y as any) as T;\nconst c = z as any;\n",
    );

    expect(facts).toMatchObject({
      assertions: 5,
      doubleAssertions: 2,
      asAny: 2,
      any: 2,
      unknown: 1,
    });
  });

  it("counts a non-null assertion and not an inequality or a negation", () => {
    const facts = safety("a!.b; c![0]; if (d != e && !f) {}\n");

    expect(facts.nonNull).toBe(2);
  });

  it("counts satisfies, unknown and type predicates as the counterparts", () => {
    const facts = safety(
      "const a = { x: 1 } satisfies T;\nfunction f(v: unknown): v is string { return true; }\nfunction g(v: unknown): asserts v is string {}\n",
    );

    expect(facts).toMatchObject({
      satisfies: 1,
      unknown: 2,
      typePredicates: 2,
    });
  });

  it("counts nothing in a JavaScript file that holds no types", () => {
    const facts = safety("const a = !b && c != d;\n", "a.js");

    expect(facts).toMatchObject({ any: 0, assertions: 0, nonNull: 0 });
  });
});

describe("type-safety facts: suppression comments", () => {
  it("counts each TypeScript directive and the lint suppressions", () => {
    const facts = safety(
      [
        "// @ts-nocheck",
        "// @ts-ignore",
        "/* @ts-ignore */",
        "/// @ts-expect-error because",
        "// eslint-disable-next-line no-console",
        "/* eslint-disable */",
        "// oxlint-disable-line",
        "// biome-ignore lint/complexity: reason",
        "const a = 1;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      tsNocheck: 1,
      tsIgnore: 2,
      tsExpectError: 1,
      lintDisables: 4,
    });
  });

  it("does not count a directive inside a string, a template or a sentence", () => {
    const facts = safety(
      [
        'const a = "// @ts-ignore";',
        "const b = `/* eslint-disable */`;",
        "// we never use @ts-ignore here",
        "// eslint-enable no-console",
        "// @ts-check",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      tsIgnore: 0,
      tsExpectError: 0,
      tsNocheck: 0,
      lintDisables: 0,
    });
  });
});

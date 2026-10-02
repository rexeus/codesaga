import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const markersOf = (text: string) => factsOfText("a.ts", text).markers;

describe("marker facts: debt markers", () => {
  it("counts a marker at the start of a comment line, in line, block and JSDoc comments", () => {
    const facts = markersOf(`
// TODO: one
/* FIXME two */
/**
 * HACK three
 * XXX four
 * TODO(dennis): five
 */
// TODO
`);

    expect(facts).toMatchObject({ todo: 3, fixme: 1, hack: 1, xxx: 1 });
  });

  it("does not count a marker inside a string, a template or code", () => {
    const facts = markersOf(
      'const a = "// TODO fix";\nconst b = `\n// FIXME\n`;\nconst todo = 1; // not a TODO\n',
    );

    expect(facts).toMatchObject({ todo: 0, fixme: 0 });
  });

  it("does not count lower case, longer words or a marker that does not begin the line", () => {
    const facts = markersOf(
      "// todo: no\n// TODOs are many\n// the XXXX banner\n// see HACK later\n",
    );

    expect(facts).toMatchObject({ todo: 0, fixme: 0, hack: 0, xxx: 0 });
  });

  it("counts a comment with an @deprecated tag once, and not a string", () => {
    const facts = markersOf(
      '/** @deprecated use b\n * @deprecated twice */\nexport const a = 1;\nconst s = "@deprecated";\n// @deprecated-ish\n',
    );

    expect(facts.deprecated).toBe(1);
  });
});

describe("marker facts: documented exports", () => {
  it("counts the exported declarations that a JSDoc block directly precedes", () => {
    const facts = markersOf(
      [
        "/** Documented. */",
        "export function a() {}",
        "export const b = 1;",
        "/** Also documented. */",
        "export default class C {}",
        "// a line comment is not JSDoc",
        "export interface D {}",
        "/* nor is a plain block */",
        "export type E = string;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      exportedDeclarations: 5,
      documentedExports: 2,
    });
  });

  it("does not take a license header, or a block a blank line away, for the JSDoc of the next export", () => {
    const facts = markersOf(
      [
        "/** @license MIT",
        " * Copyright someone */",
        "export const a = 1;",
        "",
        "/** Far away. */",
        "",
        "export const b = 1;",
        "/**",
        " * Copyright (c) 2026",
        " */",
        "",
        "export const c = 1;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      exportedDeclarations: 3,
      documentedExports: 0,
    });
  });

  it("counts only declarations: not re-exports, export lists or unexported declarations", () => {
    const facts = markersOf(
      [
        "/** Doc. */",
        "const a = 1;",
        "export { a };",
        'export * from "x";',
        'export { b } from "y";',
        "/** Doc. */",
        "export enum E { A }",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      exportedDeclarations: 1,
      documentedExports: 1,
    });
  });
});

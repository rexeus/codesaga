import { describe, expect, it } from "vitest";

import { commentSyntaxOf } from "./comments.js";
import { measureText } from "./measure-text.js";

// Indentation cases are ported from codeheat's complexity tests.
const measure = (text: string) => measureText(text, commentSyntaxOf(undefined));

describe("measureText indentation levels", () => {
  it("counts one level per two spaces in a file indented by two", () => {
    const text = ["function f() {", "  if (x) {", "    y();", "  }", "}"].join(
      "\n",
    );

    expect(measure(text)).toMatchObject({
      loc: 5,
      levels: 4,
      deepestLevel: 2,
      indentWidth: 2,
    });
  });

  it("counts one level per four spaces in a file indented by four", () => {
    const text = [
      "class A {",
      "    m() {",
      "        return 1;",
      "    }",
      "}",
    ].join("\n");

    expect(measure(text)).toMatchObject({
      loc: 5,
      levels: 4,
      deepestLevel: 2,
      indentWidth: 4,
    });
  });

  it("counts a tab as one level", () => {
    expect(measure("a\n\tb\n\t\tc\n")).toMatchObject({
      loc: 3,
      levels: 3,
      deepestLevel: 2,
    });
  });

  it("skips blank and whitespace-only lines", () => {
    expect(measure("a\n\n   \n  b\n")).toMatchObject({ loc: 2, levels: 1 });
  });
});

describe("measureText indentation width", () => {
  it("detects the most common indentation increase as the unit", () => {
    // increases of 4, 4 and 2 spaces: the unit is 4, so 10 spaces are 2 levels
    const text = ["a", "    b", "        c", "          d"].join("\n");

    expect(measure(text)).toMatchObject({ levels: 5, indentWidth: 4 });
  });

  it("clamps the unit to at least two spaces", () => {
    expect(measure("a\n b\n  c")).toMatchObject({ levels: 1, indentWidth: 2 });
  });

  it("clamps the unit to at most eight spaces", () => {
    expect(measure("a\n            b")).toMatchObject({
      levels: 1,
      indentWidth: 8,
    });
  });

  it("falls back to a width of four without any increase", () => {
    expect(measure("a\nb").indentWidth).toBe(4);
  });

  it("reports zeros for text without code lines", () => {
    expect(measure("\n  \n")).toMatchObject({
      loc: 0,
      levels: 0,
      deepestLevel: 0,
      lineLengths: new Map(),
    });
  });
});

describe("measureText line shapes", () => {
  it("counts the lines that start with a tab or a space", () => {
    expect(measure("a\n\tb\n  c\n d\n\t\te")).toMatchObject({
      tabIndented: 2,
      spaceIndented: 2,
    });
  });

  it("does not count the continuation lines of a block comment as space-indented", () => {
    const text = [
      "/**",
      " * Adds one.",
      " */",
      "function f() {",
      "\treturn 1;",
      "}",
    ].join("\n");

    expect(measureText(text, commentSyntaxOf("TypeScript"))).toMatchObject({
      tabIndented: 1,
      spaceIndented: 0,
    });
  });

  it("counts a space-indented line that opens a block comment as space-indented", () => {
    const text = ["a", "  /* b", "  c */", "  d"].join("\n");

    expect(measureText(text, commentSyntaxOf("TypeScript"))).toMatchObject({
      spaceIndented: 2,
    });
  });

  it("measures line lengths without trailing whitespace or a carriage return", () => {
    expect(measure("ab  \r\n  c\r\nde")).toMatchObject({
      lineLengths: new Map([
        [2, 2],
        [3, 1],
      ]),
    });
  });

  it("counts comment lines by the syntax it is given", () => {
    const text = "// a\ncode\n";

    expect(measureText(text, commentSyntaxOf("TypeScript")).commentLines).toBe(
      1,
    );
    expect(measureText(text, commentSyntaxOf("Python")).commentLines).toBe(0);
  });
});

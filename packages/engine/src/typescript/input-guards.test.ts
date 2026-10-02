import { describe, expect, it } from "vitest";

import { inputGuardReason } from "./input-guards.js";

const repeat = (text: string, times: number): string => text.repeat(times);

/** `open` and `close` on lines of their own, `levels` deep. */
const nested = (open: string, close: string, levels: number): string =>
  `${repeat(`${open}\n`, levels)}${repeat(`${close}\n`, levels)}`;

const generic = (levels: number): string =>
  `type T = ${repeat("Array<\n", levels)}1${repeat(">\n", levels)}`;

const line = (length: number): string => `${repeat("x", length - 1)}\n`;

describe("inputGuardReason size and minification", () => {
  it("lets ordinary code through", () => {
    expect(inputGuardReason("export const a = f(1, [2]);\n")).toBeUndefined();
    expect(inputGuardReason("")).toBeUndefined();
  });

  it("skips a source over 1,048,576 characters and not one of exactly that size", () => {
    const hundred = `${repeat("a", 99)}\n`;
    const atLimit = `${repeat(hundred, 10_485)}${repeat("a", 76)}`;

    expect(atLimit).toHaveLength(1_048_576);
    expect(inputGuardReason(atLimit)).toBeUndefined();
    expect(inputGuardReason(`${atLimit}a`)).toBe("too-large");
  });

  it("skips a source whose non-blank lines average over 300 characters, newlines included", () => {
    expect(inputGuardReason(repeat(line(300), 3))).toBeUndefined();
    expect(inputGuardReason(repeat(line(301), 3))).toBe("minified");
  });

  it("skips a source with a line over 10,000 characters even when the mean is low", () => {
    const shortLines = repeat("a;\n", 200);

    expect(
      inputGuardReason(`${repeat("x", 10_000)}\n${shortLines}`),
    ).toBeUndefined();
    expect(inputGuardReason(`${repeat("x", 10_001)}\n${shortLines}`)).toBe(
      "minified",
    );
  });
});

describe("inputGuardReason nesting", () => {
  it("skips nesting over 1,000 brackets and not exactly 1,000", () => {
    expect(inputGuardReason(nested("[", "]", 1_000))).toBeUndefined();
    expect(inputGuardReason(nested("[", "]", 1_001))).toBe("too-deep");
    expect(inputGuardReason(nested("f(", ")", 1_001))).toBe("too-deep");
    expect(inputGuardReason(nested("{", "}", 1_001))).toBe("too-deep");
  });

  it("counts nested generics, which a TypeScript parser also recurses into", () => {
    expect(inputGuardReason(generic(1_000))).toBeUndefined();
    expect(inputGuardReason(generic(1_001))).toBe("too-deep");
  });

  it("judges depth, not the count of brackets", () => {
    expect(inputGuardReason(repeat("f(g([1]));\n", 5_000))).toBeUndefined();
  });

  it("does not take comparisons for generics", () => {
    expect(
      inputGuardReason(repeat("for (let i=0;i<n;i++) { j<k; }\n", 3_000)),
    ).toBeUndefined();
    expect(
      inputGuardReason(repeat("if (a<b && c<d && e<f) {\n}\n", 3_000)),
    ).toBeUndefined();
  });
});

const fifty = (bracket: string): string => repeat(bracket, 50);

describe("inputGuardReason strings and comments", () => {
  it("ignores brackets in strings and comments", () => {
    expect(
      inputGuardReason(repeat(`s = "${fifty("(")}";\n`, 100)),
    ).toBeUndefined();
    expect(
      inputGuardReason(repeat(`s = '${fifty("[")}';\n`, 100)),
    ).toBeUndefined();
    expect(inputGuardReason(repeat(`// ${fifty("{")}\n`, 100))).toBeUndefined();
    expect(
      inputGuardReason(`/*\n${repeat(`${fifty("(")}\n`, 100)}*/ x;\n`),
    ).toBeUndefined();
  });

  it("reads on after an escaped quote and heals at the end of an unterminated string", () => {
    expect(
      inputGuardReason(repeat(`s = "a\\"${fifty("(")}";\n`, 100)),
    ).toBeUndefined();
    expect(inputGuardReason(`it's\n${repeat("[\n", 1_001)}`)).toBe("too-deep");
  });
});

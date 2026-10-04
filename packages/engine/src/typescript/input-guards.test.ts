import { describe, expect, it } from "vitest";

import { inputGuardReason } from "./input-guards.js";

const repeat = (text: string, times: number): string => text.repeat(times);

const line = (length: number): string => `${repeat("x", length - 1)}\n`;

describe("inputGuardReason", () => {
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

  it("does not skip a long line among ordinary ones", () => {
    const text = `const data = "${repeat("x", 12_000)}";\n${repeat("a;\n", 200)}`;

    expect(inputGuardReason(text)).toBeUndefined();
  });

  it("does not take nesting, brackets or generics for a reason to skip", () => {
    expect(
      inputGuardReason(`${repeat("[\n", 5_000)}${repeat("]\n", 5_000)}`),
    ).toBeUndefined();
    expect(inputGuardReason(repeat("`smile :(`;\n", 1_200))).toBeUndefined();
    expect(inputGuardReason(repeat("x = /[(]/u;\n", 1_200))).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { nonBlankLineCount } from "./text-lines.js";

describe("nonBlankLineCount", () => {
  it.each([
    ["", 0],
    ["\n", 0],
    ["a", 1],
    ["a\n", 1],
    ["a\n\nb", 2],
    ["a\r\n\r\n  \t \r\nb\r\n", 2],
    [" \n \n\uFEFF\n \nx", 1],
    ["a\rb", 1],
    ["\u000B\u000C\n  x  \n", 1],
    ["😀\n\n", 1],
  ])(
    "counts the lines of %j that hold anything but whitespace",
    (text, expected) => {
      expect(nonBlankLineCount(text)).toBe(expected);
    },
  );
});

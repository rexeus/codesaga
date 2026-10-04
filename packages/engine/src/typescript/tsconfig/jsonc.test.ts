import { describe, expect, it } from "vitest";

import { parseJsonc } from "./jsonc.js";

describe("parseJsonc", () => {
  it("reads comments and trailing commas as TypeScript does", () => {
    const text = `{
      // the strict one
      "compilerOptions": {
        "strict": true, /* on */
        "paths": { "@/*": ["./src/*"], },
      },
      "include": ["src",],
    }`;

    expect(parseJsonc(text)).toStrictEqual({
      compilerOptions: { strict: true, paths: { "@/*": ["./src/*"] } },
      include: ["src"],
    });
  });

  it("keeps comment-like text and commas inside strings", () => {
    expect(
      parseJsonc('{"url": "http://example.com/*x*/", "list": "a,]"}'),
    ).toStrictEqual({ url: "http://example.com/*x*/", list: "a,]" });
  });

  it("skips a byte order mark", () => {
    expect(parseJsonc('\uFEFF{"a": 1}')).toStrictEqual({ a: 1 });
  });

  it("returns undefined for text that is not JSON", () => {
    expect(parseJsonc("{ strict: true }")).toBeUndefined();
    expect(parseJsonc("")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { isSourceLanguage, languageOf } from "./languages.js";

describe("languageOf", () => {
  it("names the language of an allow-listed extension, ignoring case", () => {
    expect(languageOf("src/app.tsx")).toBe("TypeScript");
    expect(languageOf("lib/index.MTS")).toBe("TypeScript");
    expect(languageOf("main.rs")).toBe("Rust");
    expect(languageOf("scripts/run.bash")).toBe("Shell");
  });

  it("has no language for other extensions, dotfiles and extensionless names", () => {
    expect(languageOf("README.md")).toBeUndefined();
    expect(languageOf(".ts")).toBeUndefined();
    expect(languageOf("src/.ts")).toBeUndefined();
    expect(languageOf("Makefile")).toBeUndefined();
  });

  it("allow-lists exactly the paths that have a language", () => {
    expect(isSourceLanguage("a.py")).toBe(true);
    expect(isSourceLanguage("a.txt")).toBe(false);
  });
});

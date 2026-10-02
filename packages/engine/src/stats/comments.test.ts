import { describe, expect, it } from "vitest";

import { commentSyntaxOf } from "./comments.js";
import { measureText } from "./measure-text.js";

const commentLinesOf = (language: string | undefined, lines: string[]) =>
  measureText(lines.join("\n"), commentSyntaxOf(language)).commentLines;

describe("comment lines", () => {
  it("counts line comments and every line of a block in a slash language", () => {
    expect(
      commentLinesOf("TypeScript", [
        "// a",
        "code",
        "/* b */",
        "/*",
        "  * c",
        "  */",
        "x /* trailing */",
        "/** d */",
      ]),
    ).toBe(6);
  });

  it("counts indented comments but not a trailing comment", () => {
    expect(
      commentLinesOf("Rust", ["    // indented", "let x = 1; // trailing"]),
    ).toBe(1);
  });

  it("counts hash comments but not a shebang", () => {
    expect(
      commentLinesOf("Python", [
        "#!/usr/bin/env python",
        "# note",
        "x = 1  # trailing",
        "  # indented",
      ]),
    ).toBe(2);
  });
});

describe("comment lines in other families", () => {
  it("counts dash comments and C blocks in SQL", () => {
    expect(commentLinesOf("SQL", ["-- a", "select 1;", "/* b", "c */"])).toBe(
      3,
    );
  });

  it("counts only dash comments in Haskell", () => {
    expect(commentLinesOf("Haskell", ["-- a", "x = 1", "// b"])).toBe(1);
  });

  it("counts HTML block comments across lines", () => {
    expect(
      commentLinesOf("HTML", ["<!-- a -->", "<div>", "<!--", "x", "-->"]),
    ).toBe(4);
  });

  it("counts only blocks in CSS", () => {
    expect(
      commentLinesOf("CSS", [
        "/* a */",
        "a { color: red; } /* x */",
        "// not a comment",
      ]),
    ).toBe(1);
  });

  it("counts slash and hash comments in PHP", () => {
    expect(commentLinesOf("PHP", ["# a", "// b", "/* c */", "$x = 1;"])).toBe(
      3,
    );
  });

  it("counts the lines of a block that never closes", () => {
    expect(commentLinesOf("Go", ["/* open", "still", "code?"])).toBe(3);
  });

  it("counts no comment lines in a language without a listed syntax or an unknown one", () => {
    expect(commentLinesOf("Erlang", ["// a", "# b", "% c"])).toBe(0);
    expect(commentLinesOf(undefined, ["// a", "# b"])).toBe(0);
  });
});

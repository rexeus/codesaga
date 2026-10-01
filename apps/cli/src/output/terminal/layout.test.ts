import { describe, expect, it } from "vitest";

import { fitEscaped } from "./layout.js";

describe("fitEscaped", () => {
  it("returns text that fits unchanged apart from escaping", () => {
    expect(fitEscaped("Tomás Herrera", 24)).toBe("Tomás Herrera");
    expect(fitEscaped("a\u001Bb", 24)).toBe("a\\u001bb");
  });

  it("ends in an ellipsis within the width when the text is longer", () => {
    expect(fitEscaped("abcdefghij", 5)).toBe("abcd…");
  });

  it("drops a control character's whole escape when it straddles the cut", () => {
    expect(fitEscaped("ab\u001Bcdef", 5)).toBe("ab…");
  });

  it("drops a surrogate pair whole when it straddles the cut", () => {
    expect(fitEscaped("ab😀cdef", 4)).toBe("ab…");
  });

  it("measures East Asian wide characters as two columns", () => {
    const name = "漢".repeat(23);

    expect(fitEscaped(name, 24)).toBe(`${"漢".repeat(11)}…`);
    expect(fitEscaped("漢".repeat(12), 24)).toBe("漢".repeat(12));
  });

  it("keeps a combining mark with its base character at the cut", () => {
    expect(fitEscaped("abcde\u0301fgh", 6)).toBe("abcde\u0301…");
    expect(fitEscaped("e\u0301".repeat(6), 6)).toBe("e\u0301".repeat(6));
  });

  it("keeps a joined emoji whole at the cut and counts it as two columns", () => {
    const family = "👨‍👩‍👧";

    expect(fitEscaped(`ab${family}cd`, 5)).toBe(`ab${family}…`);
    expect(fitEscaped(`ab${family}cd`, 4)).toBe("ab…");
  });
});

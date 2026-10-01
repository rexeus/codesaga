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
});

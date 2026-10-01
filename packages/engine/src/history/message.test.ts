import { describe, expect, it } from "vitest";

import { parseMarkers } from "./message.js";

const claude = {
  key: "Co-Authored-By",
  value: "Claude <noreply@anthropic.com>",
};

describe("parseMarkers co-author lines", () => {
  it("keeps co-author lines of the body that git did not parse as trailers, indented or not", () => {
    const body =
      "Squash it\n\n* fix a\n\n  Co-Authored-By: Claude <noreply@anthropic.com>\n\n" +
      "Co-authored-by: Jane Doe <jane@example.com>\nMore text after the line.\n";

    expect(parseMarkers(body, [])).toStrictEqual([
      "Co-Authored-By: Claude <noreply@anthropic.com>",
      "Co-authored-by: Jane Doe <jane@example.com>",
    ]);
  });

  it("does not repeat a co-author that git parsed as a trailer", () => {
    const body = "Fix\n\nCo-Authored-By:   Claude   <noreply@anthropic.com>\n";

    expect(parseMarkers(body, [claude])).toStrictEqual([]);
  });

  it("ignores prose that mentions co-authoring and lines without an address", () => {
    const body =
      "Pair with Claude <noreply@anthropic.com>, as co-authored-by: Claude says.\n" +
      "Co-authored-by: Claude\n";

    expect(parseMarkers(body, [])).toStrictEqual([]);
  });
});

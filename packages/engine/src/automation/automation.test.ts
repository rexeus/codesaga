import { describe, it } from "vitest";

describe("automation", () => {
  it.todo(
    "totals the four classes, and the totals equal the sum of the months",
  );
  it.todo("emits every month of the window, empty ones with zeros");
  it.todo("counts tool authored and assisted commits separately");
  it.todo(
    "lists tools sorted by authored plus assisted commits descending, then name",
  );
  it.todo(
    "leaves a generic bot without a tool out of the tool list but in the bot total",
  );
  it.todo("reports zeros and no tools for a window without commits");
});

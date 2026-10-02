import { describe, it } from "vitest";

describe("historyEventHighlights", () => {
  it.todo("reports an anniversary within 7 days of the first commit day");
  it.todo("reports no anniversary 8 days away");
  it.todo("reports newcomers whose first commit is at most 90 days old");
  it.todo("names at most five newcomers");
  it.todo("reports no newcomers when every contributor started earlier");
  it.todo("reports the most renamed file as the rename record");
  it.todo(
    "reports the commit with the most net deleted code lines as the biggest cleanup",
  );
  it.todo("reports no cleanup when no commit removes more code than it adds");
});

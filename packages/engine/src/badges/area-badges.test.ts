import { describe, it } from "vitest";

describe("areaBadges", () => {
  it.todo("awards island with the evidence of the sole expert's share");
  it.todo(
    "awards orphaned when no active expert covers more than half of the files",
  );
  it.todo("awards single expert when one person is the only expert");
  it.todo(
    "awards shared knowledge at 3 active experts and a truck factor of 3",
  );
  it.todo("withholds shared knowledge at 2 active experts");
  it.todo(
    "awards knowledge fading when the main expert has been silent for 3 to 6 months",
  );
  it.todo(
    "withholds knowledge fading when the main expert committed within 3 months",
  );
  it.todo(
    "awards handover when a new expert rises while the previous main expert is dormant",
  );
  it.todo("awards new for an area created in the last 90 days");
  it.todo(
    "awards in focus to the area with the most commits in the window only",
  );
  it.todo("awards quiet when unchanged for 6 months");
  it.todo("awards newcomer-friendly at 2 first commits in 180 days");
  it.todo("awards well tested at 40 percent test files");
  it.todo("withholds well tested below 40 percent");
  it.todo("orders the badges by priority");
  it.todo("awards no badge to a rest area");
});

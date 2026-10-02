import { describe, it } from "vitest";

describe("rhythmHighlights", () => {
  it.todo("reports the longest run of days with a commit as the streak");
  it.todo("reports no streak below its threshold");
  it.todo("counts a commit on the author's local day, not the UTC day");
  it.todo("reports the day with the most commits as the busiest day");
  it.todo(
    "reports night owls when enough human commits fall between 22:00 and 05:00 local time",
  );
  it.todo("reports no night owls below the threshold");
  it.todo("reports the weekend share when it passes the threshold");
  it.todo("leaves bot and agent commits out of both shares");
});

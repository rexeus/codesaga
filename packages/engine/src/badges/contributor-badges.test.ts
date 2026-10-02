import { describe, it } from "vitest";

describe("contributorBadges", () => {
  it.todo("awards all-rounder at half of the areas and at least 4");
  it.todo("withholds all-rounder below 4 areas");
  it.todo(
    "awards specialist when 80 percent of the commits fall into one area",
  );
  it.todo("names the area in the specialist label");
  it.todo("awards cleaner at net 500 deleted code lines");
  it.todo("withholds cleaner at 499");
  it.todo("awards founder to the first author of 25 percent of today's files");
  it.todo("awards keeper to the only active expert of an area");
  it.todo("awards tester when 40 percent of the changed files are tests");
  it.todo(
    "awards documenter when 40 percent of the commits touch documentation",
  );
  it.todo("awards steady for a commit in each of the last 6 months");
  it.todo("withholds steady when one of the last 6 months has no commit");
  it.todo("awards welcome to a first commit at most 90 days old");
  it.todo("awards returning after a pause of 6 months");
  it.todo("awards reviewer at 10 reviews with --github");
  it.todo("withholds reviewer without --github");
  it.todo("orders the badges by priority");
});

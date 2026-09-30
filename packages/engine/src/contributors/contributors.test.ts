import { describe, it } from "vitest";

describe("contributors", () => {
  it.todo("counts commits and agent-assisted commits per identity");
  it.todo("leaves bot and agent authors out");
  it.todo("sorts by commits descending, then by name");
  it.todo("counts distinct local dates as active days");
  it.todo(
    "counts the lines of code paths only, so a lockfile change adds nothing",
  );
  it.todo(
    "cuts areas at depth two below the scope and keeps the top three by commits",
  );
  it.todo(
    "marks a contributor active with a commit exactly 183 days before now, and inactive one day earlier",
  );
  it.todo(
    "reports the first and last commit time of each contributor as ISO timestamps",
  );
  it.todo("uses the most recent name of an identity");
  it.todo("returns no contributors for a window without human commits");
});

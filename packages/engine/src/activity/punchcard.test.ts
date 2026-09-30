import { describe, it } from "vitest";

describe("punchcard", () => {
  it.todo("returns 7 rows of 24 zeros for no commits");
  it.todo("counts a commit at 23:30+02:00 in its local weekday and hour 23");
  it.todo(
    "moves a commit across midnight when the author's offset changes its local day",
  );
  it.todo("puts Monday in row 0 and Sunday in row 6");
  it.todo("counts commits of every class");
});

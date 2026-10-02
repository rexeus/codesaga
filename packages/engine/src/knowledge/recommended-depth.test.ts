import { describe, it } from "vitest";

describe("recommendDepth", () => {
  it.todo("aims at two areas per active contributor");
  it.todo("clamps the target to 4 areas for a single contributor");
  it.todo("clamps the target to 25 areas for a large team");
  it.todo("sizes the target by every window contributor when nobody is active");
  it.todo("picks the level whose viable count is closest to the target");
  it.todo("picks the coarser level on a tie");
  it.todo("picks the only level when there is one");
  it.todo(
    "states the level, the area count and the contributor count in the reason",
  );
});

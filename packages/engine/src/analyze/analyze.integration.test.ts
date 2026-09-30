import { describe, it } from "vitest";

describe("analyze", () => {
  it.todo(
    "reports the exact overview, contributor order, automation totals and window of a known history",
  );
  it.todo("merges a contributor's second email through .mailmap");
  it.todo("counts a Dependabot commit as a bot commit and lists the tool");
  it.todo(
    "counts a Claude Code co-authored commit as agent-assisted for its human author",
  );
  it.todo("keeps a renamed file's history under one path");
  it.todo("counts no lines for a lockfile change");
  it.todo(
    "starts the window at the first commit in scope when since is absent",
  );
  it.todo("narrows the activity sections to since, resolved against TestClock");
  it.todo("counts only commits with a change under the scope for a scoped run");
  it.todo("reports the branch, or null when HEAD is detached");
  it.todo("marks a shallow clone and leaves out its boundary commit");
  it.todo(
    "reports a null head and no commits for a repository without commits",
  );
  it.todo("fails with NotAGitRepository outside a git work tree");
  it.todo("fails with GitNotFound when git is not on PATH");
  it.todo("fails with InvalidSince for an unparseable since value");
});

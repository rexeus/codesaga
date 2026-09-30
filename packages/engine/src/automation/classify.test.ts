import { describe, it } from "vitest";

describe("classifyCommit", () => {
  it.todo("classifies a real-format sample of every signature table entry");
  it.todo(
    "classifies an author outside the table that ends in [bot] as a bot without a tool",
  );
  it.todo(
    "classifies Copilot's numeric-ID noreply address without [bot] as an agent",
  );
  it.todo(
    "classifies an agent author on a [bot] account as an agent, not a bot",
  );
  it.todo(
    "classifies a human with an agent co-author trailer as agent-assisted",
  );
  it.todo(
    "classifies a human with a marker trailer or a message marker line as agent-assisted",
  );
  it.todo(
    "classifies a human with an agent committer, such as aider, as agent-assisted",
  );
  it.todo(
    "classifies a review-bot co-author as agent-assisted, not as an agent commit",
  );
  it.todo("classifies an agent co-author on a bot commit as a bot commit");
  it.todo("matches trailer keys and emails case-insensitively");
  it.todo("does not treat GitHub as committer of a web merge as a bot");
  it.todo("classifies a human with no trailer as human");
});

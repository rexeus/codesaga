import { describe, expect, it } from "vitest";

import {
  account,
  agent,
  assisted,
  bot,
  coAuthor,
  commit,
  trailer,
} from "../testing/commit-signals.js";
import {
  classifyCommit,
  humanCoAuthorsOf,
  isContributorCommit,
} from "./classify.js";
import { withCustomSignatures } from "./custom-signatures.js";

describe("classifyCommit rules", () => {
  it("classifies an author outside the table that ends in [bot] as a bot named after its account", () => {
    const author = account(1, "deploy-bot[bot]");

    expect(classifyCommit(commit({ author }))).toStrictEqual(
      bot("deploy-bot[bot]"),
    );
  });

  it("finds the account of a [bot] address whose name does not say [bot]", () => {
    const author = {
      name: "Release Helper",
      email: "5+release-helper[bot]@users.noreply.github.com",
    };

    expect(classifyCommit(commit({ author }))).toStrictEqual(
      bot("release-helper[bot]"),
    );
  });

  it("classifies Copilot's numeric-ID address as an agent although it has no [bot] suffix", () => {
    const author = {
      name: "Copilot",
      email: "198982749+Copilot@users.noreply.github.com",
    };

    expect(classifyCommit(commit({ author }))).toStrictEqual(
      agent("GitHub Copilot"),
    );
  });

  it("classifies a rename of a known account by its numeric ID", () => {
    const author = account(128_439_645, "sweep-ai-renamed");

    expect(classifyCommit(commit({ author }))).toStrictEqual(bot("Sweep"));
  });

  it("classifies an agent on a [bot] account as an agent, not as a bot", () => {
    expect(
      classifyCommit(commit({ author: account(161_369_871, "jules[bot]") })),
    ).toStrictEqual(agent("Jules"));
  });

  it("classifies an agent co-author on a bot commit as a bot commit", () => {
    const signals = commit({
      author: account(49_699_333, "dependabot[bot]"),
      trailers: [coAuthor("Claude <noreply@anthropic.com>")],
    });

    expect(classifyCommit(signals)).toStrictEqual(bot("Dependabot"));
  });
});

describe("classifyCommit bot accounts", () => {
  it("classifies a machine account that ends in -bot or _bot, or is named bot, as a bot", () => {
    const accounts = [
      account(2_320_433, "effect-bot"),
      account(7, "Release_Bot"),
      account(9, "bot"),
    ];

    expect(
      accounts.map((author) => classifyCommit(commit({ author }))),
    ).toStrictEqual([bot("effect-bot"), bot("Release_Bot"), bot("bot")]);
  });

  it("finds a -bot login behind a display name that does not say bot", () => {
    const withId = {
      name: "Effect",
      email: "5+effect-bot@users.noreply.github.com",
    };
    const withoutId = {
      name: "Effect",
      email: "effect-bot@users.noreply.github.com",
    };

    expect(classifyCommit(commit({ author: withId }))).toStrictEqual(
      bot("effect-bot"),
    );
    expect(classifyCommit(commit({ author: withoutId }))).toStrictEqual(
      bot("effect-bot"),
    );
  });

  it("keeps people whose names merely end in the letters bot", () => {
    const people = [
      account(1, "Abbot"),
      account(2, "Talbot"),
      account(3, "Cabot"),
      account(4, "robot"),
      { name: "Bot Smith", email: "smith@example.com" },
    ];

    expect(
      people.map((author) => classifyCommit(commit({ author })).class),
    ).toStrictEqual(["human", "human", "human", "human", "human"]);
  });

  it("lets a custom agent signature win over the bot spelling", () => {
    const custom = withCustomSignatures({
      agents: [{ name: "House AI", names: ["house-bot"] }],
    });

    expect(
      classifyCommit(commit({ author: account(8, "house-bot") }), custom),
    ).toStrictEqual(agent("House AI"));
  });
});

describe("classifyCommit matching", () => {
  it("matches trailer keys, emails and names case-insensitively", () => {
    const signals = commit({
      trailers: [
        { key: "co-authored-by", value: "CLAUDE <NoReply@Anthropic.com>" },
      ],
    });

    expect(classifyCommit(signals)).toStrictEqual(assisted("Claude Code"));
  });

  it("credits every agent that co-authored a commit, each once", () => {
    const signals = commit({
      trailers: [
        coAuthor("Claude Opus 4.8 <noreply@anthropic.com>"),
        trailer("Claude-Session", "https://claude.ai/code/s"),
        trailer("Made-with", "Cursor"),
      ],
    });

    expect(classifyCommit(signals)).toStrictEqual(
      assisted("Claude Code", "Cursor"),
    );
  });

  it("recognizes a known agent's co-author line from the body by its address", () => {
    const signals = commit({
      markers: ["Co-Authored-By: Claude <noreply@anthropic.com>"],
    });

    expect(classifyCommit(signals)).toStrictEqual(assisted("Claude Code"));
  });

  it("recognizes a known agent's GitHub ID in a co-author line of the body", () => {
    const signals = commit({
      markers: [
        "Co-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>",
      ],
    });

    expect(classifyCommit(signals)).toStrictEqual(assisted("GitHub Copilot"));
  });

  it("keeps a body human that only names an agent, or whose co-author line holds a second address", () => {
    const signals = commit({
      markers: [
        "Co-authored-by: Claude",
        "Co-authored-by: Jane Doe <jane@example.com>",
        "Co-authored-by: Claude (aider) <jane@example.com>",
        "Co-authored-by: Bob <bob@example.com> (was <cursoragent@cursor.com>)",
      ],
    });

    expect(classifyCommit(signals).class).toBe("human");
  });

  it("does not treat GitHub as the committer of a web merge as a bot or an agent", () => {
    const committer = { name: "GitHub", email: "noreply@github.com" };

    expect(classifyCommit(commit({ committer }))).toStrictEqual({
      class: "human",
      tools: [],
    });
  });

  it("does not treat a bot committer of a human's commit as assistance", () => {
    const committer = account(49_699_333, "dependabot[bot]");

    expect(classifyCommit(commit({ committer })).class).toBe("human");
  });
});

describe("classifyCommit human commits", () => {
  it("ignores a trailer whose key is not a marker, and a co-author who is a person", () => {
    const signals = commit({
      trailers: [
        trailer("Made-with", "Vim"),
        coAuthor("Grace <grace@example.com>"),
      ],
    });

    expect(classifyCommit(signals).class).toBe("human");
  });

  it("classifies a human with no trailer as human", () => {
    expect(classifyCommit(commit())).toStrictEqual({
      class: "human",
      tools: [],
    });
  });
});

describe("isContributorCommit", () => {
  it("counts human and agent-assisted commits, not bot or agent commits", () => {
    const classes = ["human", "agent-assisted", "agent", "bot"] as const;

    expect(
      classes.map((commitClass) =>
        isContributorCommit({ class: commitClass, tools: [] }),
      ),
    ).toStrictEqual([true, true, false, false]);
  });
});

describe("humanCoAuthorsOf", () => {
  it("counts a human co-author, and none for an agent, a bot or a custom signature", () => {
    const custom = withCustomSignatures({
      agents: [{ name: "House AI", emails: ["house-ai@example.com"] }],
    });
    const trailers = [
      coAuthor("Grace <grace@example.com>"),
      coAuthor("Claude <noreply@anthropic.com>"),
      coAuthor(
        "dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
      ),
      coAuthor("House AI <house-ai@example.com>"),
      coAuthor("effect-bot <2320433+effect-bot@users.noreply.github.com>"),
    ];

    expect(humanCoAuthorsOf(commit({ trailers }), custom)).toBe(1);
    expect(humanCoAuthorsOf(commit({ trailers }))).toBe(2);
  });

  it("counts each person once, and not the author", () => {
    const trailers = [
      coAuthor("Grace <grace@example.com>"),
      coAuthor("Grace H. <GRACE@example.com>"),
      coAuthor("Ada <ada@example.com>"),
      trailer("Made-with", "Vim"),
    ];

    expect(humanCoAuthorsOf(commit({ trailers }))).toBe(1);
  });

  it("does not count a malformed trailer without an address", () => {
    const trailers = [
      coAuthor("broken"),
      coAuthor("Grace <not-an-address>"),
      coAuthor("Grace <>"),
    ];

    expect(humanCoAuthorsOf(commit({ trailers }))).toBe(0);
  });

  it("is zero for a co-author line that git did not parse as a trailer", () => {
    const markers = ["Co-authored-by: Grace <grace@example.com>"];

    expect(humanCoAuthorsOf(commit({ markers }))).toBe(0);
  });
});

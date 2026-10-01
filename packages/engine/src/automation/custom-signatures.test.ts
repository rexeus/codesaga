import { describe, expect, it } from "vitest";

import {
  account,
  agent,
  assisted,
  bot,
  coAuthor,
  commit,
} from "../testing/commit-signals.js";
import { classifyCommit } from "./classify.js";
import { withCustomSignatures } from "./custom-signatures.js";

const classifyWith = (
  custom: Parameters<typeof withCustomSignatures>[0],
  overrides: Parameters<typeof commit>[0],
) => classifyCommit(commit(overrides), withCustomSignatures(custom));

describe("withCustomSignatures", () => {
  it("classifies an author by a custom email, ignoring case", () => {
    const custom = {
      bots: [{ name: "Release Robot", emails: ["Robot@Corp.Example"] }],
    };
    const author = { name: "anyone", email: "robot@corp.example" };

    expect(classifyWith(custom, { author })).toStrictEqual(
      bot("Release Robot"),
    );
  });

  it("matches a custom name exactly, not as a pattern or a substring", () => {
    const custom = { bots: [{ name: "Nightly", names: ["nightly (ci)"] }] };

    expect(
      classifyWith(custom, {
        author: { name: "NIGHTLY (CI)", email: "a@b.c" },
      }),
    ).toStrictEqual(bot("Nightly"));
    expect(
      classifyWith(custom, {
        author: { name: "nightly (ci) 2", email: "a@b.c" },
      }).class,
    ).toBe("human");
    expect(
      classifyWith(custom, { author: { name: "nightly xcix", email: "a@b.c" } })
        .class,
    ).toBe("human");
  });

  it("credits a human whose co-author is a custom agent", () => {
    const custom = {
      agents: [{ name: "Corp Pilot", emails: ["pilot@corp.example"] }],
    };
    const trailers = [coAuthor("Pilot <pilot@corp.example>")];

    expect(classifyWith(custom, { trailers })).toStrictEqual(
      assisted("Corp Pilot"),
    );
    expect(
      classifyWith(custom, {
        author: { name: "Pilot", email: "pilot@corp.example" },
      }),
    ).toStrictEqual(agent("Corp Pilot"));
  });

  it("names an in-house [bot] account after the signature instead of the account", () => {
    const custom = {
      bots: [{ name: "Deploy Bot", names: ["deploy-bot[bot]"] }],
    };

    expect(
      classifyWith(custom, { author: account(1, "deploy-bot[bot]") }),
    ).toStrictEqual(bot("Deploy Bot"));
  });

  it("keeps the built-in name when a custom row matches the same person", () => {
    const custom = {
      agents: [{ name: "Mine", emails: ["noreply@anthropic.com"] }],
    };
    const author = { name: "Claude", email: "noreply@anthropic.com" };

    expect(classifyWith(custom, { author })).toStrictEqual(
      agent("Claude Code"),
    );
  });
});

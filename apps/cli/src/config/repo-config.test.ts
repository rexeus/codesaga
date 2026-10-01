import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { decodeRepoConfig } from "./repo-config.js";

const problemsOf = (text: string): ReadonlyArray<string> => {
  const decoded = decodeRepoConfig(text);
  if (Result.isSuccess(decoded)) {
    throw new Error(
      `expected a failure, got ${JSON.stringify(decoded.success)}`,
    );
  }
  return decoded.failure;
};

describe("decodeRepoConfig", () => {
  it("accepts every key", () => {
    const config = {
      include: ["src/**"],
      exclude: ["**/*.gen.ts"],
      since: "6m",
      limit: 10,
      gates: {
        minTruckFactor: 2,
        maxOrphanedDirectories: 0,
        maxIslandDirectories: 3,
        maxAgentShare: 0.5,
        minActiveContributors: 1,
      },
      signatures: {
        bots: [{ name: "Acme CI", emails: ["ci@acme.example"] }],
        agents: [{ name: "Acme Pilot", names: ["pilot"], emails: [] }],
      },
    };

    expect(decodeRepoConfig(JSON.stringify(config))).toStrictEqual(
      Result.succeed(config),
    );
  });

  it("accepts an empty object as a config without defaults", () => {
    expect(decodeRepoConfig("{}")).toStrictEqual(Result.succeed({}));
  });

  it("names an unknown key at any depth", () => {
    expect(
      problemsOf(
        '{"sinse":"6m","signatures":{"bots":[{"name":"x","email":"y"}]}}',
      ),
    ).toStrictEqual([
      "sinse: unknown key",
      "signatures.bots[0].email: unknown key",
    ]);
  });

  it("does not accept github: only the --github flag enables network use", () => {
    expect(problemsOf('{"github":true}')).toStrictEqual([
      "github: unknown key",
    ]);
  });

  it("names the key path of a value of the wrong type", () => {
    expect(
      problemsOf('{"include":["a",1],"limit":-1,"since":6}'),
    ).toStrictEqual([
      "include[1]: Expected string",
      "since: Expected string",
      "limit: Expected a value greater than or equal to 0",
    ]);
  });

  it("names a signature without a name", () => {
    expect(
      problemsOf('{"signatures":{"agents":[{"emails":["a@b.c"]}]}}'),
    ).toStrictEqual(["signatures.agents[0].name: Missing key"]);
  });
  it("rejects text that is not a JSON object", () => {
    expect(problemsOf("{")).toStrictEqual(["Expected a valid JSON string"]);
    expect(problemsOf("[]")).toStrictEqual(["Expected object"]);
  });
});

describe("decodeRepoConfig signatures", () => {
  it("names a signature entry that is empty after trimming", () => {
    expect(
      problemsOf(
        '{"signatures":{"bots":[{"name":"x","emails":["", "  "],"names":["ok"]}]}}',
      ),
    ).toStrictEqual([
      "signatures.bots[0].emails[0]: Expected a value with a length of at least 1",
      "signatures.bots[0].emails[1]: Expected a value with a length of at least 1",
    ]);
  });

  it("trims signature emails and names", () => {
    const decoded = decodeRepoConfig(
      '{"signatures":{"agents":[{"name":"x","emails":[" a@b.c "],"names":[" pilot"]}]}}',
    );

    expect(decoded).toStrictEqual(
      Result.succeed({
        signatures: {
          agents: [{ name: "x", emails: ["a@b.c"], names: ["pilot"] }],
        },
      }),
    );
  });

  it.each([
    '{"signatures":{"bots":[{"name":"x"}]}}',
    '{"signatures":{"bots":[{"name":"x","emails":[],"names":[]}]}}',
  ])("rejects a signature that matches nothing: %s", (text) => {
    expect(problemsOf(text)).toStrictEqual([
      "signatures.bots[0]: Expected at least one entry in emails or names",
    ]);
  });
});

describe("decodeRepoConfig gates", () => {
  it("names a gate that is unknown or out of range", () => {
    expect(
      problemsOf(
        '{"gates":{"minTruckFactors":2,"maxAgentShare":1.5,"minActiveContributors":-1}}',
      ),
    ).toStrictEqual([
      "gates.minTruckFactors: unknown key",
      "gates.maxAgentShare: Expected a value between 0 and 1",
      "gates.minActiveContributors: Expected a value greater than or equal to 0",
    ]);
  });
});

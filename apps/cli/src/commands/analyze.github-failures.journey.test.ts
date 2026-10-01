import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { journey } from "../testing/journey-harness.js";
import {
  makeGithubProject,
  makeTeamProject,
  withFakeGh,
  withoutGhOnPath,
} from "../testing/projects.js";
import { searchResult } from "../testing/stub-github.js";
import type { GithubReply } from "../testing/stub-github.js";

const github = (): GithubReply => searchResult([]);

describe("codesaga analyze --github token and host failures", () => {
  it.live("exits 2 without a token, before asking GitHub anything", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;
      yield* withoutGhOnPath;

      const result = yield* journey({
        args: ["analyze", "--json", "--github"],
        cwd: repo.root,
        github,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "codesaga: --github needs a GitHub token for github.com: set GH_TOKEN or GITHUB_TOKEN, or run `gh auth login`",
      );
      expect(result.exitCode).toBe(2);
      expect(result.githubRequests).toStrictEqual([]);
    }).pipe(Effect.scoped),
  );

  it.live(
    "exits 2 for an origin host that GH_HOST does not name, sending nothing",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        repo.addOrigin("git@evil.example:acme/web.git");
        yield* withFakeGh("logged-in");

        const result = yield* journey({
          args: ["analyze", "--json", "--github"],
          cwd: repo.root,
          env: {
            GH_TOKEN: "test-token",
            GH_ENTERPRISE_TOKEN: "enterprise-token",
          },
          github,
        });

        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(
          "codesaga: origin points to evil.example; set GH_HOST=evil.example to use GitHub Enterprise there",
        );
        expect(result.exitCode).toBe(2);
        expect(result.githubRequests).toStrictEqual([]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --github origin failures", () => {
  it.live.each([
    {
      name: "a remote that is not a repository on a host",
      origin: "../elsewhere",
      message:
        'codesaga: --github needs a GitHub repository, but "origin" is ../elsewhere',
    },
    {
      name: "no origin",
      origin: null,
      message:
        'codesaga: --github needs a GitHub repository, but this one has no "origin" remote',
    },
  ])("exits 2 for $name", ({ origin, message }) =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      if (origin !== null) {
        repo.addOrigin(origin);
      }

      const result = yield* journey({
        args: ["analyze", "--json", "--github"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(message);
      expect(result.exitCode).toBe(2);
      expect(result.githubRequests).toStrictEqual([]);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --github GitHub failures", () => {
  it.live(
    "exits 1 naming the reset time when GitHub rate-limits the request",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGithubProject;

        const result = yield* journey({
          args: ["analyze", "--json", "--github"],
          cwd: repo.root,
          env: { GH_TOKEN: "test-token" },
          github: () => ({
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1893456000",
            },
          }),
        });

        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(
          "codesaga: GitHub rate limit reached: try again after 2030-01-01T00:00:00.000Z",
        );
        expect(result.exitCode).toBe(1);
      }).pipe(Effect.scoped),
  );

  it.live.each([
    {
      name: "a GraphQL error",
      reply: {
        body: { errors: [{ type: "FORBIDDEN", message: "SAML enforcement" }] },
      },
      message: "codesaga: GitHub request failed: SAML enforcement",
    },
  ])("exits 1 with GitHub's reason for $name", ({ reply, message }) =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--github"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github: () => reply,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(message);
      expect(result.exitCode).toBe(1);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --github rejected token", () => {
  it.live("exits 2 naming the host, unlike an outage", () =>
    Effect.gen(function* () {
      const repo = yield* makeGithubProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--github"],
        cwd: repo.root,
        env: { GH_TOKEN: "test-token" },
        github: () => ({ status: 401, body: { message: "Bad credentials" } }),
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "codesaga: GitHub rejected the token for github.com (401)",
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";

import { installFakeGh } from "../testing/fake-gh.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import {
  GithubHostUnconfirmed,
  GithubTokenMissing,
  NotAGithubRemote,
} from "./github-errors.js";
import { resolveGithubSource } from "./source.js";

/** A repository whose `origin` is `remote`, with a fake `gh` that is `gh` state. */
const setup = (remote: string | null, gh: "logged-in" | "logged-out") =>
  Effect.gen(function* () {
    const repo = yield* makeTempRepository;
    if (remote !== null) {
      yield* repo.git("remote", "add", "origin", remote);
    }
    yield* installFakeGh(gh);
    return repo;
  });

const resolveWith = (directory: string, env: Record<string, string>) =>
  resolveGithubSource(directory).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(env),
    ),
  );

layer(NodeServices.layer)("resolveGithubSource tokens", (it) => {
  it.effect("prefers GH_TOKEN, then GITHUB_TOKEN, then the gh CLI", () =>
    Effect.gen(function* () {
      const repo = yield* setup("https://github.com/acme/web.git", "logged-in");

      const both = yield* resolveWith(repo.directory, {
        GH_TOKEN: "from-gh-token",
        GITHUB_TOKEN: "from-github-token",
      });
      const second = yield* resolveWith(repo.directory, {
        GITHUB_TOKEN: "from-github-token",
      });
      const cli = yield* resolveWith(repo.directory, { GH_TOKEN: "  " });

      assert.deepStrictEqual(
        [both, second, cli].map(({ token }) => Redacted.value(token)),
        ["from-gh-token", "from-github-token", "gh-token-for-github.com"],
      );
      assert.deepStrictEqual(
        [both.host, both.repository, both.endpoint],
        ["github.com", "acme/web", "https://api.github.com/graphql"],
      );
    }).pipe(Effect.scoped),
  );

  it.effect("keeps a github.com token away from a host named in GH_HOST", () =>
    Effect.gen(function* () {
      const repo = yield* setup(
        "git@git.acme.example:platform/web.git",
        "logged-in",
      );

      const source = yield* resolveWith(repo.directory, {
        GH_HOST: "Git.Acme.Example",
        GH_TOKEN: "dotcom-token",
        GH_ENTERPRISE_TOKEN: "enterprise-token",
      });
      const viaCli = yield* resolveWith(repo.directory, {
        GH_HOST: "git.acme.example",
        GH_TOKEN: "dotcom-token",
      });

      assert.strictEqual(Redacted.value(source.token), "enterprise-token");
      assert.strictEqual(
        source.endpoint,
        "https://git.acme.example/api/graphql",
      );
      assert.strictEqual(
        Redacted.value(viaCli.token),
        "gh-token-for-git.acme.example",
      );
    }).pipe(Effect.scoped),
  );
});

layer(NodeServices.layer)("resolveGithubSource failures", (it) => {
  it.effect.each([
    { name: "GH_HOST is unset", env: {} },
    { name: "GH_HOST names another host", env: { GH_HOST: "github.com" } },
  ])("sends no token to an origin host when $name", ({ env }) =>
    Effect.gen(function* () {
      const repo = yield* setup("git@evil.example:acme/web.git", "logged-in");

      const failure = yield* Effect.flip(
        resolveWith(repo.directory, {
          ...env,
          GH_TOKEN: "dotcom-token",
          GH_ENTERPRISE_TOKEN: "enterprise-token",
        }),
      );

      assert.deepStrictEqual(
        failure,
        new GithubHostUnconfirmed({ host: "evil.example" }),
      );
    }).pipe(Effect.scoped),
  );

  it.effect(
    "fails with GithubTokenMissing when neither environment nor gh has a token",
    () =>
      Effect.gen(function* () {
        const repo = yield* setup("https://github.com/acme/web", "logged-out");

        const failure = yield* Effect.flip(resolveWith(repo.directory, {}));

        assert.deepStrictEqual(
          failure,
          new GithubTokenMissing({ host: "github.com" }),
        );
      }).pipe(Effect.scoped),
  );

  it.effect(
    "fails with NotAGithubRemote for a local origin, naming it, and for no origin",
    () =>
      Effect.gen(function* () {
        const local = yield* setup(
          "https://user:s3cret@host.example/not/a/repo/",
          "logged-in",
        );
        const none = yield* setup(null, "logged-in");
        const env = { GH_TOKEN: "token" };

        const localFailure = yield* Effect.flip(
          resolveWith(local.directory, env),
        );
        const noneFailure = yield* Effect.flip(
          resolveWith(none.directory, env),
        );

        assert.deepStrictEqual(
          localFailure,
          new NotAGithubRemote({ remote: "https://host.example/not/a/repo/" }),
        );
        assert.deepStrictEqual(
          noneFailure,
          new NotAGithubRemote({ remote: null }),
        );
      }).pipe(Effect.scoped),
  );
});

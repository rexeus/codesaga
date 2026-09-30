import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  makeGitRepository,
  makeTempDirectory,
} from "../../testing/git-repository.js";
import { journey } from "../../testing/journey-harness.js";
import { makeTeamProject, withPath } from "../../testing/projects.js";

const EMBEDDED_REPORT =
  /<script type="application\/json" id="report">(?<json>.*?)<\/script>/su;

const embeddedReport = (html: string) =>
  Schema.decodeUnknownEffect(Report)(
    JSON.parse(EMBEDDED_REPORT.exec(html)?.groups?.["json"] ?? "null"),
  );

const HOSTILE = "</script><img onerror=alert(1)>";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga analyze --html", () => {
  it.live(
    "writes the untruncated report into the dashboard and keeps stdout for --json",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const out = join(yield* makeTempDirectory, "saga.html");

        const result = yield* journey({
          args: [
            "analyze",
            "--json",
            "--limit",
            "1",
            "--out",
            out,
            "--no-open",
          ],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(`codesaga: wrote ${out}`);
        const printed = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(printed.contributors).toHaveLength(1);
        const embedded = yield* embeddedReport(readFileSync(out, "utf8"));
        expect(embedded.contributors.map(({ name }) => name)).toStrictEqual([
          "Ada Lovelace",
          "Grace",
        ]);
      }).pipe(Effect.scoped),
  );

  it.live(
    "writes codesaga-report.html into the working directory by default",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["analyze", "--html", "--no-open"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(repo.root, "codesaga-report.html"))).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live("exits 1 when the dashboard file cannot be written", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const out = join(repo.root, "missing", "saga.html");

      const result = yield* journey({
        args: ["analyze", "--out", out, "--no-open"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`codesaga: cannot write ${out}`);
      expect(result.exitCode).toBe(1);
    }).pipe(Effect.scoped),
  );
});

describe("the codesaga dashboard file", () => {
  it.live("cannot be broken out of by markup in an author name or a path", () =>
    Effect.gen(function* () {
      const repo = yield* makeGitRepository;
      // A path cannot hold a slash, so the closing tag is split across a directory and a file.
      // Git itself strips `<` and `>` from the author name below.
      const directory = "<img onerror=alert(1)>";
      repo.commit(
        3,
        { [`${directory}/script>.ts`]: "a\n" },
        { author: { name: HOSTILE, email: "x@example.com" } },
      );
      const out = join(yield* makeTempDirectory, "saga.html");

      yield* journey({
        args: ["analyze", "--out", out, "--no-open"],
        cwd: repo.root,
      });

      const html = readFileSync(out, "utf8");
      expect(html).not.toContain(HOSTILE);
      expect(html).not.toContain("<img");
      const embedded = yield* embeddedReport(html);
      expect(embedded.contributors.map(({ name }) => name)).toStrictEqual([
        "/scriptimg onerror=alert(1)",
      ]);
      expect(embedded.contributors[0]?.areas).toStrictEqual([
        { path: directory, commits: 1 },
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("loads nothing from the network", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const out = join(yield* makeTempDirectory, "saga.html");

      yield* journey({
        args: ["analyze", "--out", out, "--no-open"],
        cwd: repo.root,
      });

      expect(readFileSync(out, "utf8")).not.toMatch(/https?:\/\//u);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --html in the browser", () => {
  it.live.skipIf(process.platform !== "linux")(
    "starts the browser without waiting for it or killing it on exit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const bin = yield* makeTempDirectory;
        const started = join(bin, "started");
        const release = join(bin, "release");
        const finished = join(bin, "finished");
        for (const fifo of [started, release, finished]) {
          execFileSync("mkfifo", [fifo]);
        }
        // A launcher that keeps the browser in the foreground, as xdg-open's $BROWSER path does.
        // Each step blocks on a FIFO the test controls, so the launcher outlives the command
        // for exactly as long as the test holds it, however slow the machine is.
        writeFileSync(
          join(bin, "xdg-open"),
          `#!/bin/sh\necho "started $1" > ${started}\nread _ < ${release}\necho survived > ${finished}\n`,
        );
        chmodSync(join(bin, "xdg-open"), 0o755);
        yield* withPath(`${bin}:${process.env["PATH"] ?? ""}`);

        // A command that waited for the launcher would never return: it is blocked on `started`.
        const result = yield* journey({
          args: ["analyze", "--html"],
          cwd: repo.root,
        });
        const launched = yield* Effect.promise(() => readFile(started, "utf8"));
        yield* Effect.promise(() => writeFile(release, "go\n"));
        const survived = yield* Effect.promise(() =>
          readFile(finished, "utf8"),
        );

        expect(result.exitCode).toBe(0);
        expect(launched).toBe(
          `started ${join(repo.root, "codesaga-report.html")}\n`,
        );
        expect(survived).toBe("survived\n");
      }).pipe(Effect.scoped),
    10_000,
  );
});

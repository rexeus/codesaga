// Owns publishing the dashboard: writing the HTML file and handing it to a browser.
import type { Report } from "@codesaga/engine";
import { renderReportHtml } from "@codesaga/viewer";
import { Console, Effect, FileSystem, Option, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { escapeForTerminal } from "../escape.js";
import { HtmlWriteFailed } from "./html-write-failed.js";
import { openCommand } from "./open-command.js";

/**
 * Starts the platform's opener and lets it go: codesaga neither waits for it
 * (some launchers run the browser in the foreground) nor kills its process
 * group on exit, which an awaited, still-referenced child would get.
 */
const openInBrowser = (file: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const { command, args } = openCommand(process.platform, file);
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, args, {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      }),
    );
    // The returned re-ref effect is dropped: the opener stays unreferenced.
    yield* Effect.asVoid(handle.unref);
  }).pipe(
    Effect.scoped,
    // Headless machines have no browser; the printed path is the fallback.
    Effect.ignore,
  );

/**
 * Resolves `file` against `cwd` and checks that it can become the dashboard:
 * not empty, not a directory, an existing file writable, and its directory
 * present and writable. A bad `--out` thus fails before the analysis reads
 * any history. Returns the absolute target.
 *
 * Fails with `HtmlWriteFailed` naming the target and what is wrong with it.
 */
export const prepareHtmlTarget = (cwd: string, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const target = paths.resolve(cwd, file);
    const directory = paths.dirname(target);
    const fail = (reason: string) =>
      new HtmlWriteFailed({ path: target, reason });
    if (file === "") {
      return yield* new HtmlWriteFailed({
        path: file,
        reason: "the path is empty",
      });
    }
    if (file.endsWith("/") || file.endsWith(paths.sep)) {
      return yield* fail("names a directory, not a file");
    }
    const existing = yield* Effect.option(fs.stat(target));
    if (Option.isSome(existing)) {
      if (existing.value.type === "Directory") {
        return yield* fail("is a directory");
      }
      yield* fs
        .access(target, { writable: true })
        .pipe(Effect.mapError(() => fail("file is not writable")));
      return target;
    }
    const info = yield* fs
      .stat(directory)
      .pipe(
        Effect.mapError(() => fail(`directory does not exist: ${directory}`)),
      );
    if (info.type !== "Directory") {
      return yield* fail(`not a directory: ${directory}`);
    }
    yield* fs
      .access(directory, { writable: true })
      .pipe(
        Effect.mapError(() => fail(`directory is not writable: ${directory}`)),
      );
    return target;
  });

/**
 * Writes the self-contained dashboard for `report` to `target` (an absolute
 * path from `prepareHtmlTarget`), prints the path to stderr so stdout stays
 * free for `--json`, and opens it unless `open` is false. Failing to open is
 * not an error.
 */
export const writeHtmlReport = (options: {
  readonly report: Report;
  readonly target: string;
  readonly open: boolean;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const { report, target, open } = options;
    yield* fs
      .writeFileString(target, renderReportHtml(report))
      .pipe(
        Effect.mapError(
          (error) =>
            new HtmlWriteFailed({ path: target, reason: error.message }),
        ),
      );
    yield* Console.error(`codesaga: wrote ${escapeForTerminal(target)}`);
    if (open) {
      yield* openInBrowser(target);
    }
  });

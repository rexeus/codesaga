// Owns publishing the dashboard: writing the HTML file and handing it to a browser.
import type { Report } from "@codesaga/engine";
import { renderReportHtml } from "@codesaga/viewer";
import { Console, Effect, FileSystem, Path } from "effect";
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
 * Resolves `file` against `cwd` and checks that its directory exists and is
 * writable, so a bad `--out` fails before the analysis reads any history.
 * Returns the absolute target.
 *
 * Fails with `HtmlWriteFailed` naming the directory.
 */
export const prepareHtmlTarget = (cwd: string, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const target = paths.resolve(cwd, file);
    const directory = paths.dirname(target);
    const fail = (reason: string) =>
      new HtmlWriteFailed({ path: target, reason: `${reason}: ${directory}` });
    const info = yield* fs
      .stat(directory)
      .pipe(Effect.mapError(() => fail("directory does not exist")));
    if (info.type !== "Directory") {
      return yield* fail("not a directory");
    }
    yield* fs
      .access(directory, { writable: true })
      .pipe(Effect.mapError(() => fail("directory is not writable")));
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

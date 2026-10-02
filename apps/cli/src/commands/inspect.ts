import { inspect } from "@codesaga/engine";
import { Console, Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";

import {
  blameConfigSince,
  engineOptions,
  resolveSettings,
} from "../config/settings.js";
import { NothingMatched, noFileMatches } from "../errors/nothing-matched.js";
import { warnIfBlameSkipped } from "../output/blame-warning.js";
import { escapeForTerminal } from "../output/escape.js";
import { printResult } from "../output/print-result.js";
import { warnIfShallow } from "../output/shallow-warning.js";
import { renderInspect } from "../output/terminal/inspect-view.js";
import { WorkingDirectory } from "../working-directory.js";
import { blameFlag, cacheFlag, jsonFlag, sinceFlag } from "./shared-flags.js";

export const inspectCommand = Command.make(
  "inspect",
  {
    patterns: Argument.String("path-or-glob").pipe(
      Argument.withDescription(
        "Repository-relative file, directory or glob, quoted so the shell leaves it alone; one answer per argument",
      ),
      Argument.variadic({ min: 1 }),
    ),
    json: jsonFlag,
    since: sinceFlag,
    cache: cacheFlag,
    blame: blameFlag,
  },
  Effect.fn(function* ({ patterns, json, since, cache, blame }) {
    const cwd = yield* WorkingDirectory;
    const settings = yield* resolveSettings(cwd, {
      since,
      compare: Option.none(),
      blame,
      include: [],
      exclude: [],
      limit: Option.none(),
      detail: Option.none(),
    });
    const result = yield* inspect({
      cwd,
      ...engineOptions(settings),
      cache,
      blame: settings.blame,
      patterns,
    }).pipe(blameConfigSince(settings));
    yield* warnIfShallow(result.shallow);
    yield* warnIfBlameSkipped(result.lineOwners);
    if (result.matches.length === 0) {
      return yield* new NothingMatched({ patterns: result.unmatched });
    }
    for (const pattern of result.unmatched) {
      yield* Console.error(
        `codesaga: ${escapeForTerminal(noFileMatches([pattern]))}`,
      );
    }
    return yield* printResult(result, json, renderInspect);
  }),
).pipe(
  Command.withDescription(
    "Show who knows a file, directory or glob and whether they are still around, before editing or picking reviewers.",
  ),
  Command.withExamples([
    {
      command: "codesaga inspect src/billing/invoice.ts",
      description: "Who to ask about one file",
    },
    {
      command: 'codesaga inspect "packages/*/src/index.ts" --json',
      description: "The experts and agent share of the public barrels",
    },
    {
      command: "codesaga inspect packages/billing --blame",
      description: "Also show who wrote the lines that exist today",
    },
    {
      command: "codesaga inspect packages/engine apps/cli --since 3m",
      description: "One answer per directory, with the last three months",
    },
  ]),
);

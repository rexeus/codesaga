import { analyze } from "@codesaga/engine";
import type { AnalyzeOptions } from "@codesaga/engine";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { evaluateGates } from "../check/evaluate-gates.js";
import { hasGates, resolveGateLimits } from "../check/gate-limits.js";
import {
  blameConfigSince,
  engineOptions,
  resolveSettings,
} from "../config/settings.js";
import { GatesFailed } from "../errors/gates-failed.js";
import { NoGatesConfigured } from "../errors/no-gates-configured.js";
import { ShallowClone } from "../errors/shallow-clone.js";
import { printResult } from "../output/print-result.js";
import { renderCheck } from "../output/terminal/check-view.js";
import { WorkingDirectory } from "../working-directory.js";
import { resolveAnalysisTarget } from "./analysis-target.js";
import { cacheFlag, jsonFlag, sinceFlag } from "./shared-flags.js";

const count = (name: string, description: string) =>
  Flag.Int(name).pipe(
    Flag.withDescription(description),
    Flag.filter(
      (value) => value >= 0,
      (value) => `--${name} must be 0 or greater, got ${value}`,
    ),
    Flag.optional,
  );

export const checkCommand = Command.make(
  "check",
  {
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "Directory or file inside the repository; only commits that change files under it count (default: the whole repository)",
      ),
      Argument.optional,
    ),
    json: jsonFlag,
    since: sinceFlag,
    cache: cacheFlag,
    include: Flag.String("include").pipe(
      Flag.withDescription(
        "Glob of files that count as code instead of the language list; repeatable",
      ),
      Flag.atLeast(0),
    ),
    exclude: Flag.String("exclude").pipe(
      Flag.withDescription(
        "Glob of files that do not count as code; repeatable",
      ),
      Flag.atLeast(0),
    ),
    minTruckFactor: count(
      "min-truck-factor",
      "Fail when the repository's truck factor is below this number",
    ),
    maxOrphanedDirectories: count(
      "max-orphaned",
      "Fail when more directories than this have orphaned knowledge",
    ),
    maxIslandDirectories: count(
      "max-islands",
      "Fail when more directories than this are knowledge islands",
    ),
    maxAgentShare: Flag.Finite("max-agent-share").pipe(
      Flag.withDescription(
        "Fail when agent and agent-assisted commits are a larger share of the window's commits than this ratio, 0 to 1",
      ),
      Flag.filter(
        (value) => value >= 0 && value <= 1,
        (value) => `--max-agent-share must be between 0 and 1, got ${value}`,
      ),
      Flag.optional,
    ),
    minActiveContributors: count(
      "min-active-contributors",
      "Fail when fewer contributors than this committed in the last 90 days",
    ),
  },
  Effect.fn(function* (flags) {
    const cwd = yield* WorkingDirectory;
    const target = yield* resolveAnalysisTarget(cwd, flags.path);
    const settings = yield* resolveSettings(target.cwd, {
      ...flags,
      compare: Option.none(),
      limit: Option.none(),
      detail: Option.none(),
      blame: Option.none(),
    });
    const limits = resolveGateLimits(settings.gates, flags);
    // Without a gate there is nothing to decide: fail before the slow analysis.
    if (!hasGates(limits)) {
      return yield* new NoGatesConfigured();
    }
    const options: AnalyzeOptions = {
      ...target,
      ...engineOptions(settings),
      cache: flags.cache,
    };
    const report = yield* analyze(options).pipe(blameConfigSince(settings));
    // Missing history makes the truck factor and expertise numbers wrong in either direction.
    if (report.repository.shallow) {
      return yield* new ShallowClone();
    }
    const result = evaluateGates(report, limits);
    yield* printResult(result, flags.json, renderCheck);
    const failed = result.gates.filter((gate) => !gate.passed).length;
    return yield* failed > 0
      ? Effect.fail(new GatesFailed({ failed, total: result.gates.length }))
      : Effect.void;
  }),
).pipe(
  Command.withDescription(
    "Fail with exit code 5 when knowledge risk crosses a threshold, for CI. Needs at least one gate, by flag or in .codesaga.json, and the full history: a shallow clone exits 2.",
  ),
  Command.withExamples([
    {
      command: "codesaga check --min-truck-factor 2",
      description: "Fail when fewer than 2 people carry most of the code",
    },
    {
      command: "codesaga check --max-orphaned 0 --max-agent-share 0.5 --json",
      description: "Two gates, the result as JSON",
    },
  ]),
);

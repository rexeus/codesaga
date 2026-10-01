// Owns what each MCP tool does: the CLI's settings resolution and engine calls, answered as documents.
import { analyze, analyzeWithGithub, inspect } from "@codesaga/engine";
import type { AnalyzeOptions } from "@codesaga/engine";
import { Effect, Option } from "effect";
import type { FileSystem, Path } from "effect";
import type { HttpClient } from "effect/http";
import type { ChildProcessSpawner } from "effect/process";

import { evaluateGates } from "../check/evaluate-gates.js";
import { hasGates, resolveGateLimits } from "../check/gate-limits.js";
import { resolveAnalysisTarget } from "../commands/analysis-target.js";
import {
  blameConfigSince,
  engineOptions,
  resolveSettings,
} from "../config/settings.js";
import { NoGatesConfigured } from "../errors/no-gates-configured.js";
import { NothingMatched } from "../errors/nothing-matched.js";
import { toReportedError } from "../errors/reported-error.js";
import type { KnownFailure } from "../errors/reported-error.js";
import { ShallowClone } from "../errors/shallow-clone.js";
import { DEFAULT_LIMIT, limitReport } from "../output/limit-report.js";
import { WorkingDirectory } from "../working-directory.js";
import { CodesagaToolkit, ToolFailed } from "./tools.js";

type Services =
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path;

type Params = {
  readonly path?: string | undefined;
  readonly since?: string | undefined;
  readonly compare?: string | undefined;
  readonly include?: ReadonlyArray<string> | undefined;
  readonly exclude?: ReadonlyArray<string> | undefined;
  readonly limit?: number | undefined;
  readonly blame?: boolean | undefined;
  readonly github?: boolean | undefined;
};

const resolveAnalysis = (params: Params) =>
  Effect.gen(function* () {
    const cwd = yield* WorkingDirectory;
    const target = yield* resolveAnalysisTarget(
      cwd,
      Option.fromNullishOr(params.path),
    );
    const settings = yield* resolveSettings(target.cwd, {
      since: Option.fromNullishOr(params.since),
      compare: Option.fromNullishOr(params.compare),
      include: params.include ?? [],
      exclude: params.exclude ?? [],
      limit: Option.fromNullishOr(params.limit),
      blame: Option.fromNullishOr(params.blame),
    });
    return { target, settings };
  });

type Analysis = Effect.Success<ReturnType<typeof resolveAnalysis>>;

/** `github` is the call's own switch: no config file can turn on a credentialed request. */
const runAnalysis = (
  { target, settings }: Analysis,
  extras: {
    readonly compare?: string | undefined;
    readonly github?: boolean | undefined;
  } = {},
) => {
  const options: AnalyzeOptions = {
    ...target,
    ...engineOptions(settings),
    compare: extras.compare,
    cache: true,
    blame: settings.blame,
  };
  return (
    extras.github === true ? analyzeWithGithub(options) : analyze(options)
  ).pipe(blameConfigSince(settings));
};

const analyzeReport = (params: Params) =>
  Effect.gen(function* () {
    const analysis = yield* resolveAnalysis(params);
    const report = yield* runAnalysis(analysis, {
      compare: params.compare,
      github: params.github,
    });
    return limitReport(report, analysis.settings.limit ?? DEFAULT_LIMIT);
  });

const inspectPatterns = (params: {
  readonly patterns: ReadonlyArray<string>;
  readonly since?: string | undefined;
  readonly blame?: boolean | undefined;
}) =>
  Effect.gen(function* () {
    const cwd = yield* WorkingDirectory;
    const settings = yield* resolveSettings(cwd, {
      since: Option.fromNullishOr(params.since),
      compare: Option.none(),
      include: [],
      exclude: [],
      limit: Option.none(),
      blame: Option.fromNullishOr(params.blame),
    });
    const result = yield* inspect({
      cwd,
      ...engineOptions(settings),
      cache: true,
      blame: settings.blame,
      patterns: params.patterns,
    }).pipe(blameConfigSince(settings));
    if (result.matches.length === 0) {
      return yield* new NothingMatched({ patterns: result.unmatched });
    }
    return result;
  });

const checkGates = (
  params: Omit<Params, "compare" | "limit" | "blame" | "github"> & {
    readonly minTruckFactor?: number | undefined;
    readonly maxOrphanedDirectories?: number | undefined;
    readonly maxIslandDirectories?: number | undefined;
    readonly maxAgentShare?: number | undefined;
    readonly minActiveContributors?: number | undefined;
  },
) =>
  Effect.gen(function* () {
    // Like the command, a gate check reads neither blame nor GitHub, whatever the config says.
    const analysis = yield* resolveAnalysis({ ...params, blame: false });
    const limits = resolveGateLimits(analysis.settings.gates, {
      minTruckFactor: Option.fromNullishOr(params.minTruckFactor),
      maxOrphanedDirectories: Option.fromNullishOr(
        params.maxOrphanedDirectories,
      ),
      maxIslandDirectories: Option.fromNullishOr(params.maxIslandDirectories),
      maxAgentShare: Option.fromNullishOr(params.maxAgentShare),
      minActiveContributors: Option.fromNullishOr(params.minActiveContributors),
    });
    // Without a gate there is nothing to decide: fail before the slow analysis.
    if (!hasGates(limits)) {
      return yield* new NoGatesConfigured();
    }
    const report = yield* runAnalysis(analysis);
    if (report.repository.shallow) {
      return yield* new ShallowClone();
    }
    return evaluateGates(report, limits);
  });

const asToolError = <A, R>(effect: Effect.Effect<A, KnownFailure, R>) =>
  Effect.mapError(
    effect,
    (error) => new ToolFailed({ message: toReportedError(error).message }),
  );

/**
 * Implements the toolkit against the platform services in the current
 * context. Every call runs in the server's working directory repository,
 * honors its `.codesaga.json` and reuses the history cache.
 */
export const makeHandlers = Effect.gen(function* () {
  const services = yield* Effect.context<Services>();
  return CodesagaToolkit.of({
    analyze: (params) =>
      asToolError(analyzeReport(params)).pipe(Effect.provideContext(services)),
    inspect: (params) =>
      asToolError(inspectPatterns(params)).pipe(
        Effect.provideContext(services),
      ),
    check: (params) =>
      asToolError(checkGates(params)).pipe(Effect.provideContext(services)),
  });
});

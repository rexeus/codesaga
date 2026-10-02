import { formatCount, formatNoun, formatPercent } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Strictness = NonNullable<TypeScriptDeepDive["strictness"]>;
type Config = Strictness["configs"][number];
type OptionKey =
  | "strict"
  | "noUncheckedIndexedAccess"
  | "exactOptionalPropertyTypes"
  | "noImplicitOverride"
  | "verbatimModuleSyntax";

/** How the compiler option stands in a config: on, off, or left open by a config that could not be read. */
export type OptionState = "on" | "off" | "unknown";

const OPTIONS: readonly OptionKey[] = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "verbatimModuleSyntax",
];

const stateOf = (setting: true | false | "unknown"): OptionState => {
  if (setting === "unknown") {
    return "unknown";
  }
  return setting ? "on" : "off";
};

/** One compiler option over the files the configs govern. */
export type OptionRow = {
  /** The option as the compiler names it. */
  readonly option: string;
  /** The files governed by a config with the option on, and the segments of its bar, on first. */
  readonly share: string;
  readonly segments: readonly {
    readonly state: OptionState;
    readonly files: number;
    readonly label: string;
  }[];
};

const STATES: readonly OptionState[] = ["on", "off", "unknown"];

const filesIn = (
  configs: readonly Config[],
  option: OptionKey,
  state: OptionState,
): number =>
  configs
    .filter((config) => stateOf(config[option]) === state)
    .reduce((sum, { files }) => sum + files, 0);

/**
 * The five options that tell how strict the compiler is, each as the split of
 * governed files by their config's setting. Empty without a governed file, so
 * a repository with no `tsconfig` shows no bars.
 */
export const optionRows = ({ configs }: Strictness): OptionRow[] => {
  const total = configs.reduce((sum, { files }) => sum + files, 0);
  if (total === 0) {
    return [];
  }
  return OPTIONS.map((option) => {
    const segments = STATES.map((state) => ({
      state,
      files: filesIn(configs, option, state),
      label: { on: "on", off: "off", unknown: "unknown" }[state],
    })).filter(({ files }) => files > 0);
    const on = filesIn(configs, option, "on");
    return {
      option,
      share: formatPercent(on / total),
      segments,
    };
  });
};

/** The share of governed files whose config has `strict` on, 0 to 1; null when no config governs a file. */
export const strictShare = ({ configs }: Strictness): number | null => {
  const total = configs.reduce((sum, { files }) => sum + files, 0);
  return total === 0 ? null : filesIn(configs, "strict", "on") / total;
};

/** A config with the five options as small flags. */
export type ConfigRow = {
  readonly path: string;
  /** `494 files`. */
  readonly files: string;
  readonly flags: readonly {
    readonly option: string;
    readonly state: OptionState;
  }[];
  /** What else the config says: strict parts set apart, presets that were not found. */
  readonly notes: readonly string[];
};

const notesOf = ({ strictExceptions, unresolved }: Config) => [
  ...(strictExceptions.length === 0
    ? []
    : [`sets ${strictExceptions.join(", ")} apart from strict`]),
  ...(unresolved.length === 0
    ? []
    : [`could not read ${unresolved.join(", ")}`]),
];

/** The configs in the report's order, the one governing the most files first. */
export const configRows = ({ configs }: Strictness): ConfigRow[] =>
  configs.map((config) => ({
    path: config.path,
    files: formatNoun(config.files, "file"),
    flags: OPTIONS.map((option) => ({
      option,
      state: stateOf(config[option]),
    })),
    notes: notesOf(config),
  }));

/** What the section says around the bars and the table. */
export type StrictnessFacts = {
  readonly lines: readonly string[];
  /** Words for a config list the output limit cut, or null when it is whole. */
  readonly truncated: string | null;
};

const defaultPhrase = (byDefault: true | false | "unknown"): string => {
  if (byDefault === "unknown") {
    return "what an unset strict means is not known";
  }
  return `an unset strict is ${byDefault ? "on" : "off"} by default`;
};

/** The facts around the bars: the declared TypeScript, the default of `strict`, and how many files the configs govern. */
export const strictnessFacts = (strictness: Strictness): StrictnessFacts => {
  const { typescript, configs, totalConfigs, governedFiles, ungovernedFiles } =
    strictness;
  return {
    lines: [
      typescript.declared === null
        ? "No TypeScript version is declared in the root package.json."
        : `TypeScript ${typescript.declared} is declared; ${defaultPhrase(typescript.strictByDefault)}.`,
      `${formatNoun(governedFiles, "file")} governed by ${formatNoun(totalConfigs, "config")}, ${formatCount(ungovernedFiles)} by none.`,
    ],
    truncated:
      configs.length < totalConfigs
        ? `The report lists ${formatCount(configs.length)} of ${formatCount(totalConfigs)} configs, and the bars cover the files of those.`
        : null,
  };
};

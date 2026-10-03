import type { Report } from "@codesaga/engine";

import { typeScriptStoryLines } from "../present/typescript-stories.js";
import {
  hasTypeScriptFiles,
  typeScriptState,
} from "../present/typescript-summary.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { h } from "./dom.js";
import { section } from "./section.js";
import { eventsBlock } from "./typescript-events-view.js";
import {
  changeCard,
  functionHistograms,
  topFunctionsCard,
} from "./typescript-functions-view.js";
import { fileGraphCard } from "./typescript-import-files-view.js";
import { couplingCard, importMapCard } from "./typescript-imports-view.js";
import { moreFacts } from "./typescript-more-view.js";
import { counterpartsCard, escapesCard } from "./typescript-safety-view.js";
import { strictnessCard } from "./typescript-strictness-view.js";
import { summaryCard } from "./typescript-summary-view.js";
import { trendCard } from "./typescript-trend-view.js";

const DESCRIPTION =
  "Read from the syntax of every TypeScript and JavaScript file at HEAD; no type checker runs. Counts and rates, never a score.";

const group = (title: string, description: string): HTMLElement =>
  h("div", "ts-group", h("h3", "", title), h("p", "", description));

const row = (
  wide: HTMLElement,
  ...narrow: readonly (HTMLElement | null)[]
): HTMLElement =>
  h(
    "div",
    "grid12",
    h("div", "c7 col", wide),
    h("div", "c5 col", ...narrow.filter((card) => card !== null)),
  );

const untyped = (): HTMLElement =>
  h(
    "section",
    "card panel",
    h(
      "p",
      "ts-calm-text",
      "This repository has no TypeScript file, so there are no type escape hatches to count. Types written in JSDoc comments are not read.",
    ),
  );

type Context = {
  readonly deepDive: TypeScriptDeepDive;
  readonly typed: boolean;
  readonly firstCommitAt: string | null;
};

const typeSafety = ({
  deepDive,
  typed,
  firstCommitAt,
}: Context): HTMLElement[] => {
  const { typeSafety: safety, strictness, trends } = deepDive;
  const trend =
    trends === undefined ? null : trendCard(trends, typed, firstCommitAt);
  if (!typed) {
    return [
      group("Type safety", "Where the code leaves the type system"),
      untyped(),
      ...(trend === null ? [] : [trend]),
    ];
  }
  const events = trends === undefined ? null : eventsBlock(trends.events);
  const cards = [
    ...(safety === undefined
      ? []
      : [row(escapesCard(safety), counterpartsCard(safety))]),
    ...(trend === null ? [] : [trend]),
    ...(strictness === undefined ? [] : [strictnessCard(strictness, events)]),
  ];
  return cards.length === 0
    ? []
    : [
        group(
          "Type safety",
          "Where the code leaves the type system, how that changed, and how strictly the compiler is set",
        ),
        ...cards,
      ];
};

const functions = ({
  functions: shape,
  complexityAndChange,
}: TypeScriptDeepDive): HTMLElement[] => {
  if (shape === undefined) {
    return [];
  }
  const [complexity, length] = functionHistograms(shape);
  return [
    group(
      "Functions",
      "How complex and how long the functions are, and where that meets change",
    ),
    ...(complexity === undefined || length === undefined
      ? []
      : [
          row(complexity, topFunctionsCard(shape)),
          row(
            length,
            complexityAndChange === undefined
              ? null
              : changeCard(complexityAndChange),
          ),
        ]),
  ];
};

const imports = ({ imports: graph }: TypeScriptDeepDive): HTMLElement[] =>
  graph === undefined
    ? []
    : [
        group(
          "Imports",
          "How the code depends on itself, between territories and between files",
        ),
        row(importMapCard(graph), couplingCard(graph)),
        fileGraphCard(graph),
      ];

/**
 * The Deep dive: TypeScript section, or null when the report has no
 * `deepDives.typescript`. A parser that did not load leaves only the
 * coverage card; otherwise every block the report carries gets its cards, in
 * the order of type safety, functions, imports and the folded facts.
 */
export const renderTypeScript = (report: Report): HTMLElement | null => {
  const deepDive = report.deepDives?.typescript;
  if (deepDive === undefined) {
    return null;
  }
  const state = typeScriptState(
    deepDive,
    hasTypeScriptFiles(report.stats.languages),
  );
  const context = {
    deepDive,
    typed: state.kind === "ready" && state.typed,
    firstCommitAt: report.repository.firstCommitAt,
  };
  return section(
    "typescript",
    "Deep dive: TypeScript",
    "How the code is typed, shaped and wired",
    DESCRIPTION,
    h(
      "div",
      "ts-stack",
      summaryCard(state, typeScriptStoryLines(report.stories)),
      ...(state.kind === "ready"
        ? [
            ...typeSafety(context),
            ...functions(deepDive),
            ...imports(deepDive),
            ...moreFacts(deepDive, report.stories),
          ]
        : []),
    ),
  );
};

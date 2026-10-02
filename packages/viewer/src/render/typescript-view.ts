import type { Report } from "@codesaga/engine";

import { typeScriptState } from "../present/typescript-summary.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { h } from "./dom.js";
import { section } from "./section.js";
import { ecosystemCard, modulesCard } from "./typescript-code-facts-view.js";
import {
  changeCard,
  functionHistograms,
  topFunctionsCard,
} from "./typescript-functions-view.js";
import { idiomsCard } from "./typescript-idioms-view.js";
import { fileGraphCard } from "./typescript-import-files-view.js";
import { couplingCard, importMapCard } from "./typescript-imports-view.js";
import { counterpartsCard, escapesCard } from "./typescript-safety-view.js";
import { strictnessCard } from "./typescript-strictness-view.js";
import { summaryCard } from "./typescript-summary-view.js";
import { markersCard, testsCard } from "./typescript-test-facts-view.js";

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

const typeSafety = ({
  typeSafety: safety,
  strictness,
}: TypeScriptDeepDive): HTMLElement[] =>
  safety === undefined && strictness === undefined
    ? []
    : [
        group(
          "Type safety",
          "Where the code leaves the type system, and how strictly the compiler is set",
        ),
        ...(safety === undefined
          ? []
          : [row(escapesCard(safety), counterpartsCard(safety))]),
        ...(strictness === undefined ? [] : [strictnessCard(strictness)]),
      ];

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

const more = ({
  idioms,
  modules,
  ecosystem,
  tests,
  markers,
}: TypeScriptDeepDive): HTMLElement[] => {
  const cards = [
    idioms === undefined ? null : idiomsCard(idioms),
    modules === undefined ? null : modulesCard(modules),
    ecosystem === undefined ? null : ecosystemCard(ecosystem),
    tests === undefined ? null : testsCard(tests),
    markers === undefined ? null : markersCard(markers),
  ].filter((card) => card !== null);
  return cards.length === 0
    ? []
    : [
        group("More facts", "Open a card to read it"),
        h("div", "fold-grid", ...cards),
      ];
};

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
  const state = typeScriptState(deepDive);
  return section(
    "typescript",
    "Deep dive: TypeScript",
    "How the code is typed, shaped and wired",
    DESCRIPTION,
    h(
      "div",
      "ts-stack",
      summaryCard(state),
      ...(state.kind === "ready"
        ? [
            ...typeSafety(deepDive),
            ...functions(deepDive),
            ...imports(deepDive),
            ...more(deepDive),
          ]
        : []),
    ),
  );
};

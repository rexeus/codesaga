import {
  changeView,
  complexityHistogram,
  lengthHistogram,
  testFunctionsLine,
  topFunctionRows,
} from "../present/typescript-functions.js";
import type { TopFunctionRow } from "../present/typescript-functions.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { card } from "./card.js";
import { h, mono } from "./dom.js";
import { histogramCard } from "./histogram-card.js";

type Functions = NonNullable<TypeScriptDeepDive["functions"]>;
type ComplexityAndChange = NonNullable<
  TypeScriptDeepDive["complexityAndChange"]
>;

const meter = (fraction: number): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(fraction, 0.02) * 100}%`;
  return h("span", "bar", fill);
};

type Entry = {
  readonly name: Node;
  readonly place: Node;
  /** The figure over the largest of the list, 0 to 1. */
  readonly fraction: number;
  readonly figure: string;
  readonly unit: string;
};

const entry = ({ name, place, fraction, figure, unit }: Entry): HTMLElement =>
  h(
    "div",
    "fn",
    h("div", "fn-id", name, place),
    meter(fraction),
    h("div", "fn-fig", h("b", "", figure), h("span", "", unit)),
  );

const functionRow = ({
  name,
  anonymous,
  place,
  path,
  complexity,
  lines,
  fraction,
}: TopFunctionRow): HTMLElement =>
  entry({
    name: anonymous ? h("span", "fn-name muted", name) : mono(name),
    place: h("span", "fn-place", mono(place, path)),
    fraction,
    figure: complexity,
    unit: lines,
  });

/** The histograms of function complexity and length, as the Stats section draws its own. */
export const functionHistograms = (functions: Functions): HTMLElement[] => [
  histogramCard(complexityHistogram(functions)),
  histogramCard(lengthHistogram(functions)),
];

/** The five hardest production functions, and a line on the tests' own. */
export const topFunctionsCard = (functions: Functions): HTMLElement => {
  const rows = topFunctionRows(functions);
  const tests = testFunctionsLine(functions);
  return card(
    "Hardest functions",
    "Cognitive complexity, top 5. A function nested in another scores on its own",
    ...(rows.length === 0
      ? [h("p", "empty", "The production code has no function.")]
      : [h("div", "fnlist", ...rows.map((row) => functionRow(row)))]),
    ...(tests === null ? [] : [h("p", "note", tests)]),
  );
};

/** Where hard functions meet many revisions: the files that are in the top decile of both. */
export const changeCard = (change: ComplexityAndChange): HTMLElement => {
  const view = changeView(change);
  return card(
    "Complexity and change",
    "Files where hard functions meet many revisions",
    h("p", "ts-lead", view.summary),
    ...(view.hotspots.length === 0
      ? [
          h(
            "p",
            "empty",
            "No file is in the top decile of both its hardest function and its revisions.",
          ),
        ]
      : [
          h(
            "div",
            "fnlist",
            ...view.hotspots.map(
              ({ name, path, complexity, revisions, fraction }) =>
                entry({
                  name: mono(name, path),
                  place: h(
                    "span",
                    "fn-place",
                    `hardest function scores ${complexity}`,
                  ),
                  fraction,
                  figure: revisions,
                  unit: "revisions",
                }),
            ),
          ),
        ]),
    ...(view.shallow
      ? [
          h(
            "p",
            "note",
            "This is a shallow clone: the revisions are those of the visible history, so files look less revised than they are.",
          ),
        ]
      : []),
  );
};

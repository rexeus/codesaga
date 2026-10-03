import { formatNoun } from "../present/format.js";
import { markersTeaser, markersView } from "../present/typescript-markers.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { testsTeaser, testsView } from "../present/typescript-tests.js";
import { weightedSegment } from "./card.js";
import { commaList, h, mono } from "./dom.js";
import { foldCard } from "./fold-card.js";
import { legend, legendItem } from "./section.js";

type Tests = NonNullable<TypeScriptDeepDive["tests"]>;
type Markers = NonNullable<TypeScriptDeepDive["markers"]>;

/**
 * The test cases and how they are marked. The assertion bar counts cases
 * that assert directly in their own callback; a case that asserts in a helper
 * shows as none, and no study ties assertions per test to quality.
 */
export const testsCard = (tests: Tests): HTMLElement => {
  const view = testsView(tests);
  const asserting = view.assertionSegments.filter(({ count }) => count > 0);
  return foldCard(
    "Tests",
    "Test cases found by the call shapes of the common runners",
    testsTeaser(tests),
    h("p", "ts-lead", `${view.headline}. ${view.frameworks}.`),
    h("div", "slabel", "Direct assertions per case"),
    h(
      "div",
      "tbar big",
      ...asserting.map(({ label, count, entity, share }) =>
        weightedSegment(
          count,
          entity,
          `${label}: ${formatNoun(count, "case")} (${share})`,
        ),
      ),
    ),
    legend(
      ...view.assertionSegments.map(({ label, share, entity }) =>
        legendItem(entity, label, share),
      ),
    ),
    h(
      "div",
      "ts-facts",
      ...view.marks.map(({ label, count }) =>
        h("div", "", h("b", "", count), h("span", "", label)),
      ),
    ),
    ...(view.focusedFiles.length === 0
      ? []
      : [
          h(
            "p",
            "note",
            "A focused marker makes a runner skip every other test. Committed in ",
            ...commaList(view.focusedFiles.map((path) => mono(path))),
            ...(view.focusedMore === null ? [] : [` ${view.focusedMore}`]),
            ".",
          ),
        ]),
  );
};

/** Debt markers in comments and how many exports carry a JSDoc block. Counts with no age and no verdict. */
export const markersCard = (markers: Markers): HTMLElement => {
  const view = markersView(markers);
  return foldCard(
    "Markers and docs",
    "Debt markers in production comments and documented exports",
    markersTeaser(markers),
    h(
      "div",
      "ts-facts",
      ...view.rows.map(({ label, count, rate }) =>
        h(
          "div",
          "",
          h("b", "", count),
          h("span", "", `${label} · ${rate} per 1,000 lines`),
        ),
      ),
    ),
    h("div", "slabel", "Documented exports"),
    h(
      "div",
      "tbar big",
      ...(view.documentedShare > 0
        ? [
            weightedSegment(
              view.documentedShare,
              "slot-1",
              "With a JSDoc block",
            ),
          ]
        : []),
      ...(view.documentedShare < 1
        ? [
            weightedSegment(
              1 - view.documentedShare,
              "slot-other",
              "Without a JSDoc block",
            ),
          ]
        : []),
    ),
    h("p", "note", view.documented),
  );
};

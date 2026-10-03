import { formatCount } from "../present/format.js";
import {
  ecosystemFacts,
  ecosystemTeaser,
  importedRows,
  toolGroups,
} from "../present/typescript-ecosystem.js";
import type {
  ImportedRow,
  ToolGroup,
} from "../present/typescript-ecosystem.js";
import { moduleSegments, modulesView } from "../present/typescript-modules.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { weightedSegment } from "./card.js";
import { h, mono } from "./dom.js";
import { foldCard } from "./fold-card.js";
import { legend, legendItem } from "./section.js";

type Modules = NonNullable<TypeScriptDeepDive["modules"]>;
type Ecosystem = NonNullable<TypeScriptDeepDive["ecosystem"]>;

/** Which module systems the files use, whether Node could run them unbuilt, and how the packages are typed. */
export const modulesCard = (
  modules: Modules,
  era: { readonly chart: HTMLElement | null; readonly story: string | null },
): HTMLElement => {
  const view = modulesView(modules);
  const segments = moduleSegments(modules);
  return foldCard(
    "Modules and era",
    "ES modules and CommonJS over time, and the syntax Node cannot run unbuilt",
    view.teaser,
    h(
      "div",
      "tbar big",
      ...segments.map(({ label, files, entity }) =>
        weightedSegment(files, entity, `${label}: ${formatCount(files)} files`),
      ),
    ),
    legend(
      ...segments.map(({ label, files, entity }) =>
        legendItem(entity, label, formatCount(files)),
      ),
    ),
    ...(era.story === null ? [] : [h("p", "ts-lead", era.story)]),
    ...(era.chart === null ? [] : [era.chart]),
    h("p", "ts-lead", view.nonErasableLine),
    h(
      "div",
      "ts-facts",
      ...view.nonErasable.map(({ label, count }) =>
        h("div", "", h("b", "", count), h("span", "", label)),
      ),
    ),
    h("p", "note", view.importLine),
    h("p", "note", view.packageLine),
  );
};

const importedList = (
  title: string,
  rows: readonly ImportedRow[],
): HTMLElement =>
  h(
    "div",
    "ts-col",
    h("div", "slabel", title),
    rows.length === 0
      ? h("p", "empty", "None.")
      : h(
          "div",
          "toplist",
          ...rows.map(({ name, files, fraction }) => {
            const fill = h("i", "");
            fill.style.width = `${Math.max(fraction, 0.02) * 100}%`;
            return h(
              "div",
              "tl",
              mono(name),
              h("span", "bar", fill),
              h("b", "", files),
            );
          }),
        ),
  );

const toolGroup = ({ label, tools }: ToolGroup): HTMLElement =>
  h(
    "div",
    "tool-group",
    h("div", "slabel", label),
    h(
      "div",
      "chips-line",
      ...tools.map(({ name, detail }) => {
        const chip = h("span", "pill", name, h("span", "muted", detail));
        return chip;
      }),
    ),
  );

/** The tools the code uses (from a curated table, so an unknown tool is absent and not unused), and the packages and built-ins it imports most. */
export const ecosystemCard = (ecosystem: Ecosystem): HTMLElement => {
  const groups = toolGroups(ecosystem);
  return foldCard(
    "Ecosystem",
    "Frameworks and tools from imports and manifests, and the most imported packages",
    ecosystemTeaser(ecosystem),
    ...(groups.length === 0
      ? [h("p", "empty", "No tool of the curated table was detected.")]
      : [h("div", "tool-groups", ...groups.map((group) => toolGroup(group)))]),
    h(
      "div",
      "ts-cols",
      importedList(
        "Packages imported by the most files",
        importedRows(ecosystem.packages),
      ),
      importedList("Node built-ins", importedRows(ecosystem.nodeBuiltins)),
    ),
    ...ecosystemFacts(ecosystem).map((line) => h("p", "note", line)),
  );
};

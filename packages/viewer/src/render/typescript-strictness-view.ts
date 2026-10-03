import { formatCount, formatNoun } from "../present/format.js";
import {
  configRows,
  optionRows,
  strictnessFacts,
} from "../present/typescript-strictness.js";
import type {
  ConfigRow,
  OptionRow,
  OptionState,
} from "../present/typescript-strictness.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { card, weightedSegment } from "./card.js";
import { breakAfterSlashes, h, mono } from "./dom.js";
import { limitedList } from "./limited-list.js";
import { legend, legendItem } from "./section.js";

type Strictness = NonNullable<TypeScriptDeepDive["strictness"]>;

const ENTITIES: Record<OptionState, string> = {
  on: "slot-1",
  off: "slot-other",
  unknown: "unknown-state",
};

const CONFIG_ROWS = { rows: 5, noun: "configs" };

const optionRow = ({ option, share, segments }: OptionRow): HTMLElement =>
  h(
    "div",
    "opt",
    h(
      "div",
      "opt-head",
      mono(option),
      h("span", "muted", `${share} of files on`),
    ),
    h(
      "div",
      "tbar big",
      ...segments.map(({ state, files, label }) =>
        weightedSegment(
          files,
          ENTITIES[state],
          `${option} ${label}: ${formatNoun(files, "file")}`,
        ),
      ),
    ),
  );

const flag = ({ option, state }: ConfigRow["flags"][number]): HTMLElement => {
  const chip = h("span", `flag ${state}`, option);
  chip.title = `${option}: ${state}`;
  return chip;
};

const configRow = ({ path, files, flags, notes }: ConfigRow): HTMLElement =>
  h(
    "div",
    "cfg-row",
    h(
      "div",
      "cfg-head",
      h("span", "mono cfg-path", ...breakAfterSlashes(path)),
      h("span", "muted", files),
    ),
    h("div", "flags", ...flags.map((entry) => flag(entry))),
    ...notes.map((note) => h("p", "note", note)),
  );

const configList = (strictness: Strictness): HTMLElement =>
  h(
    "div",
    "cfg",
    h(
      "div",
      "slabel",
      `Configs (${formatCount(strictness.totalConfigs)}), most files first`,
    ),
    limitedList(configRows(strictness), CONFIG_ROWS, "cfg-list", configRow),
  );

const body = (strictness: Strictness): Node[] => {
  const rows = optionRows(strictness);
  const facts = strictnessFacts(strictness);
  const lines = [
    ...facts.lines.map((line) => h("p", "note", line)),
    ...(facts.truncated === null ? [] : [h("p", "note", facts.truncated)]),
  ];
  if (rows.length === 0) {
    return [
      h(
        "p",
        "empty",
        "No tsconfig governs a file, so the repository declares no compiler options here.",
      ),
      ...lines,
    ];
  }
  const states = new Set(
    rows.flatMap(({ segments }) => segments.map(({ state }) => state)),
  );
  return [
    h(
      "div",
      "strict-grid",
      h(
        "div",
        "strict-bars",
        ...rows.map((row) => optionRow(row)),
        legend(
          legendItem("slot-1", "on"),
          legendItem("slot-other", "off"),
          ...(states.has("unknown")
            ? [legendItem("unknown-state", "unknown")]
            : []),
        ),
        ...lines,
      ),
      configList(strictness),
    ),
  ];
};

/**
 * The compiler posture: five options, each as the split of governed files by
 * what their config sets. A `tsconfig` that could not be read leaves its
 * files `unknown`, never guessed. The configs follow in a collapsed list.
 */
export const strictnessCard = (
  strictness: Strictness,
  events: HTMLElement | null,
): HTMLElement =>
  card(
    "Compiler strictness",
    "What the tsconfig files make the compiler check, over the files each one governs",
    ...body(strictness),
    ...(events === null ? [] : [events]),
  );

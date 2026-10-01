// Owns the two-column layout of the `analyze` view: a bold label on the left, its lines beside and below it.
import { escapeForTerminal } from "../escape.js";
import { columnWidth, graphemeClusters } from "./columns.js";
import type { Style } from "./style.js";

const LABEL_WIDTH = 27;
export const MAX_NAME_WIDTH = 24;

/**
 * `text` made terminal-safe and cut to `width` terminal columns, ending in an
 * ellipsis when it was wider. Each grapheme cluster is escaped before it is
 * measured, so a cut never lands inside an escape sequence, a surrogate pair,
 * a combining sequence or a joined emoji.
 */
export const fitEscaped = (text: string, width: number): string => {
  const clusters = graphemeClusters(text)
    .map((cluster) => escapeForTerminal(cluster))
    .map((cluster) => ({ text: cluster, columns: columnWidth(cluster) }));
  const total = clusters.reduce((sum, { columns }) => sum + columns, 0);
  if (total <= width) {
    return clusters.map(({ text: cluster }) => cluster).join("");
  }
  let kept = "";
  let columns = 0;
  for (const cluster of clusters) {
    if (columns + cluster.columns > width - 1) {
      break;
    }
    kept += cluster.text;
    columns += cluster.columns;
  }
  return `${kept}…`;
};

/** A labelled section: the label in the left column, its lines beside and below it. */
export const section = (
  label: string,
  lines: ReadonlyArray<string>,
  style: Style,
): ReadonlyArray<string> =>
  lines.map((line, index) =>
    index === 0
      ? `${style.bold(label.padEnd(LABEL_WIDTH))}${line}`
      : `${" ".repeat(LABEL_WIDTH)}${line}`,
  );

/**
 * A labelled table: the section label on the header row, then one left-column
 * entry per row, each already escaped and cut to the column.
 */
export const labelledTable = (
  label: string,
  rowLabels: ReadonlyArray<string>,
  table: ReadonlyArray<string>,
  style: Style,
): ReadonlyArray<string> => {
  const labels = [
    style.bold(label.padEnd(LABEL_WIDTH)),
    ...rowLabels.map((rowLabel) => `  ${rowLabel}`.padEnd(LABEL_WIDTH)),
  ];
  return table.map((line, index) => `${labels[index] ?? ""}${line}`);
};

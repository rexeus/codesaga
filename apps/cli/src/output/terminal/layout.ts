// Owns the two-column layout of the `analyze` view: a bold label on the left, its lines beside and below it.
import { escapeForTerminal } from "../escape.js";
import type { Style } from "./style.js";

const LABEL_WIDTH = 27;
export const MAX_NAME_WIDTH = 24;

/**
 * `text` made terminal-safe and cut to `width` characters, ending in an
 * ellipsis when it was longer. Each character is escaped before it is
 * measured, so a cut never lands inside an escape sequence or a surrogate pair.
 */
export const fitEscaped = (text: string, width: number): string => {
  const units = Array.from(text, escapeForTerminal);
  if (units.join("").length <= width) {
    return units.join("");
  }
  let kept = "";
  for (const unit of units) {
    if (kept.length + unit.length > width - 1) {
      break;
    }
    kept += unit;
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

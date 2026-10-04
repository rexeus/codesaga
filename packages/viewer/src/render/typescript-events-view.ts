import { eventRows } from "../present/typescript-events.js";
import type { EventRow } from "../present/typescript-events.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { h, mono } from "./dom.js";
import { limitedList } from "./limited-list.js";

type Events = NonNullable<NonNullable<TypeScriptDeepDive["trends"]>["events"]>;

const EVENT_ROWS = { rows: 5, noun: "changes" };

const eventRow = ({
  date,
  flag,
  change,
  on,
  configs,
  paths,
}: EventRow): HTMLElement => {
  const where = h("span", "flagev-where muted", mono(configs, paths));
  return h(
    "div",
    `flagev ${on ? "on" : "off"}`,
    h("i", "flagev-dot"),
    h("span", "flagev-date", date),
    h("div", "flagev-what", h("span", "", mono(flag), ` ${change}`), where),
  );
};

/**
 * A timeline of the compiler flags that were turned on or off, newest first:
 * the day, the flag, what happened and the config. Configs that changed the
 * same way on the same day share one row. Null without a change.
 */
export const eventsBlock = (events: Events): HTMLElement | null => {
  const rows = eventRows(events);
  if (rows.length === 0) {
    return null;
  }
  return h(
    "div",
    "ts-subblock",
    h("div", "slabel", "Compiler flag changes"),
    limitedList(rows, EVENT_ROWS, "flagev-list", eventRow),
    h(
      "p",
      "note",
      "When strict or noUncheckedIndexedAccess changed, read from the commits along the first-parent chain as each config effectively sets the flag. The report keeps the 20 newest.",
    ),
  );
};

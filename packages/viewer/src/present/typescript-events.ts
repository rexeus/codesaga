import { formatDateLong, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Event = NonNullable<
  NonNullable<TypeScriptDeepDive["trends"]>["events"]
>[number];

/** One day's change of one compiler flag, over the configs that changed with it. */
export type EventRow = {
  /** `27 Dec 2023`. */
  readonly date: string;
  readonly flag: string;
  /** `turned on`, `turned off`, `created with it on`, `created with it off`. */
  readonly change: string;
  /** Whether the flag ended up on. */
  readonly on: boolean;
  /** The first config, and how many changed with it: `tsconfig.json and 2 more`. */
  readonly configs: string;
  /** The config paths as written, for a tooltip. */
  readonly paths: string;
};

const changeOf = ({ from, to }: Event): string => {
  if (from === null) {
    return `created with it ${to ? "on" : "off"}`;
  }
  return to ? "turned on" : "turned off";
};

const sameChange = (a: Event, b: Event): boolean =>
  a.date === b.date && a.flag === b.flag && a.from === b.from && a.to === b.to;

const rowOf = (events: readonly Event[]): EventRow => {
  const [first] = events;
  if (first === undefined) {
    throw new TypeError("A group of events has an event.");
  }
  const more = events.length - 1;
  return {
    date: formatDateLong(first.date),
    flag: first.flag,
    change: changeOf(first),
    on: first.to,
    configs:
      more === 0
        ? first.path
        : `${first.path} and ${formatNoun(more, "more config")}`,
    paths: events.map(({ path }) => path).join(", "),
  };
};

/**
 * The flag changes of the report, newest first, with the configs that changed
 * the same flag the same way on the same day as one row: a flip in a base
 * config shows on every config that extends it.
 */
export const eventRows = (events: readonly Event[]): EventRow[] => {
  const groups: Event[][] = [];
  for (const event of events) {
    const group = groups.find(
      ([head]) => head !== undefined && sameChange(head, event),
    );
    if (group === undefined) {
      groups.push([event]);
    } else {
      group.push(event);
    }
  }
  return groups.toReversed().map((group) => rowOf(group));
};

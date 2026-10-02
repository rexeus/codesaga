import type { Report } from "@codesaga/engine";

import { layoutWeeklyBars } from "../layout/weekly-bars.js";
import {
  PEOPLE_SHOWN,
  RECENT_WEEKS,
  filterOptions,
  personRows,
  rowsWithFilter,
} from "../present/contributors.js";
import type {
  FilterOption,
  PersonRow,
  StatusFilter,
} from "../present/contributors.js";
import { formatCount } from "../present/format.js";
import { showAllLabel, visibleRows } from "../present/row-limit.js";
import { badgeChips } from "./badges.js";
import { renderBots } from "./bots-view.js";
import { h, s } from "./dom.js";
import { icon } from "./icons.js";
import { section } from "./section.js";

const SPARK = { width: 190, height: 28 };

const statusPill = (status: PersonRow["status"]): HTMLElement => {
  if (status === "new") {
    return h("span", "pill info", icon("spark", 13), "New");
  }
  if (status === "active") {
    return h("span", "pill good", h("span", "dot"), "Active");
  }
  return h("span", "pill quiet", h("span", "dot dim"), "Dormant");
};

const weeklySparkline = (weekly: readonly number[]): SVGElement =>
  s(
    "svg",
    {
      class: "weeks",
      viewBox: `0 0 ${SPARK.width} ${SPARK.height}`,
      "aria-hidden": "true",
    },
    s("line", {
      class: "base",
      x1: 0,
      x2: SPARK.width,
      y1: SPARK.height - 0.5,
      y2: SPARK.height - 0.5,
    }),
    ...layoutWeeklyBars(weekly, SPARK, RECENT_WEEKS).map(
      ({ x, y, width, height, recent }) =>
        s("rect", {
          class: recent ? "b recent" : "b",
          x,
          y,
          width,
          height,
          rx: 1,
        }),
    ),
  );

const areaChips = ({ areas, moreAreas }: PersonRow): HTMLElement =>
  h(
    "div",
    "areachips",
    ...(areas.length === 0
      ? [h("span", "muted", "—")]
      : areas.map((path) => h("span", "", path))),
    ...(moreAreas === 0 ? [] : [h("span", "more", `+${moreAreas}`)]),
  );

const row = (person: PersonRow): HTMLElement => {
  const badges = badgeChips(person.badges);
  return h(
    "tr",
    "",
    h(
      "td",
      "",
      h(
        "div",
        "who",
        h("span", `avatar ${person.entity}`, person.initials),
        h(
          "div",
          "",
          h("div", "n", person.name),
          h("div", "s", person.since),
          ...(badges.length === 0 ? [] : [h("div", "badges", ...badges)]),
        ),
      ),
    ),
    h("td", "", statusPill(person.status)),
    h("td", "", weeklySparkline(person.weekly)),
    h("td", "", areaChips(person)),
    h("td", "last", person.lastAgo, h("small", "", person.lastDate)),
  );
};

const HEADERS = [
  "Contributor",
  "Status",
  "Commits per week",
  "Where they work",
  "Last active",
];

const table = (rows: readonly PersonRow[]): HTMLElement =>
  h(
    "div",
    "card ctable",
    h(
      "table",
      "people",
      h("caption", "visually-hidden", "Contributors"),
      h(
        "thead",
        "",
        h("tr", "", ...HEADERS.map((label) => h("th", "", label))),
      ),
      h("tbody", "", ...rows.map((person) => row(person))),
    ),
  );

const DESCRIPTION =
  "Listed active first, then new, then dormant; within a group by days with a commit.";

const filterButton = ({ label, count }: FilterOption): HTMLButtonElement => {
  const button = h("button", "", label, h("b", "", String(count)));
  button.type = "button";
  return button;
};

const limitNote = ({ contributors, totals }: Report): HTMLElement[] =>
  totals.contributors > contributors.length
    ? [
        h(
          "p",
          "note",
          `Showing ${formatCount(contributors.length)} of ${formatCount(totals.contributors)} contributors: the report was limited.`,
        ),
      ]
    : [];

const peopleHead = (filters: HTMLElement): HTMLElement =>
  h(
    "div",
    "people-head",
    filters,
    h(
      "span",
      "note",
      "Counts are context, not a ranking. Each sparkline has its own scale.",
    ),
  );

/**
 * Everyone with a human or agent-assisted commit in the window as a list:
 * status, a sparkline of commits per week, main areas, badges and last activity.
 * Filters by status and "show all" past twelve redraw the list from the
 * report; the buttons themselves stay in place, so the keyboard focus stays
 * on the control that was used.
 */
export const renderContributors = (report: Report): HTMLElement => {
  const rows = personRows(report);
  const limit = { rows: PEOPLE_SHOWN, noun: "contributors" };
  const filters = h("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter by status");
  const list = h("div", "");
  const more = h("button", "btn");
  more.type = "button";
  const showAll = h("div", "showall", more);
  let filter: StatusFilter = "all";
  let all = false;

  const buttons = filterOptions(rows).map((option) => {
    const button = filterButton(option);
    button.addEventListener("click", () => {
      filter = option.filter;
      all = false;
      paint();
    });
    return { button, filter: option.filter };
  });
  filters.append(...buttons.map(({ button }) => button));
  more.addEventListener("click", () => {
    all = !all;
    paint();
  });

  const paint = (): void => {
    for (const { button, filter: filterOf } of buttons) {
      button.setAttribute("aria-pressed", String(filterOf === filter));
    }
    const matching = rowsWithFilter(rows, filter);
    list.replaceChildren(table(visibleRows(matching, limit, all)));
    more.textContent = all
      ? "Show fewer"
      : showAllLabel(matching.length, limit);
    showAll.hidden = matching.length <= PEOPLE_SHOWN;
  };
  paint();

  const bots = renderBots(report);
  return section(
    "contributors",
    "People",
    "Contributors",
    DESCRIPTION,
    ...(rows.length === 0
      ? [h("p", "empty", "No contributors in the window.")]
      : [peopleHead(filters), list, showAll, ...limitNote(report)]),
    ...(bots === null ? [] : [bots]),
  );
};

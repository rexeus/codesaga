import type { Report } from "@codesaga/engine";

import { achievementSummary, medals } from "../present/achievements.js";
import type { Medal } from "../present/achievements.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { section } from "./section.js";

const DESCRIPTION =
  "A milestone states a threshold the repository passed; it never compares people.";

const bar = (fraction: number): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(1.5, fraction * 100)}%`;
  return h("div", "pbar", fill);
};

const pipOf = ({ reached, complete }: Medal): HTMLElement | null => {
  if (!reached) {
    return h("span", "lock", icon("lock", 13, 2.2));
  }
  return complete ? h("span", "check", icon("check", 13, 3)) : null;
};

const medallion = (medal: Medal): HTMLElement => {
  const pip = pipOf(medal);
  return h(
    "div",
    "medal",
    h("div", "ring", h("div", "core", icon(medal.icon, 34, 1.6))),
    ...(pip === null ? [] : [pip]),
  );
};

const tierLine = ({ tiers }: Medal): HTMLElement[] =>
  tiers === null
    ? []
    : [
        h(
          "div",
          "tier",
          h(
            "span",
            "pips",
            ...Array.from({ length: tiers.total }, (_, index) =>
              h("i", index < tiers.reached ? "on" : ""),
            ),
          ),
          tiers.caption,
        ),
      ];

const foot = ({ when, progress, reached }: Medal): HTMLElement => {
  const chip =
    when === null ? [] : [h("div", "when", icon(when.icon, 14, 2), when.text)];
  const next =
    progress === null
      ? []
      : [
          h(
            "div",
            reached ? "next" : "prog",
            h(
              "div",
              "nline",
              h("span", "", progress.heading),
              h("b", "", progress.figures),
            ),
            bar(progress.fraction),
          ),
        ];
  return h("div", "afoot", ...chip, ...next);
};

const card = (medal: Medal): HTMLElement => {
  const element = h(
    "article",
    `card ach ${medal.tint} ${medal.reached ? "reached" : "locked"}`,
    medallion(medal),
    h("h3", "", medal.title),
    ...tierLine(medal),
    h("p", "evid", medal.detail),
    foot(medal),
  );
  element.setAttribute(
    "aria-label",
    `${medal.title}, ${medal.reached ? "reached" : "not yet"}`,
  );
  return element;
};

/**
 * The repository's milestones as medallions, the reached ones first: a ring
 * and a Lucide icon, a check or a lock, tier pips, the day it was reached or
 * that it holds today, and for the ones with something ahead a progress bar.
 */
export const renderAchievements = ({ achievements }: Report): HTMLElement => {
  const { strong, rest } = achievementSummary(achievements);
  return section(
    "achievements",
    "Achievements",
    "Milestones reached",
    [h("b", "", strong), `${rest}. ${DESCRIPTION}`],
    h("div", "ach-grid", ...medals(achievements).map((medal) => card(medal))),
  );
};

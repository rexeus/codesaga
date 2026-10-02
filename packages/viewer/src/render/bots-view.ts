import type { Report } from "@codesaga/engine";

import { botsCard } from "../present/bots.js";
import { formatCount } from "../present/format.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { section } from "./section.js";
import { bindTooltip } from "./tooltip.js";

type Card = NonNullable<ReturnType<typeof botsCard>>;

const authorship = ({ parts }: Card): HTMLElement => {
  const stack = h(
    "div",
    "stack-bar",
    ...parts.map(({ label, count, entity }) => {
      const part = h("i", entity);
      part.style.flexGrow = String(count);
      bindTooltip(part, {
        title: label,
        rows: [{ label: "commits", value: formatCount(count) }],
      });
      return part;
    }),
  );
  return h(
    "div",
    "",
    stack,
    h(
      "ul",
      "legend",
      ...parts.map(({ label, count, entity }) =>
        h(
          "li",
          "",
          h("span", `swatch ${entity}`),
          `${label} ${formatCount(count)}`,
        ),
      ),
    ),
  );
};

const tools = ({ tools: detected }: Card): HTMLElement =>
  h(
    "div",
    "tools",
    ...detected.map(({ name, kind, icon: glyph, counts }) =>
      h(
        "div",
        "tool",
        h("span", "ti", icon(glyph, 15)),
        h("span", "nm", name),
        h("span", "pill quiet", kind),
        h("span", "ct", counts),
      ),
    ),
  );

const DESCRIPTION =
  "Who wrote the commits. Detected in the history, not counted as contributors.";

/**
 * The Bots & Agents section: who wrote the commits as one bar and the detected
 * tools. Null when the history shows no bot or agent.
 */
export const renderBots = (report: Report): HTMLElement | null => {
  const card = botsCard(report);
  if (card === null) {
    return null;
  }
  return section(
    "bots",
    "Bots & Agents",
    "Who else commits",
    DESCRIPTION,
    h("div", "card bots", authorship(card), tools(card)),
  );
};

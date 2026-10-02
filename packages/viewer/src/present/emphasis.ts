import type { Report } from "@codesaga/engine";

import type { Segment } from "./story.js";

type Highlight = Report["highlights"][number];

const escapePattern = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** The engine's name for the repository root, and nothing at all: neither is a phrase to find in a sentence. */
const isFindable = (path: string | undefined): path is string =>
  path !== undefined && path !== "" && path !== ".";

const ISO_DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const QUOTED = '"[^"]+"';

/**
 * The detail with its path, dates and quoted phrases set strong. The engine
 * words the sentence; this only picks out the facts in it.
 */
export const emphasize = ({
  detail,
  path,
}: Pick<Highlight, "detail" | "path">): Segment[] => {
  const facts = isFindable(path) ? [escapePattern(path)] : [];
  const pattern = new RegExp([...facts, ISO_DATE, QUOTED].join("|"), "gu");
  const segments: Segment[] = [];
  let from = 0;
  for (const match of detail.matchAll(pattern)) {
    segments.push(
      { text: detail.slice(from, match.index), strong: false },
      { text: match[0], strong: true },
    );
    from = match.index + match[0].length;
  }
  segments.push({ text: detail.slice(from), strong: false });
  return segments.filter(({ text }) => text !== "");
};

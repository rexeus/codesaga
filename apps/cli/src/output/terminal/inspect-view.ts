// Owns the human view of `inspect`: each argument with its experts, truck factor, badges and reasons.
// Every name and path that came from git or the user passes through terminal-safe escaping.
import type { InspectResult } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { ago, count, day, plural, share } from "./format.js";
import { badgesOf, nameOf, ownerLabel } from "./knowledge-lines.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

type Entry = InspectResult["matches"][number];

const SEPARATOR = " · ";

const headline = (entry: Entry): string =>
  [
    plural(entry.files, "file"),
    `truck factor ${entry.truckFactor}`,
    ...(badgesOf(entry) === "" ? [] : [badgesOf(entry)]),
  ].join(SEPARATOR);

const expertLines = (
  entry: Entry,
  now: string,
  style: Style,
): ReadonlyArray<string> =>
  entry.experts.length === 0
    ? ["No expert found."]
    : renderTable(
        [
          { header: "expert", align: "left" },
          { header: "files", align: "right" },
          { header: "share", align: "right" },
          { header: "sole", align: "right" },
          { header: "last commit", align: "left" },
        ],
        entry.experts.map((expert) => [
          plain(nameOf(expert)),
          plain(count(expert.files)),
          plain(share(expert.files, entry.files)),
          plain(count(expert.soleFiles)),
          plain(
            `${ago(expert.lastCommitAt, now)}${expert.active ? "" : " (dormant)"}`,
          ),
        ]),
        style,
      );

const lineOwnerLines = (
  { lineOwners }: Entry,
  style: Style,
): ReadonlyArray<string> => {
  if (lineOwners === undefined) {
    return [];
  }
  if (lineOwners.owners.length === 0) {
    return ["No line owner found."];
  }
  return renderTable(
    [
      { header: "line owner", align: "left" },
      { header: "lines", align: "right" },
      { header: "share", align: "right" },
    ],
    lineOwners.owners.map((owner) => [
      plain(ownerLabel(owner)),
      plain(count(owner.lines)),
      plain(share(owner.lines, lineOwners.lines)),
    ]),
    style,
  );
};

const automationLine = (entry: Entry): string => {
  const { human, agentAssisted, agent, bot } = entry.automation;
  const classes = Object.entries({
    human,
    "agent-assisted": agentAssisted,
    agent,
    bot,
  })
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${name} ${count(value)}`);
  return classes.join(SEPARATOR);
};

const windowLines = (entry: Entry, now: string): ReadonlyArray<string> =>
  entry.lastCommitAt === null
    ? ["No commits in the window."]
    : [
        `${plural(entry.commits, "commit")} in the window, last ${ago(entry.lastCommitAt, now)}`,
        automationLine(entry),
      ];

const entryLines = (
  entry: Entry,
  now: string,
  style: Style,
): ReadonlyArray<string> => [
  style.bold(escapeForTerminal(entry.pattern)),
  headline(entry),
  ...expertLines(entry, now, style),
  ...lineOwnerLines(entry, style),
  ...windowLines(entry, now),
  ...entry.reasons.map((reason) => `- ${escapeForTerminal(reason)}`),
];

/**
 * Renders the terminal view of an `inspect` result: one block per matched
 * argument, in the order given. Unmatched arguments are not part of this
 * view; the caller reports them as diagnostics. The result has no trailing
 * newline.
 */
export const renderInspect = (result: InspectResult, style: Style): string =>
  [
    style.dim(`${day(result.window.since)} to ${day(result.window.until)}`),
    ...result.matches.flatMap((entry) => [
      "",
      ...entryLines(entry, result.window.until, style),
    ]),
  ].join("\n");

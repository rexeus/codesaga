// Owns the TypeScript lines of one `inspect` entry: the complexity and escape hatches of the matched files, and who imports and tests them.
// Every path and function name that came from the repository passes through terminal-safe escaping.
import type { InspectResult } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { count, plural } from "./format.js";

type InspectedTypeScript = NonNullable<
  InspectResult["matches"][number]["typescript"]
>;
type FileList = InspectedTypeScript["importedBy"];

const SEPARATOR = " · ";

/** "imported by 139 files: a, b and 134 more", or nothing for an empty list. */
const fileListLine = (label: string, { files, top }: FileList): string => {
  if (files === 0) {
    return `${label} no file`;
  }
  const names = top.map((path) => escapeForTerminal(path)).join(", ");
  const more = files - top.length;
  return `${label} ${plural(files, "file")}: ${names}${more > 0 ? ` and ${count(more)} more` : ""}`;
};

const figuresLine = (typescript: InspectedTypeScript): string =>
  [
    plural(typescript.files, "TypeScript or JavaScript file"),
    ...(typescript.unparsed === 0
      ? []
      : [`${count(typescript.unparsed)} not parsed`]),
    `hardest function ${count(typescript.maxComplexity)}`,
    `${count(typescript.complexFunctions)} at 15 or more`,
    `${count(typescript.escapes)} escape ${typescript.escapes === 1 ? "hatch" : "hatches"}`,
    ...(typescript.directives === 0
      ? []
      : [plural(typescript.directives, "@ts directive")]),
    ...(typescript.strict === undefined
      ? []
      : [`strict ${String(typescript.strict)}`]),
  ].join(SEPARATOR);

/** The lines of the entry's TypeScript figures; none when the entry matched no such file. */
export const inspectTypeScriptLines = ({
  typescript,
}: {
  readonly typescript?: InspectedTypeScript | undefined;
}): ReadonlyArray<string> =>
  typescript === undefined
    ? []
    : [
        figuresLine(typescript),
        ...typescript.hardest.map(
          ({ name, path, line, complexity }) =>
            `  ${count(complexity)} ${escapeForTerminal(name)} at ${escapeForTerminal(path)}:${line}`,
        ),
        fileListLine("imported by", typescript.importedBy),
        fileListLine("tested by", typescript.testedBy),
      ];

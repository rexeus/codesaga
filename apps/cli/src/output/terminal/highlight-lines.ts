// Owns the highlights block of the `analyze` view: the first notable facts of the report, one per line.
// The engine ranks them; the terminal only shows the top few. Every sentence passes terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { section } from "./layout.js";
import type { Style } from "./style.js";

const TOP_HIGHLIGHTS = 3;

/** The top highlights as a labelled block; no lines at all when the report has none. */
export const highlightLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> =>
  section(
    "Highlights",
    report.highlights
      .slice(0, TOP_HIGHLIGHTS)
      .map(
        ({ title, detail }) =>
          `${escapeForTerminal(title)}: ${escapeForTerminal(detail)}`,
      ),
    style,
  );

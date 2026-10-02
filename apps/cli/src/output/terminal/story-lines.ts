// Owns the stories block of the `analyze` view: the first notable facts of the report, one per line.
// The engine ranks them; the terminal only shows the top few. Every sentence passes terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { section } from "./layout.js";
import type { Style } from "./style.js";

const TOP_STORIES = 3;

/** The top stories as a labelled block; no lines at all when the report has none. */
export const storyLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> =>
  section(
    "Stories",
    report.stories
      .slice(0, TOP_STORIES)
      .map(
        ({ title, detail }) =>
          `${escapeForTerminal(title)}: ${escapeForTerminal(detail)}`,
      ),
    style,
  );

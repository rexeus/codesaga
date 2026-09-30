import { Command } from "effect/cli";

import { version } from "./version.js";

const root = Command.make("codesaga").pipe(
  Command.withDescription(
    "The story of a git repository: activity, people, knowledge and AI agents.",
  ),
);

/** Runs codesaga against the given arguments (without the node and script path). */
export const runCli = Command.runWith(root, { version });

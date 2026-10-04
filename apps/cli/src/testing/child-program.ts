// Tests only: how to run this program's parse child from source, the way `pnpm dev` does.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ChildCommand } from "../typescript/child-worker.js";

/** The entry `bin.ts` with the TypeScript loader, so a forked child can run TypeScript sources. */
export const sourceProgram = (): ChildCommand => ({
  entry: fileURLToPath(new URL("../bin.ts", import.meta.url)),
  execArgv: [
    "--import",
    pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href,
  ],
});

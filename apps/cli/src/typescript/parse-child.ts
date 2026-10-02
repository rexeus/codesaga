// Owns the parse child: the process that holds oxc-parser and parses what the application sends it.
// `bin.ts` runs this instead of the CLI when `fork` started the process with the parse-child switch.
// A parse that kills this process costs the application one file, which it finds by bisecting.
import { factsOfSource } from "@codesaga/engine";

import { loadOxcParser } from "./oxc-loader.js";
import { isParseRequest } from "./parse-protocol.js";
import type { ChildReady, ParseReply } from "./parse-protocol.js";

const reply = (message: ChildReady | ParseReply): void => {
  process.send?.(message);
};

const firstLine = (cause: unknown): string =>
  (cause instanceof Error ? cause.message : String(cause)).split("\n")[0] ?? "";

// The application is the only party that can end this process cleanly; when it
// goes away, so does the child.
process.on("disconnect", () => {
  process.exit(0);
});

try {
  const { version, parse } = await loadOxcParser();
  process.on("message", (message: unknown) => {
    if (isParseRequest(message)) {
      reply({
        type: "verdicts",
        results: message.sources.map((source) => factsOfSource(parse, source)),
      });
    }
  });
  reply({ type: "ready", version });
} catch (cause) {
  // Nothing more to do once the application has the reason.
  process.send?.({ type: "unavailable", reason: firstLine(cause) }, () => {
    process.exit(0);
  });
}

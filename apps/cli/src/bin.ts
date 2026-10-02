#!/usr/bin/env node
import { PARSE_CHILD_ENV } from "./typescript/parse-protocol.js";

// A parse child is this program started again by `fork` to hold the native
// parser; it never runs the CLI, and a stray value of the variable in a user's
// shell, with no parent to talk to, does not turn the CLI into one.
if (process.env[PARSE_CHILD_ENV] === "1" && process.send !== undefined) {
  await import("./typescript/parse-child.js");
} else {
  await import("./main.js");
}

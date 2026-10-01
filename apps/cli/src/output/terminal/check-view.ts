// Owns the human view of `check`: one line per gate with the reason, then the verdict.
// The reasons are built from numbers only, so nothing here needs terminal-safe escaping.
import type { CheckResult } from "../../check/check-result.js";
import { plural } from "./format.js";
import type { Style } from "./style.js";

const PASSED_MARK = "✓";
const FAILED_MARK = "✗";

/** Renders the gates marked passed or failed, followed by a one-line verdict. */
export const renderCheck = (result: CheckResult, style: Style): string => {
  const failed = result.gates.filter((gate) => !gate.passed).length;
  const verdict = result.passed
    ? `All ${plural(result.gates.length, "gate")} passed`
    : `${failed} of ${plural(result.gates.length, "gate")} failed`;
  return [
    ...result.gates.map((gate) =>
      gate.passed
        ? `${PASSED_MARK} ${gate.reason}`
        : style.bold(`${FAILED_MARK} ${gate.reason}`),
    ),
    "",
    style.bold(verdict),
  ].join("\n");
};

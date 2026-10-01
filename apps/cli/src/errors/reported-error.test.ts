import { Runtime } from "effect";
import { CliError } from "effect/cli";
import { describe, expect, it } from "vitest";

import { fieldsOf } from "../testing/error-fields.js";
import { PathNotFound } from "./path-not-found.js";
import {
  CliReportedError,
  toReportedError,
  toUnexpectedError,
} from "./reported-error.js";

const reported = (message: string, exitCode: number) =>
  fieldsOf(new CliReportedError({ message, exitCode, resultPrinted: false }));

describe("toReportedError", () => {
  it("maps a missing path to a usage error", () => {
    const error = toReportedError(new PathNotFound({ path: "/repo/src/x.ts" }));

    expect(fieldsOf(error)).toStrictEqual(
      reported("no such file or directory: /repo/src/x.ts", 2),
    );
  });

  it("maps a flag the parser rejected to a usage error", () => {
    const error = toReportedError(
      new CliError.UnrecognizedOption({
        option: "--nope",
        command: ["codesaga", "analyze"],
        suggestions: [],
      }),
    );

    expect(fieldsOf(error)).toStrictEqual(
      reported("Unrecognized flag: --nope in command codesaga analyze", 2),
    );
  });

  it("joins the parse errors that came with a help display into one usage error", () => {
    const error = toReportedError(
      new CliError.ShowHelp({
        commandPath: ["codesaga"],
        errors: [
          new CliError.MissingOption({ option: "a" }),
          new CliError.MissingOption({ option: "b" }),
        ],
      }),
    );

    expect(fieldsOf(error)).toStrictEqual(
      reported("Missing required flag: --a; Missing required flag: --b", 2),
    );
  });

  it("escapes control characters that came from user input", () => {
    const error = toReportedError(
      new PathNotFound({ path: "\u001B[31mred\nline" }),
    );

    expect(fieldsOf(error)).toStrictEqual(
      reported("no such file or directory: \\u001b[31mred\\u000aline", 2),
    );
  });

  it("tells the runtime the exit code and that the error is already reported", () => {
    const error = toReportedError(new PathNotFound({ path: "a.ts" }));

    expect(Runtime.getErrorExitCode(error)).toBe(2);
    expect(Runtime.getErrorReported(error)).toBe(false);
  });
});

describe("toUnexpectedError", () => {
  it("words a defect as exit code 1 without its stack", () => {
    const error = toUnexpectedError(new Error("boom"));

    expect(fieldsOf(error)).toStrictEqual(
      reported("unexpected error: boom", 1),
    );
  });

  it("words a non-error defect with its string form", () => {
    expect(fieldsOf(toUnexpectedError("broken"))).toStrictEqual(
      reported("unexpected error: broken", 1),
    );
  });
});

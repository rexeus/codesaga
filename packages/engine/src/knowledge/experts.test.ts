import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import type { Contribution } from "./contributions.js";
import { expertsOf } from "./experts.js";

const headTime = at("2026-03-01T00:00:00Z");
const file = { size: 100, headTime };

const contribution = (
  email: string,
  overrides: Partial<Contribution> = {},
): Contribution => ({
  email,
  adds: 100,
  firstAuthor: false,
  lastTime: headTime,
  ...overrides,
});

describe("expertsOf", () => {
  it("makes two close peers both experts", () => {
    const experts = expertsOf(
      [contribution("ada"), contribution("grace", { adds: 80 })],
      file,
    );

    expect(experts).toStrictEqual(["ada", "grace"]);
  });

  it("leaves out a person whose degree is below 0.7 of the best", () => {
    // Ada: 5.28223 + 0.23173·ln 201 + 0.36151 − 0.28761·ln 100 ≈ 5.548
    // Grace, last commit 1000 days ago: 5.28223 + 0.23173·ln 2 − 0.19421·ln 1001 − 0.28761·ln 100 ≈ 2.777, 0.50 of Ada's
    const experts = expertsOf(
      [
        contribution("ada", { adds: 200, firstAuthor: true }),
        contribution("grace", {
          adds: 1,
          lastTime: headTime - 1000 * 86_400,
        }),
      ],
      file,
    );

    expect(experts).toStrictEqual(["ada"]);
  });

  it("requires at least one added line", () => {
    const experts = expertsOf([contribution("ada", { adds: 0 })], file);

    expect(experts).toStrictEqual([]);
  });

  it("finds no expert on a file without contributions", () => {
    expect(expertsOf([], file)).toStrictEqual([]);
  });
});

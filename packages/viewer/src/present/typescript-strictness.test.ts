import { describe, expect, it } from "vitest";

import { firstOf, sampleBlock } from "../testing/reports.js";
import {
  configRows,
  optionRows,
  strictnessFacts,
  strictFiles,
} from "./typescript-strictness.js";

const strictness = sampleBlock("strictness");

describe("optionRows", () => {
  it("splits the governed files by what their config sets, on first", () => {
    const rows = optionRows(strictness);

    // 338 governed files: only apps/admin (44 files) has strict off
    expect(rows[0]).toEqual({
      option: "strict",
      share: "87%",
      segments: [
        { state: "on", files: 294, label: "on" },
        { state: "off", files: 44, label: "off" },
      ],
    });
  });

  it("weights each config by the files it governs", () => {
    const rows = optionRows(strictness);

    // apps/web 96 + packages/api 64 = 160 of 338 files check indexed access
    expect(
      rows.find(({ option }) => option === "noUncheckedIndexedAccess"),
    ).toMatchObject({
      share: "47%",
      segments: [
        { state: "on", files: 160 },
        { state: "off", files: 178 },
      ],
    });
  });

  it("keeps the files of an unreadable config as unknown, never as off", () => {
    const config = firstOf(strictness.configs);
    const rows = optionRows({
      ...strictness,
      configs: [{ ...config, files: 10, strict: "unknown" }],
    });

    expect(rows[0]).toMatchObject({
      share: "0%",
      segments: [{ state: "unknown", files: 10 }],
    });
  });

  it("does not round almost all files to 100%", () => {
    const config = firstOf(strictness.configs);
    const rows = optionRows({
      ...strictness,
      configs: [
        { ...config, files: 996, strict: true },
        { ...config, files: 4, strict: false },
      ],
    });

    expect(rows[0]?.share).toBe(">99%");
  });

  it("has no bars when no config governs a file", () => {
    expect(optionRows({ ...strictness, configs: [] })).toEqual([]);
  });
});

describe("strictFiles", () => {
  it("counts the files whose config has strict on, of the governed files", () => {
    expect(strictFiles(strictness)).toEqual({
      on: 294,
      total: 338,
      listedOnly: false,
    });
  });

  it("says the files are those of the listed configs when the report lists fewer than it read", () => {
    expect(strictFiles({ ...strictness, totalConfigs: 46 })?.listedOnly).toBe(
      true,
    );
  });

  it("is null without a governed file", () => {
    expect(strictFiles({ ...strictness, configs: [] })).toBeNull();
  });
});

describe("configRows", () => {
  it("lists every option of a config as a flag with its state", () => {
    const [web] = configRows(strictness);

    expect(web).toEqual({
      path: "apps/web/tsconfig.json",
      files: "96 files",
      flags: [
        { option: "strict", state: "on" },
        { option: "noUncheckedIndexedAccess", state: "on" },
        { option: "exactOptionalPropertyTypes", state: "off" },
        { option: "noImplicitOverride", state: "off" },
        { option: "verbatimModuleSyntax", state: "off" },
      ],
      notes: [],
    });
  });

  it("notes the parts of strict a config sets apart", () => {
    const admin = configRows(strictness).find(({ path }) =>
      path.startsWith("apps/admin"),
    );

    expect(admin?.notes).toEqual(["sets noImplicitAny apart from strict"]);
  });

  it("notes the configs it could not read", () => {
    const config = firstOf(strictness.configs);
    const [row] = configRows({
      ...strictness,
      configs: [{ ...config, unresolved: ["@acme/tsconfig"] }],
    });

    expect(row?.notes).toEqual(["could not read @acme/tsconfig"]);
  });
});

describe("strictnessFacts", () => {
  it("states the declared version, what an unset strict means and how many files are governed", () => {
    expect(strictnessFacts(strictness)).toEqual({
      lines: [
        "TypeScript ^5.9.2 is declared; an unset strict is off by default.",
        "338 files governed by 7 configs, 4 by none.",
      ],
      truncated: null,
    });
  });

  it("says when the report lists fewer configs than it read", () => {
    const facts = strictnessFacts({ ...strictness, totalConfigs: 46 });

    expect(facts.truncated).toBe(
      "The report lists 7 of 46 configs, and the bars cover the files of those.",
    );
  });

  it("does not guess a version or a default", () => {
    const facts = strictnessFacts({
      ...strictness,
      typescript: { declared: null, strictByDefault: "unknown" },
    });

    expect(facts.lines[0]).toBe(
      "No TypeScript version is declared in the root package.json.",
    );
  });
});

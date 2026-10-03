import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { moduleEraStory, typeScriptStoryLines } from "./typescript-stories.js";

const { stories } = sampleReport();
const story = (kind: (typeof stories)[number]["kind"], title = kind) => ({
  kind,
  title,
  detail: `${kind} detail`,
});

describe("typeScriptStoryLines", () => {
  it("keeps the stories about the TypeScript code and drops the others", () => {
    expect(typeScriptStoryLines(stories).map(({ title }) => title)).toEqual([
      "Hard functions",
    ]);
  });

  it("takes the icon of the story's card and keeps the report's order", () => {
    const lines = typeScriptStoryLines([
      story("streak"),
      story("module-era"),
      story("strict-since"),
    ]);

    expect(lines.map(({ title, icon }) => [title, icon])).toEqual([
      ["module-era", "history"],
      ["strict-since", "lock"],
    ]);
  });

  it("has no line without a story about the code", () => {
    expect(typeScriptStoryLines([story("streak")])).toEqual([]);
    expect(typeScriptStoryLines([])).toEqual([]);
  });
});

describe("moduleEraStory", () => {
  it("finds the story that tells how the module system changed", () => {
    expect(moduleEraStory([story("streak"), story("module-era")])?.detail).toBe(
      "module-era detail",
    );
  });

  it("is null without one", () => {
    expect(moduleEraStory(stories)).toBeNull();
  });
});

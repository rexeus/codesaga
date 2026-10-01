import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { parseReport, serializeReport } from "./embedded-report.js";

describe("embedded report", () => {
  const report = sampleReport();
  const named = {
    ...report,
    repository: { ...report.repository, name: "<script>&<!--" },
  };

  it("restores the report from its serialized form", () => {
    expect(parseReport(serializeReport(named))).toEqual(named);
  });

  it("never emits a less-than sign", () => {
    expect(serializeReport(named)).not.toContain("<");
  });

  it("rejects a document of another schema version", () => {
    const future = JSON.stringify({ ...report, schemaVersion: 2 });

    expect(() => parseReport(future)).toThrow(/not a codesaga report/u);
  });

  it("rejects JSON that is not a report", () => {
    expect(() => parseReport("[]")).toThrow(/not a codesaga report/u);
    expect(() => parseReport('{"schemaVersion":1}')).toThrow(
      /not a codesaga report/u,
    );
  });
});

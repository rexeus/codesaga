import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { renderReportHtml } from "./template.js";

const hostileName = "</script><img onerror=alert(1)>";

const embeddedReport = (html: string): unknown => {
  const match =
    /<script type="application\/json" id="report">(.*?)<\/script>/su.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("the document embeds no report");
  }
  return JSON.parse(match[1]);
};

describe("renderReportHtml", () => {
  const report = sampleReport();

  it("returns a complete HTML document", () => {
    const html = renderReportHtml(report);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<div id="app"');
    expect(html).toContain("</html>");
  });

  it("embeds the whole report so it round-trips through JSON", () => {
    expect(embeddedReport(renderReportHtml(report))).toEqual(report);
  });

  it("cannot be broken out of by a crafted contributor name", () => {
    const [first, ...rest] = report.contributors;
    const hostile = {
      ...report,
      contributors:
        first === undefined ? [] : [{ ...first, name: hostileName }, ...rest],
    };

    const html = renderReportHtml(hostile);

    expect(html).not.toContain(hostileName);
    expect(html).not.toContain("<img");
    expect(html.match(/<script/gu)).toHaveLength(2);
    expect(embeddedReport(html)).toEqual(hostile);
  });

  it("escapes the repository name in the page title", () => {
    const html = renderReportHtml({
      ...report,
      repository: { ...report.repository, name: "<b>&co" },
    });

    expect(html).toContain("<title>codesaga · &lt;b&gt;&amp;co</title>");
  });

  it("loads nothing from the network", () => {
    const html = renderReportHtml(report);

    expect(html).not.toMatch(/https?:\/\//u);
    expect(html).not.toMatch(/\s(?:src|href)="(?!data:)/u);
    expect(html).not.toContain("@import");
  });
});

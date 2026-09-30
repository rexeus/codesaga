import type { Report } from "@codesaga/engine";

/**
 * Applies `--limit` to a report: `contributors` is cut to its first `limit`
 * entries, `0` keeps everything, and `totals` still describes the untruncated
 * size. Time series are never cut.
 */
export const limitReport = (report: Report, limit: number): Report =>
  limit === 0
    ? report
    : { ...report, contributors: report.contributors.slice(0, limit) };

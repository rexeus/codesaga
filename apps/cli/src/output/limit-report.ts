import type { Report } from "@codesaga/engine";

/** The contributors and knowledge directories `analyze` reports in JSON when nothing sets a limit. */
export const DEFAULT_LIMIT = 25;

/**
 * Applies `--limit` to a report: `contributors` is cut to its first `limit`
 * entries and so are the knowledge `directories` (already ordered by risk),
 * `0` keeps everything, and `totals` still describes the untruncated size.
 * The pull request authors and reviewers are cut the same way, with their
 * sizes in `pullRequests.totals`. Time series are never cut.
 */
export const limitReport = (report: Report, limit: number): Report =>
  limit === 0
    ? report
    : {
        ...report,
        contributors: report.contributors.slice(0, limit),
        knowledge: {
          ...report.knowledge,
          directories: report.knowledge.directories.slice(0, limit),
        },
        ...(report.pullRequests === undefined
          ? {}
          : {
              pullRequests: {
                ...report.pullRequests,
                authors: report.pullRequests.authors.slice(0, limit),
                reviewers: report.pullRequests.reviewers.slice(0, limit),
              },
            }),
      };

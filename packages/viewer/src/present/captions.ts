import { formatCount } from "./format.js";

type Resolution = "weeks" | "months";

const unitOf = (resolution: Resolution): string =>
  resolution === "weeks" ? "week" : "month";

/** "Commits per week" or "per month", whichever bar the chart draws. */
export const commitsTitle = (resolution: Resolution): string =>
  `Commits per ${unitOf(resolution)}`;

/** "Lines changed per week", or per month. */
export const churnTitle = (resolution: Resolution): string =>
  `Lines changed per ${unitOf(resolution)}`;

/**
 * Says what the commit bars show: how many of them there are, whether the
 * recent part is emphasised, and what the dashed line averages.
 */
export const commitsSubtitle = (
  resolution: Resolution,
  buckets: number,
  average: number,
  recentEmphasised: boolean,
): string => {
  const unit = unitOf(resolution);
  const count = `${formatCount(buckets)} ${unit}s`;
  const recent = recentEmphasised ? ", last 12 highlighted" : "";
  return `${count}${recent}. The dashed line is the average of ${formatCount(Math.round(average))} a ${unit}.`;
};

import type { Report } from "@codesaga/engine";

import { formatDate } from "./format.js";

/** The dashboard's header phrase naming the span the window is compared with, and warning when that span reaches before the first commit. */
export const describeComparison = ({
  since,
  until,
  partial,
}: Pick<
  NonNullable<Report["comparison"]>["previous"],
  "since" | "until" | "partial"
>): string => {
  const named = `compared with ${formatDate(since)} → ${formatDate(until)}`;
  return partial
    ? `${named} (previous period partly before the first commit)`
    : named;
};

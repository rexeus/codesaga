import { Flag } from "effect/cli";

export const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDescription(
    "Print one JSON document to stdout instead of the terminal view",
  ),
  Flag.withDefault(false),
);

export const sinceFlag = Flag.String("since").pipe(
  Flag.withDescription(
    "Narrow the activity to the time since: <n>d, <n>w, <n>m, <n>y, or an ISO date (YYYY-MM-DD); default: the whole history",
  ),
  Flag.optional,
);

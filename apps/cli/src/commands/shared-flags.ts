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

export const cacheFlag = Flag.Boolean("cache").pipe(
  Flag.withDescription(
    "Reuse the parsed history cached in the git directory; --no-cache reads git every time and leaves the cache alone",
  ),
  Flag.withDefault(true),
);

export const compareFlag = Flag.String("compare").pipe(
  Flag.withDescription(
    "Compare the last <n>d, <n>w, <n>m or <n>y with the equally long span before it; cannot be combined with --since",
  ),
  Flag.optional,
);

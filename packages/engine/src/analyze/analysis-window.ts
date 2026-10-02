// Owns turning `--since` input into the absolute analysis window.
import { DateTime, Effect, Option, Schema } from "effect";

/** `since` is neither `<n>d|w|m|y` nor an ISO date (`YYYY-MM-DD`), or it is not a representable date in the past. */
export class InvalidSince extends Schema.TaggedError<InvalidSince>()(
  "InvalidSince",
  { input: Schema.String },
) {}

/**
 * `compare` is not `<n>d|w|m|y`, reaches beyond the dates JavaScript can
 * represent, or is combined with `since`; `reason` tells which.
 */
export class InvalidCompare extends Schema.TaggedError<InvalidCompare>()(
  "InvalidCompare",
  {
    input: Schema.String,
    reason: Schema.Literals(["duration", "withSince"]),
  },
) {}

/** The time range of an analysis as ISO 8601 UTC timestamps. */
export type TimeRange = { readonly since: string; readonly until: string };

const RELATIVE = /^([1-9]\d*)([dwmy])$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const COUNT_BACK: Readonly<
  Record<string, (now: DateTime.Utc, amount: number) => DateTime.Utc>
> = {
  d: (now, days) => DateTime.subtract(now, { days }),
  w: (now, weeks) => DateTime.subtract(now, { weeks }),
  m: (now, months) => DateTime.subtract(now, { months }),
  y: (now, years) => DateTime.subtract(now, { years }),
};

const parseRelative = (
  since: string,
  now: DateTime.Utc,
): Option.Option<DateTime.Utc> => {
  const [, amount = "", unit = ""] = RELATIVE.exec(since) ?? [];
  const countBack = COUNT_BACK[unit];
  return countBack === undefined
    ? Option.none()
    : Option.some(countBack(now, Number(amount)));
};

// A date that rolled over (2026-02-30 becoming March 2) no longer formats to its input.
const parseIsoDate = (since: string): Option.Option<DateTime.Utc> =>
  ISO_DATE.test(since)
    ? Option.filter(DateTime.make(since), (date) =>
        DateTime.formatIso(date).startsWith(since),
      )
    : Option.none();

// Counting back far enough leaves the range of JavaScript dates, which yields an invalid date.
const isUsableStart = (start: DateTime.Utc, now: DateTime.Utc): boolean =>
  Number.isFinite(DateTime.toEpochMillis(start)) &&
  !DateTime.isGreaterThan(start, now);

/**
 * Resolves `since` to a range ending at the current `Clock` time.
 *
 * `<n>d|w|m|y` counts back n days, weeks, calendar months, or calendar years
 * from now; an ISO date starts at midnight UTC of that day. A start after now
 * or beyond the dates JavaScript can represent is invalid.
 */
export const resolveTimeRange = (
  since: string,
): Effect.Effect<TimeRange, InvalidSince> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const start = Option.filter(
      Option.orElse(parseRelative(since, now), () => parseIsoDate(since)),
      (date) => isUsableStart(date, now),
    );
    if (Option.isNone(start)) {
      return yield* new InvalidSince({ input: since });
    }
    return {
      since: DateTime.formatIso(start.value),
      until: DateTime.formatIso(now),
    };
  });

/** Two consecutive ranges: `previous` ends where `current` starts. */
export type ComparedRanges = {
  readonly current: TimeRange;
  readonly previous: TimeRange;
};

/**
 * Resolves a `<n>d|w|m|y` duration to the last such span ending at the
 * current `Clock` time and the span before it. `previous.until` equals
 * `current.since` and belongs to `current`, so no instant is in both ranges.
 * `current` starts a calendar unit count back from now, and `previous` is
 * exactly as long as `current` in milliseconds, so the two compare like for
 * like even where months and years differ in length.
 */
export const resolveComparedRanges = (
  duration: string,
): Effect.Effect<ComparedRanges, InvalidCompare> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const current = Option.filter(parseRelative(duration, now), (start) =>
      isUsableStart(start, now),
    );
    const previous = Option.flatMap(current, (start) =>
      DateTime.make(
        2 * DateTime.toEpochMillis(start) - DateTime.toEpochMillis(now),
      ),
    );
    if (Option.isNone(current) || Option.isNone(previous)) {
      return yield* new InvalidCompare({ input: duration, reason: "duration" });
    }
    const since = DateTime.formatIso(current.value);
    return {
      current: { since, until: DateTime.formatIso(now) },
      previous: {
        since: DateTime.formatIso(previous.value),
        until: since,
      },
    };
  });

/** An ISO 8601 timestamp as seconds since the epoch, the unit of commit times. */
export const toEpochSeconds = (iso: string): number =>
  DateTime.toEpochMillis(DateTime.makeUnsafe(iso)) / 1000;

/** Seconds since the epoch, the unit of commit times, as an ISO 8601 timestamp. */
export const isoOfEpochSeconds = (seconds: number): string =>
  DateTime.formatIso(DateTime.makeUnsafe(seconds * 1000));

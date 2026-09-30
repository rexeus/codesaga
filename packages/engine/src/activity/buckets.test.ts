import { describe, it } from "vitest";

describe("weekStartOf", () => {
  it.todo("starts a week on Monday, so a Sunday belongs to the week before");
  it.todo("uses UTC, so 23:30 on Sunday at -05:00 stays in that week");
  it.todo("crosses a year boundary without skipping or repeating a week");
});

describe("monthOf", () => {
  it.todo("formats the UTC calendar month as YYYY-MM");
  it.todo("puts the last second of a month into that month");
});

describe("weeksOf", () => {
  it.todo(
    "lists consecutive Monday starts from the window's first to its last week",
  );
  it.todo("returns one week when the window lies inside a single week");
});

describe("monthsOf", () => {
  it.todo(
    "lists consecutive months across a year boundary, including empty ones",
  );
});

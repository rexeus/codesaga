import { Order } from "effect";
import { describe, expect, it } from "vitest";

import { removalOrder } from "./truck-factor.js";

const byName = Order.String;

describe("removalOrder", () => {
  it("needs one person when one person is expert on everything", () => {
    expect(removalOrder([["ada"], ["ada"], ["ada"]], byName)).toStrictEqual([
      "ada",
    ]);
  });

  it("needs two people for two disjoint halves", () => {
    // After Ada leaves, exactly half of the files is uncovered, which is not more than half
    const removed = removalOrder(
      [["ada"], ["ada"], ["grace"], ["grace"]],
      byName,
    );

    expect(removed).toStrictEqual(["ada", "grace"]);
  });

  it("removes the person who is expert on the most files first", () => {
    const removed = removalOrder(
      [["ada", "grace"], ["ada"], ["ada"], ["ada"], ["grace"]],
      byName,
    );

    expect(removed).toStrictEqual(["ada"]);
  });

  it("needs nobody when most files already have no expert", () => {
    expect(removalOrder([["ada"], [], [], []], byName)).toStrictEqual([]);
  });

  it("needs nobody for no files", () => {
    expect(removalOrder([], byName)).toStrictEqual([]);
  });

  it("breaks a tie with the given order", () => {
    const commits: Record<string, number> = { ada: 3, grace: 9 };
    const moreCommitsFirst = Order.flip(
      Order.mapInput(Order.Number, (name: string) => commits[name] ?? 0),
    );

    expect(removalOrder([["ada"], ["grace"]], moreCommitsFirst)).toStrictEqual([
      "grace",
      "ada",
    ]);
  });
});

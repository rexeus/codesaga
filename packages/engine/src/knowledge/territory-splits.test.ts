import { describe, expect, it } from "vitest";

import {
  filesIn,
  partition,
  summarize,
} from "../testing/territory-partition.js";
import { territoriesAtDetail } from "./territories.js";
import type { PartitionTerritory } from "./territory-partition.js";

describe("partitionTerritories splits of a dominant territory", () => {
  // 40 files: the package holds all of them, more than 40%, and so does src with 32
  const single = [
    ...filesIn("src/core", 20),
    ...filesIn("src/util", 12),
    ...filesIn("test", 5),
    "main.ts",
    "index.ts",
    "config.ts",
  ];

  it("splits a package that holds most of the files into its folders and its loose files at detail 1", () => {
    const { territories, maxDetail } = partition(single, ["."]);
    const [root] = territories;

    expect(summarize(territories)).toStrictEqual(["package . 40"]);
    expect(root).toMatchObject({
      splitReason: "big: 40 files",
      splitDetail: 1,
    });
    expect(summarize(root?.territories ?? [])).toStrictEqual([
      "folder src 32",
      "folder test 5",
      "other . 3",
    ]);
    expect(maxDetail).toBe(1);
  });

  it("opens a child that is dominant itself at detail 1 too", () => {
    const { territories } = partition(single, ["."]);
    const src = territories[0]?.territories.find(({ path }) => path === "src");

    expect(src).toMatchObject({ splitReason: "big: 32 files", splitDetail: 1 });
    expect(summarize(src?.territories ?? [])).toStrictEqual([
      "folder src/core 20",
      "folder src/util 12",
    ]);
  });

  it("shows no dominant territory whole at detail 1, covering every file once", () => {
    const { territories } = partition(single, ["."]);

    expect(summarize(territoriesAtDetail(territories, 1))).toStrictEqual([
      "folder src/core 20",
      "folder src/util 12",
      "folder test 5",
      "other . 3",
    ]);
  });
});

describe("partitionTerritories dominant and later splits together", () => {
  it("opens a dominant territory at detail 1 even where a split by experts opens later", () => {
    // p holds 40 of 60 files; its folders have different experts, and so do q's, which holds 20
    const { territories, maxDetail } = partition(
      [
        ...filesIn("p/a", 20),
        ...filesIn("p/b", 20),
        ...filesIn("q/a", 10),
        ...filesIn("q/b", 10),
      ],
      ["p", "q"],
      {
        experts: { "p/a": "ada", "p/b": "grace", "q/a": "ada", "q/b": "grace" },
      },
    );

    expect(
      territories.map(({ path, splitDetail }) => [path, splitDetail]),
    ).toStrictEqual([
      ["p", 1],
      ["q", 2],
    ]);
    expect(maxDetail).toBe(2);
  });
});

describe("partitionTerritories splits that are not dominant", () => {
  // 100 files: p holds 35, above the bound of 30 files but at most 40%; q and r have no folders
  const paths = [
    ...filesIn("p/src", 20),
    ...filesIn("p/test", 15),
    ...filesIn("q", 33),
    ...filesIn("r", 32),
  ];

  it("opens a big territory below the share of a dominant one at detail 2", () => {
    const { territories, maxDetail } = partition(paths, ["p", "q", "r"]);

    expect(
      territories.map(({ path, splitReason, splitDetail }) => [
        path,
        splitReason,
        splitDetail,
      ]),
    ).toStrictEqual([
      ["p", "big: 35 files", 2],
      ["q", undefined, undefined],
      ["r", undefined, undefined],
    ]);
    expect(maxDetail).toBe(2);
  });

  it("shows the territory whole at detail 1 and its folders from detail 2", () => {
    const { territories } = partition(paths, ["p", "q", "r"]);

    expect(
      [1, 2].map((detail) =>
        summarize(territoriesAtDetail(territories, detail)),
      ),
    ).toStrictEqual([
      ["package p 35", "package q 33", "package r 32"],
      ["folder p/src 20", "folder p/test 15", "package q 33", "package r 32"],
    ]);
  });
});

describe("partitionTerritories order of splits", () => {
  // z holds 80 of 120 files without folders; p holds 40 and splits by size; q holds 24 and splits by experts
  const filler = filesIn("z", 56);
  const paths = [
    ...filesIn("p/a", 20),
    ...filesIn("p/b", 20),
    ...filesIn("q/a", 12),
    ...filesIn("q/b", 12),
    ...filler,
  ];
  const experts = { "q/a": "ada", "q/b": "grace" };

  it("opens a split by expertise before a split by size and records the last such detail", () => {
    const { territories, maxDetail, expertiseDetail } = partition(
      paths,
      ["p", "q"],
      { experts },
    );

    expect(
      territories
        .filter(({ path }) => path !== "z")
        .map(({ path, splitReason, splitDetail }) => [
          path,
          splitReason,
          splitDetail,
        ]),
    ).toStrictEqual([
      ["p", "big: 40 files", 3],
      ["q", "q/a and q/b have different experts", 2],
    ]);
    expect(maxDetail).toBe(3);
    expect(expertiseDetail).toBe(2);
  });
});

const withFiller = (paths: ReadonlyArray<string>) => [
  ...paths,
  ...filesIn("z", 100),
];
const splitDetails = (
  territories: ReadonlyArray<PartitionTerritory>,
): ReadonlyArray<readonly [string, number | undefined]> =>
  territories
    .filter(({ path }) => path !== "z")
    .map(({ path, splitDetail }) => [path, splitDetail]);

describe("partitionTerritories value of splits", () => {
  it("opens the split with more distinct experts first", () => {
    const { territories } = partition(
      withFiller([
        ...filesIn("p/a", 6),
        ...filesIn("p/b", 6),
        ...filesIn("q/a", 6),
        ...filesIn("q/b", 6),
        ...filesIn("q/c", 6),
      ]),
      ["p", "q"],
      {
        experts: {
          "p/a": "ada",
          "p/b": "grace",
          "q/a": "ada",
          "q/b": "grace",
          "q/c": "linus",
        },
      },
    );

    expect(splitDetails(territories)).toStrictEqual([
      ["p", 3],
      ["q", 2],
    ]);
  });

  it("opens the larger of two equally valuable splits first", () => {
    const { territories } = partition(
      withFiller([
        ...filesIn("p/a", 4),
        ...filesIn("p/b", 4),
        ...filesIn("q/a", 6),
        ...filesIn("q/b", 6),
      ]),
      ["p", "q"],
      {
        experts: { "p/a": "ada", "p/b": "grace", "q/a": "ada", "q/b": "grace" },
      },
    );

    expect(splitDetails(territories)).toStrictEqual([
      ["p", 3],
      ["q", 2],
    ]);
  });
});

describe("partitionTerritories details of splits", () => {
  it("spreads the splits evenly over the details in order and stops at detail 6", () => {
    // seven packages of 10 files, each with two folders of different experts and equal value: opened by path
    const names = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const { territories, maxDetail } = partition(
      names.flatMap((name) => [
        ...filesIn(`${name}/a`, 5),
        ...filesIn(`${name}/b`, 5),
      ]),
      names,
      {
        experts: Object.fromEntries(
          names.flatMap((name) => [
            [`${name}/a`, "ada"],
            [`${name}/b`, "grace"],
          ]),
        ),
      },
    );

    expect(maxDetail).toBe(6);
    expect(territories.map(({ splitDetail }) => splitDetail)).toStrictEqual([
      2, 2, 3, 4, 4, 5, 6,
    ]);
  });
});

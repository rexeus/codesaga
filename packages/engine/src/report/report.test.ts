import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { Report } from "./report.js";

const readSample = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* path.fromFileUrl(
    new URL("../../../../fixtures/report.sample.json", import.meta.url),
  );
  const json: unknown = JSON.parse(yield* fs.readFileString(location));
  return json;
});

const decode = Schema.decodeUnknownSync(Report);

const SECTIONS = [
  "repository",
  "window",
  "thresholds",
  "totals",
  "overview",
  "activity",
  "punchcard",
  "contributors",
  "automation",
  "knowledge",
  "stats",
  "stories",
  "achievements",
] as const;

layer(NodeServices.layer)("Report", (it) => {
  it.effect(
    "decodes the committed sample report in fixtures/report.sample.json",
    () =>
      Effect.gen(function* () {
        const report = decode(yield* readSample);

        assert.strictEqual(report.schemaVersion, 1);
        assert.strictEqual(report.activity.weeks.length, 156);
        assert.strictEqual(report.contributors.length, 8);
        assert.strictEqual(report.automation.tools.length, 5);
        assert.strictEqual(report.knowledge.files, report.overview.files);
        assert.strictEqual(report.knowledge.truckFactor.value, 2);
        assert.strictEqual(
          report.totals.directories,
          report.knowledge.directories.length,
        );
      }),
  );

  it.effect("carries the data of the redesigned dashboard in the sample", () =>
    Effect.gen(function* () {
      const report = decode(yield* readSample);
      const { territories } = report.knowledge;

      assert.strictEqual(territories.maxDetail, 3);
      assert.strictEqual(
        territories.totalTerritories,
        territories.territories.length,
      );
      assert.strictEqual(report.stories.length, 6);
      assert.deepStrictEqual(
        report.achievements
          .filter(({ reached }) => reached)
          .map(({ kind }) => kind),
        ["first-commits", "marathon", "polyglot", "spring-cleaning"],
      );
      assert.deepStrictEqual(
        report.contributors.map(({ status }) => status),
        [
          "active",
          "active",
          "active",
          "dormant",
          "dormant",
          "new",
          "dormant",
          "dormant",
        ],
      );
      for (const { weekly } of report.contributors) {
        assert.strictEqual(weekly.length, 52);
      }
    }),
  );
});

type SampleTerritory =
  Report["knowledge"]["territories"]["territories"][number];

/** Every list of siblings in the tree: the first cut and the children of each split territory. */
const siblingLists = (
  territories: ReadonlyArray<SampleTerritory>,
): ReadonlyArray<ReadonlyArray<SampleTerritory>> => [
  territories,
  ...territories.flatMap(({ territories: inside }) => siblingLists(inside)),
];

layer(NodeServices.layer)("Report sample territories", (it) => {
  it.effect(
    "lists the other-files territories of every list after the other territories",
    () =>
      Effect.gen(function* () {
        const { territories } = decode(yield* readSample).knowledge.territories;

        for (const siblings of siblingLists(territories)) {
          const kinds = siblings.map(({ kind }) => kind);
          assert.deepStrictEqual(
            kinds,
            kinds.toSorted(
              (a, b) => Number(a === "other") - Number(b === "other"),
            ),
          );
        }
      }),
  );

  it.effect(
    "gives exactly the territories that split a reason and a detail within the finest one",
    () =>
      Effect.gen(function* () {
        const { territories, maxDetail } = decode(yield* readSample).knowledge
          .territories;

        for (const territory of siblingLists(territories).flat()) {
          const splits = territory.territories.length > 0;
          assert.strictEqual(territory.splitReason !== undefined, splits);
          assert.strictEqual(territory.splitDetail !== undefined, splits);
          assert.strictEqual(
            territory.totalTerritories,
            territory.territories.length,
          );
          assert.isTrue((territory.splitDetail ?? 2) <= maxDetail);
        }
      }),
  );
});

layer(NodeServices.layer)("Report rejects", (it) => {
  for (const section of SECTIONS) {
    it.effect(`a report without ${section}`, () =>
      Effect.gen(function* () {
        const { [section]: _removed, ...incomplete } = decode(
          yield* readSample,
        );

        assert.throws(
          () => {
            decode(incomplete);
          },
          new RegExp(section, "u"),
        );
      }),
    );
  }

  it.effect("a schemaVersion other than 1", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);

      assert.throws(() => {
        decode({ ...sample, schemaVersion: 2 });
      }, /schemaVersion/u);
    }),
  );

  it.effect("a punch card that is not 7 rows of 24 hours", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const sixDays = sample.punchcard.slice(0, 6);
      const shortDay = sample.punchcard.map((day) => day.slice(0, 23));

      assert.throws(() => {
        decode({ ...sample, punchcard: sixDays });
      }, /punchcard/u);
      assert.throws(() => {
        decode({ ...sample, punchcard: shortDay });
      }, /punchcard/u);
    }),
  );

  it.effect(
    "rejects an automation tool of a kind other than agent or bot",
    () =>
      Effect.gen(function* () {
        const sample = decode(yield* readSample);
        const tools = sample.automation.tools.map((tool) => ({
          ...tool,
          kind: "human",
        }));

        assert.throws(() => {
          decode({ ...sample, automation: { ...sample.automation, tools } });
        }, /kind/u);
      }),
  );
});

layer(NodeServices.layer)("Report rejects a knowledge section with", (it) => {
  it.effect("an expert whose share is outside 0 to 1", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const [first, ...others] = knowledge.directories;
      const [expert, ...experts] = first?.experts ?? [];

      for (const share of [-0.1, 1.5]) {
        const directories = [
          { ...first, experts: [{ ...expert, share }, ...experts] },
          ...others,
        ];
        assert.throws(() => {
          decode({ ...rest, knowledge: { ...knowledge, directories } });
        }, /share/u);
      }
    }),
  );

  it.effect("a directory of more than five experts", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const [first, ...others] = knowledge.directories;
      const experts = Array.from({ length: 6 }, () => first?.experts[0]);
      const directories = [{ ...first, experts }, ...others];

      assert.throws(() => {
        decode({ ...rest, knowledge: { ...knowledge, directories } });
      }, /experts/u);
    }),
  );
});

layer(NodeServices.layer)("Report rejects story data with", (it) => {
  it.effect("a contributor whose weekly commits are not 52 weeks", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const [first, ...others] = sample.contributors;
      const contributors = [
        { ...first, weekly: first?.weekly.slice(0, 51) },
        ...others,
      ];

      assert.throws(() => {
        decode({ ...sample, contributors });
      }, /weekly/u);
    }),
  );

  it.effect("a contributor badge of an unknown kind", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const [first, ...others] = sample.contributors;
      const badge = { kind: "night-owl", label: "Night owl", evidence: "" };
      const contributors = [{ ...first, badges: [badge] }, ...others];

      assert.throws(() => {
        decode({ ...sample, contributors });
      }, /kind/u);
    }),
  );

  it.effect("more than six stories", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const [first] = sample.stories;
      const stories = Array.from({ length: 7 }, () => first);

      assert.throws(() => {
        decode({ ...sample, stories });
      }, /stories/u);
    }),
  );

  it.effect("a knowledge section without territories", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const { territories: _removed, ...withoutTerritories } = knowledge;

      assert.throws(() => {
        decode({ ...rest, knowledge: withoutTerritories });
      }, /territories/u);
    }),
  );

  it.effect("a territory section without maxDetail", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const { maxDetail: _removed, ...territories } = knowledge.territories;

      assert.throws(() => {
        decode({ ...rest, knowledge: { ...knowledge, territories } });
      }, /maxDetail/u);
    }),
  );
});

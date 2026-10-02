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
  "highlights",
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

  it.effect("carries the story data of the redesign in the sample", () =>
    Effect.gen(function* () {
      const report = decode(yield* readSample);
      const levels = report.knowledge.areas.levels;

      assert.deepStrictEqual(
        levels.map(({ depth }) => depth),
        [1, 2, 3],
      );
      assert.strictEqual(report.highlights.length, 6);
      assert.deepStrictEqual(
        report.contributors.map(({ status }) => status),
        [
          "active",
          "active",
          "active",
          "active",
          "active",
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

  it.effect("lists the rest areas of every level after the other areas", () =>
    Effect.gen(function* () {
      const { levels } = decode(yield* readSample).knowledge.areas;

      for (const { areas } of levels) {
        const kinds = areas.map(({ kind }) => kind);
        assert.deepStrictEqual(
          kinds,
          kinds.toSorted((a, b) => Number(a === "rest") - Number(b === "rest")),
        );
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

  it.effect("more than six highlights", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const [first] = sample.highlights;
      const highlights = Array.from({ length: 7 }, () => first);

      assert.throws(() => {
        decode({ ...sample, highlights });
      }, /highlights/u);
    }),
  );

  it.effect("a knowledge section without areas", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const { areas: _removed, ...withoutAreas } = knowledge;

      assert.throws(() => {
        decode({ ...rest, knowledge: withoutAreas });
      }, /areas/u);
    }),
  );

  it.effect("an area section without levels", () =>
    Effect.gen(function* () {
      const { knowledge, ...rest } = decode(yield* readSample);
      const areas = { ...knowledge.areas, levels: [] };

      assert.throws(() => {
        decode({ ...rest, knowledge: { ...knowledge, areas } });
      }, /levels/u);
    }),
  );
});

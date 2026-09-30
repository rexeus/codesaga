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

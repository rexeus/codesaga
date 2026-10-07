import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import type { Node } from "@oxc-project/types";
import { Effect } from "effect";
import { parseSync, visitorKeys } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { engineSources } from "../testing/source-corpus.js";
import { CHILD_KEYS } from "./node-children.js";
import { parseOptionsOf } from "./source-kinds.js";
import { walk } from "./walk.js";

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string";

/** The nodes of a program in the order a walk enters them, found by enumerating every property: what the walk did before it knew the child keys. */
const enumerated = (node: Node, into: Array<string>): Array<string> => {
  into.push(`${node.type}@${node.start}`);
  for (const [key, value] of Object.entries(node)) {
    const children: ReadonlyArray<unknown> = Array.isArray(value)
      ? value
      : [value];
    if (key !== "parent") {
      for (const child of children.filter((item) => isNode(item))) {
        enumerated(child, into);
      }
    }
  }
  return into;
};

const walked = (node: Node): Array<string> => {
  const seen: Array<string> = [];
  walk(node, {
    enter: (entered) => {
      seen.push(`${entered.type}@${entered.start}`);
    },
  });
  return seen;
};

describe("CHILD_KEYS", () => {
  it("lists, for every node type of the installed parser, the properties its visitor walks, in its order", () => {
    const missing = Object.entries(visitorKeys).filter(
      ([type, keys]) =>
        CHILD_KEYS.get(type)?.join(" ") !==
        [...keys, ...(type === "Program" ? ["hashbang"] : [])].join(" "),
    );

    expect(missing).toStrictEqual([]);
  });

  it("walks a hashbang, which the parser's visitor leaves out", () => {
    const { program } = parseSync("cli.ts", "#!/usr/bin/env node\nrun();\n");

    expect(walked(program)).toContain("Hashbang@0");
  });
});

layer(NodeServices.layer)("walk", (corpus) => {
  corpus.effect(
    "enters the same nodes in the same order as enumerating every property, over the engine's own sources",
    () =>
      Effect.gen(function* () {
        const sources = yield* engineSources;

        assert.isAbove(sources.length, 100);
        for (const { path, text } of sources) {
          const { program } = parseSync(path, text, parseOptionsOf(path));
          expect(walked(program), path).toStrictEqual(enumerated(program, []));
        }
      }),
  );
});

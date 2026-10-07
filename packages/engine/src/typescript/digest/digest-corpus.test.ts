import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { bothOf } from "../../testing/digest-oracle.js";
import { engineSources } from "../../testing/source-corpus.js";

describe("fileDigestOf over code a digest skips the types of", () => {
  it("still reads a file without the word any as the full facts do", () => {
    const text = [
      "import type { A } from './a.js';",
      "export interface Shape<T extends A = A> { size: T; run(input: unknown): void }",
      "export const make = <T,>(value: T): T => (value as unknown as T)!;",
      "export function pick(flag: boolean) { return flag ? 1 : 2; }",
    ].join("\n");

    const both = bothOf("a.ts", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.escapes).toBe(2);
  });

  it("counts every any of a file that has them: escapes, benign ones and those inside an assertion", () => {
    const text = [
      "export const a: any = 1;",
      "export const b = (value as any) as unknown as string[];",
      "export function rest(...args: any[]): void {}",
      "export function bound<T extends any>(value: T): T { return value; }",
      "export type Loose = Record<string, any>;",
      "export const c = <Array<any>>[];",
    ].join("\n");

    const both = bothOf("a.ts", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.any).toBe(6);
  });

  it("reads code that sits inside a type position: a default value, a computed key and a heritage call", () => {
    const text = [
      "export type Callback = (cb?: () => number, flag = require('./x.js')) => void;",
      "export interface Keyed { [require('./key.js')]: number }",
      "export interface Child extends mixin() {}",
      "it.only('inside', () => { if (true) { return 1; } });",
    ].join("\n");

    const both = bothOf("a.ts", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest).toMatchObject({ commonjs: true, focusedTests: 1 });
  });

  it("reads decorators and annotations of an identifier", () => {
    const text = [
      "class Service {",
      "  constructor(@inject(token(() => { if (a) { return 1; } })) readonly dep: any) {}",
      "}",
    ].join("\n");

    const both = bothOf("a.ts", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.functions).toBeGreaterThan(1);
  });
});

layer(NodeServices.layer)(
  "fileDigestOf over the engine's own sources",
  (corpus) => {
    corpus.effect(
      "agrees with the full facts of every file on everything they share",
      () =>
        Effect.gen(function* () {
          const sources = yield* engineSources;

          assert.isAbove(sources.length, 100);
          for (const { path, text } of sources) {
            const both = bothOf(path, text);
            expect(both?.digest, path).toStrictEqual(both?.facts);
          }
        }),
    );
  },
);

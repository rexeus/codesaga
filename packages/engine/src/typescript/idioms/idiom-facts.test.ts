import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const idioms = (text: string, path = "a.ts") => factsOfText(path, text).idioms;

describe("idiom facts: types", () => {
  it("counts interfaces against object type aliases and ignores other aliases", () => {
    const facts = idioms(
      "interface A {}\ninterface B { x: 1 }\ntype C = { y: 2 };\ntype D = string | number;\ndeclare interface E {}\n",
    );

    expect(facts).toMatchObject({ interfaces: 3, objectTypes: 1 });
  });

  it("counts enums against string-literal unions, and not ambient enums or other unions", () => {
    const facts = idioms(
      'enum A { X }\nconst enum B { Y }\ndeclare enum C { Z }\ntype D = "a" | "b";\ntype E = "a" | 1;\ntype F = "a";\n',
    );

    expect(facts).toMatchObject({ enums: 2, stringUnions: 1 });
  });

  it("counts a runtime namespace, a parameter property and a decorator as syntax Node cannot strip", () => {
    const facts = idioms(
      [
        "namespace Runtime { export const x = 1; }",
        "namespace Types { export interface I {} }",
        "declare namespace Ambient { const y: number; }",
        "class A { constructor(private a: number, readonly b: string, c: number) {} }",
        "@sealed class B {}",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      namespaces: 1,
      parameterProperties: 2,
      decorators: 1,
    });
  });
});

describe("idiom facts: declarations and exports", () => {
  it("counts top-level classes, functions and arrow constants, exported or not, and not nested ones", () => {
    const facts = idioms(
      [
        "class A {}",
        "export class B {}",
        "export default class {}",
        "function f() { function nested() {} class Inner {} }",
        "export function g() {}",
        "const h = () => 1;",
        "export const i = function () {}, j = 2;",
        "let k = () => 1;",
        "const l = { m: () => 1 };",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      classes: 3,
      functions: 2,
      arrowConsts: 2,
    });
  });

  it("counts default exports against named exports by name", () => {
    const facts = idioms(
      [
        "export default function () {}",
        "export const a = 1, b = 2;",
        "export function c() {}",
        "const d = 1, e = 2;",
        "export { d, e as default };",
        "export type T = string;",
        'export * from "x";',
      ].join("\n"),
    );

    expect(facts).toMatchObject({ defaultExports: 2, namedExports: 5 });
  });

  it("does not count the exports of a namespace as exports of the module", () => {
    const facts = idioms(
      [
        "export namespace N { export const a = 1; export function b() {} }",
        "export const c = 1;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({ namedExports: 2, defaultExports: 0 });
  });

  it("counts const, let and var declarations", () => {
    const facts = idioms(
      "const a = 1, b = 2;\nlet c;\nvar d, e;\nfor (let i = 0; ; ) {}\n",
    );

    expect(facts).toMatchObject({ consts: 1, lets: 2, vars: 1 });
  });

  it("counts #private members against private modifiers, parameter properties included", () => {
    const facts = idioms(
      "class A { #a = 1; #m() {} private b = 2; private n() {} public c = 3; constructor(private d: number) {} }",
    );

    expect(facts).toMatchObject({ hashPrivate: 2, privateModifiers: 3 });
  });
});

describe("idiom facts: expressions", () => {
  it("counts await against then chains", () => {
    const facts = idioms(
      "async function f() { await a(); await b; return c().then(d).then(e); }",
    );

    expect(facts).toMatchObject({ awaits: 2, thenCalls: 2 });
  });

  it("counts for...of against forEach", () => {
    const facts = idioms(
      "for (const a of xs) {}\nfor (const b in o) {}\nxs.forEach(f);\nfor (let i = 0; i < 1; i++) {}\n",
    );

    expect(facts).toMatchObject({ forOf: 1, forEachCalls: 1 });
  });

  it("counts mutating calls against transforming calls and spreads, by method name", () => {
    const facts = idioms(
      [
        "xs.push(1); xs.sort(); xs.splice(0, 1);",
        "const a = xs.map(f).filter(g);",
        "const b = [...xs, 1]; const c = { ...o, k: 1 };",
        "push(1); xs[0] = 2;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({
      mutationCalls: 3,
      transformCalls: 2,
      spreads: 2,
    });
  });

  it("leaves out calls on a PascalCase namespace, a string or a template, and the string-ambiguous slice and concat", () => {
    const facts = idioms(
      [
        "const a = Effect.map(f); const b = Arr.filter(g); const c = Array.from(h);",
        'const d = "a-b".toSorted(); const e = `x`.fill(1);',
        "const f2 = xs.slice(1).concat(ys);",
        "const g2 = this.items.map(m); const h2 = effect.map(m); xs.push(1);",
      ].join("\n"),
    );

    expect(facts).toMatchObject({ transformCalls: 2, mutationCalls: 1 });
  });

  it("counts optional chains once each and nullish coalescing, assignment included", () => {
    const facts = idioms("a?.b?.c; a?.[0]; x ?? y; z ??= 1; p || q;");

    expect(facts).toMatchObject({ optionalChains: 2, nullishCoalescing: 2 });
  });
});

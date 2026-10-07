import { describe, expect, it } from "vitest";

import { bothOf } from "../../testing/digest-oracle.js";
import { oxcParse } from "../../testing/oxc-parser.js";
import { walk } from "../walk.js";
import { kindOf } from "./type-nodes.js";

/** One of nearly every type construct, and none of the word the type-safety facts count. */
const TYPE_FEATURES = [
  "import type { Dep } from './dep.js';",
  "type Keys<T> = keyof T;",
  "type Pick2<T, K extends keyof T> = { [P in K]: T[P] };",
  "type Cond<T> = T extends string ? 'text' : T extends number ? 1 : never;",
  "type Inferred<T> = T extends Promise<infer U> ? U : T;",
  "type Tuple = [first: string, second?: number, ...rest: boolean[]];",
  "type Template = `prefix-${string}`;",
  "type Fn = new (a: string) => Dep;",
  "type Q = typeof import('./dep.js');",
  "type Guard = (x: unknown) => x is string;",
  "type Assert = (x: unknown) => asserts x;",
  "type Sym = unique symbol;",
  "type Lit = -1 | 'a' | true | null | undefined | void | bigint | object | symbol | never;",
  "interface Base { readonly id: number; name?: string; method<T>(input: T): T; new (x: number): Base; (call: string): void; [key: string]: unknown }",
  "interface Derived extends Base, Dep {}",
  "abstract class Impl<T> implements Base { abstract run(): T; declare field: string; }",
  "declare function overload(a: string): void;",
  "export function make<T extends object = {}>(value: T, ...rest: T[]): T { return value; }",
  "export const wrapped = (<T,>(value: T) => value)<string>;",
  "export const value = { a: 1 } satisfies Record<string, number>;",
  "export function walkTree(depth: number): number { if (depth > 0) { return walkTree(depth - 1); } return 0; }",
].join("\n");

/** The same constructs where the type-safety collector has to count them. */
const ANY_FEATURES = [
  "type Loose = Record<string, any>;",
  "type Fnany = (...args: any[]) => any;",
  "type Constrained<T extends any> = T;",
  "type Mapped = { [K in keyof Dep]: any };",
  "type Arrays = Array<any> | any[] | readonly any[] | Promise<any>;",
  "type Cond<T> = T extends any ? 1 : 2;",
  "interface Holder { field: any; method(a: any): any; [key: string]: any }",
  "abstract class Boxed<T = any> { abstract get(): any; set(value: any): void {} }",
  "export function rest(first: any, ...others: any[]): any { return first; }",
  "export const asAny = value as any;",
  "export const viaAny = value as any as string;",
  "export const viaUnknown = value as unknown as any;",
  "export const angle = <any>value;",
  "export const nested = (value as Array<any>).length;",
  "export const call = convert<any>(value);",
  "export const optional: any = value!;",
  "// @ts-expect-error because any",
].join("\n");

const kindsOf = (text: string): Set<string> => {
  const types = new Set<string>();
  walk(oxcParse("a.ts", text, { lang: "ts", sourceType: "module" }).program, {
    enter: (node) => {
      if (kindOf(node) === "type") {
        types.add(node.type);
      }
    },
  });
  return types;
};

describe("fileDigestOf over every kind of type syntax", () => {
  it("reads the same as the full facts in a file with many type features and no any", () => {
    const both = bothOf("types.ts", TYPE_FEATURES);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest).toMatchObject({ any: 0, functions: 3 });
  });

  it("uses the construct families the skips are made for", () => {
    const types = kindsOf(TYPE_FEATURES);

    for (const expected of [
      "TSConditionalType",
      "TSInferType",
      "TSMappedType",
      "TSTemplateLiteralType",
      "TSTupleType",
      "TSTypePredicate",
      "TSTypeQuery",
      "TSInterfaceDeclaration",
      "TSConstructorType",
      "TSIndexSignature",
      "TSMethodSignature",
      "TSTypeParameter",
    ]) {
      expect(types, expected).toContain(expected);
    }
  });

  it("reads the same as the full facts for every any, benign or an escape, in type arguments, assertions, rest parameters and constraints", () => {
    const both = bothOf("loose.ts", `${TYPE_FEATURES}\n${ANY_FEATURES}`);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.any).toBeGreaterThanOrEqual(20);
    expect(both?.digest.suppressions).toBe(1);
  });

  it("reads the same as the full facts in TSX with any in props, hooks and elements", () => {
    const text = [
      "import type { ReactNode } from 'react';",
      "type Props<T = any> = { children?: ReactNode; render: (item: any) => ReactNode; items: T[] };",
      "export function List<T extends any>({ items, render }: Props<T>) {",
      "  const ref = useRef<any>(null);",
      "  const handler = (event: any) => { if (event.key) { return (event.target as any).value; } };",
      "  return <ul ref={ref}>{items.map((item, index) => <li key={index} onClick={handler}>{render(item as any)}</li>)}</ul>;",
      "}",
    ].join("\n");

    const both = bothOf("list.tsx", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.any).toBe(7);
  });

  it("reads the same as the full facts with any beside decorators", () => {
    const text = [
      "@Component({ selector: 'app' })",
      "export class Widget {",
      "  @Input() value: any;",
      "  @Output() changed = new EventEmitter<any>();",
      "  constructor(@Inject(TOKEN) private readonly dep: any, @Optional() other?: Dep) {}",
      "  @HostListener('click', ['$event']) onClick(event: any): any { if (event) { return event as any; } }",
      "}",
    ].join("\n");

    const both = bothOf("widget.ts", text);

    expect(both?.digest).toStrictEqual(both?.facts);
    expect(both?.digest.any).toBe(6);
  });
});

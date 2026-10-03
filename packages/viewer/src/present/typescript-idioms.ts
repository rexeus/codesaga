import { formatShareExact } from "./code-stats.js";
import { formatCount, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Idioms = NonNullable<TypeScriptDeepDive["idioms"]>;

/** One way of writing something, with its share of the pair or trio. */
type IdiomSide = {
  readonly label: string;
  readonly count: number;
  readonly figure: string;
  readonly share: string;
  readonly entity: string;
};

/** Ways of writing the same thing, drawn as one 100% bar. */
export type IdiomRow = {
  readonly title: string;
  readonly sides: readonly IdiomSide[];
};

const ENTITIES = ["slot-1", "slot-2", "slot-3"] as const;

const row = (
  title: string,
  sides: readonly (readonly [string, number])[],
): IdiomRow => {
  const total = sides.reduce((sum, [, count]) => sum + count, 0);
  return {
    title,
    sides: sides.map(([label, count], index) => ({
      label,
      count,
      figure: formatCount(count),
      share: formatShareExact(count, total),
      entity: ENTITIES[index] ?? "slot-other",
    })),
  };
};

/**
 * The paired counts of the production code as bars of shares. A pair with no
 * occurrence on either side has nothing to compare and is left out. The sides
 * keep their color from row to row only by position: the report says no side
 * is better.
 */
export const idiomRows = ({
  declarations,
  enums,
  topLevel,
  async,
  privacy,
  exports,
  bindings,
  iteration,
  mutation,
  nullish,
}: Idioms): IdiomRow[] =>
  [
    row("Object shapes", [
      ["interface", declarations.interfaces],
      ["type alias", declarations.objectTypes],
    ]),
    row("Enumerations", [
      ["enum", enums.enums],
      ["string union", enums.stringUnions],
    ]),
    row("Top-level declarations", [
      ["class", topLevel.classes],
      ["function", topLevel.functions],
      ["arrow const", topLevel.arrowConsts],
    ]),
    row("Async code", [
      ["await", async.awaits],
      [".then()", async.thenCalls],
    ]),
    row("Class privacy", [
      ["#private", privacy.hashPrivate],
      ["private modifier", privacy.privateModifiers],
    ]),
    row("Exports", [
      ["default", exports.defaultExports],
      ["named", exports.namedExports],
    ]),
    row("Bindings", [
      ["const", bindings.consts],
      ["let", bindings.lets],
      ["var", bindings.vars],
    ]),
    row("Iteration", [
      ["for…of", iteration.forOf],
      [".forEach()", iteration.forEachCalls],
    ]),
    row("Arrays and objects", [
      ["mutating calls", mutation.mutationCalls],
      ["returning calls", mutation.transformCalls],
      ["spreads", mutation.spreads],
    ]),
    row("Null handling", [
      ["?.", nullish.optionalChains],
      ["??", nullish.nullishCoalescing],
    ]),
  ].filter(({ sides }) => sides.some(({ count }) => count > 0));

/** What the folded card says before it is opened. */
export const idiomsTeaser = (
  { files }: Idioms,
  rows: readonly IdiomRow[],
): string =>
  `${formatNoun(rows.length, "comparison")} in ${formatNoun(files, "production file")}`;

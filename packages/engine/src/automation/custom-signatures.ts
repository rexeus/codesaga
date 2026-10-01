// Owns turning a team's extra bots and agents into rows of the signature table.
// Classification reads the combined table, so in-house tools report like built-in ones.

import { SIGNATURES } from "./signatures.js";
import type { PersonPattern, Signature } from "./signatures.js";

/** One in-house tool, matched on any of its `emails` or `names`: exact and case-insensitive. */
type CustomSignature = {
  /** Reported as the tool's name. */
  readonly name: string;
  readonly emails?: ReadonlyArray<string>;
  readonly names?: ReadonlyArray<string>;
};

/** Tools that classify as bots and tools that classify as agents. */
export type CustomSignatures = {
  readonly bots?: ReadonlyArray<CustomSignature>;
  readonly agents?: ReadonlyArray<CustomSignature>;
};

const SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/gu;

const exactName = (name: string): RegExp =>
  new RegExp(`^${name.replace(SPECIAL_CHARACTERS, "\\$&")}$`, "iu");

const peopleOf = (custom: CustomSignature): ReadonlyArray<PersonPattern> => [
  ...(custom.emails ?? []).map((email) => ({ email: email.toLowerCase() })),
  ...(custom.names ?? []).map((name) => ({ name: exactName(name) })),
];

const rowsOf = (
  kind: Signature["kind"],
  customs: ReadonlyArray<CustomSignature> = [],
): ReadonlyArray<Signature> =>
  customs.map((custom) => ({
    name: custom.name,
    kind,
    people: peopleOf(custom),
  }));

/**
 * The built-in table followed by the custom rows, agents before bots as in the
 * table itself. A commit takes the first matching row, so a built-in tool
 * keeps its name when a custom row matches the same person.
 */
export const withCustomSignatures = (
  custom: CustomSignatures | undefined,
): ReadonlyArray<Signature> =>
  custom === undefined
    ? SIGNATURES
    : [
        ...SIGNATURES,
        ...rowsOf("agent", custom.agents),
        ...rowsOf("bot", custom.bots),
      ];

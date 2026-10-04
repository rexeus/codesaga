// Owns what a config effectively sets: its own options over the configs it extends, later entries overriding earlier ones.
// A value that an unresolved `extends` may have set is `unknown`, never the default: the report does not guess what it cannot read.

import type { Tri } from "../../report/typescript-strictness.js";
import type { LoadedTsconfig } from "./config-file.js";

/** The parts that `strict` switches together. */
const STRICT_PARTS = [
  "alwaysStrict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "noImplicitThis",
  "useUnknownInCatchVariables",
  "strictBuiltinIteratorReturn",
] as const;

/** An option as the chain resolves it. */
type Found =
  | { readonly kind: "set"; readonly value: unknown }
  | { readonly kind: "unknown" }
  | { readonly kind: "unset" };

const UNSET: Found = { kind: "unset" };
const UNKNOWN: Found = { kind: "unknown" };

/** The option from `config`, else from the latest `extends` entry that sets it; an unresolved entry before that decides nothing knowable. */
const lookup = (config: LoadedTsconfig, key: string): Found => {
  const own: unknown = config.options[key];
  if (own !== undefined && own !== null) {
    return { kind: "set", value: own };
  }
  for (const ref of config.extends.toReversed()) {
    const found = ref.config === undefined ? UNKNOWN : lookup(ref.config, key);
    if (found.kind !== "unset") {
      return found;
    }
  }
  return UNSET;
};

const booleanOf = (found: Found, fallback: Tri): Tri => {
  if (found.kind === "unset") {
    return fallback;
  }
  return found.kind === "set" && typeof found.value === "boolean"
    ? found.value
    : "unknown";
};

const stringOf = (found: Found): string | null =>
  found.kind === "set" && typeof found.value === "string" ? found.value : null;

/**
 * What `key` is set to, a boolean written in the config or in one it extends,
 * or `unknown` where nothing sets it (not a statement that it is off: the
 * default depends on the TypeScript version) or a config that could not be
 * read may. For callers that must not claim a change between a value and
 * the lack of one.
 */
export const explicitFlagOf = (config: LoadedTsconfig, key: string): Tri => {
  const found = lookup(config, key);
  return found.kind === "set" && typeof found.value === "boolean"
    ? found.value
    : "unknown";
};

/** The effective posture of one config. */
export type Posture = {
  readonly strict: Tri;
  /** Parts of `strict` set explicitly to a value other than `strict`'s; the parts set explicitly when `strict` is `unknown`. */
  readonly strictExceptions: ReadonlyArray<string>;
  readonly noUncheckedIndexedAccess: Tri;
  readonly exactOptionalPropertyTypes: Tri;
  readonly noImplicitOverride: Tri;
  readonly verbatimModuleSyntax: Tri;
  readonly isolatedModules: Tri;
  readonly allowJs: Tri;
  readonly checkJs: Tri;
  /** As written; null when no readable config sets it. */
  readonly target: string | null;
  readonly module: string | null;
  readonly moduleResolution: string | null;
};

const exceptionsOf = (
  config: LoadedTsconfig,
  strict: Tri,
): ReadonlyArray<string> =>
  STRICT_PARTS.filter((part) => {
    const found = lookup(config, part);
    return (
      found.kind === "set" &&
      typeof found.value === "boolean" &&
      found.value !== strict
    );
  });

/** The effective posture of `config`; `strictByDefault` is what an unset `strict` means for the declared TypeScript. */
export const postureOf = (
  config: LoadedTsconfig,
  strictByDefault: Tri,
): Posture => {
  const strict = booleanOf(lookup(config, "strict"), strictByDefault);
  const flag = (key: string): Tri => booleanOf(lookup(config, key), false);
  return {
    strict,
    strictExceptions: exceptionsOf(config, strict),
    noUncheckedIndexedAccess: flag("noUncheckedIndexedAccess"),
    exactOptionalPropertyTypes: flag("exactOptionalPropertyTypes"),
    noImplicitOverride: flag("noImplicitOverride"),
    verbatimModuleSyntax: flag("verbatimModuleSyntax"),
    isolatedModules: flag("isolatedModules"),
    allowJs: flag("allowJs"),
    checkJs: flag("checkJs"),
    target: stringOf(lookup(config, "target")),
    module: stringOf(lookup(config, "module")),
    moduleResolution: stringOf(lookup(config, "moduleResolution")),
  };
};

/** The resolved configs `config` extends, directly and through each other, base first; each once. */
export const chainOf = (config: LoadedTsconfig): ReadonlyArray<string> => {
  const paths = config.extends.flatMap(({ config: base }) =>
    base === undefined ? [] : [...chainOf(base), base.path],
  );
  return [...new Set(paths)];
};

/** The specifiers in the chain that no file was found for, each once, in the order met. */
export const unresolvedOf = (config: LoadedTsconfig): ReadonlyArray<string> => {
  const specifiers = config.extends.flatMap(({ specifier, config: base }) =>
    base === undefined ? [specifier] : unresolvedOf(base),
  );
  return [...new Set(specifiers)];
};

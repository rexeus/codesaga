// Owns the ecosystem facts a file's syntax shows besides its imports: calls of React hooks.
// A hook is a call of a function named `use` and a capital or digit, or of such a member of `React`; no types are known, so another library's `useX` counts too.

import { identifierName } from "../node-guards.js";
import type { FactsCollector } from "../parsed-source.js";
import { onNodes } from "../walk.js";

/** Ecosystem facts of one file; the counts add up over files. */
export type EcosystemFacts = {
  /** Calls of `useX(...)` and `React.useX(...)`. */
  readonly hookCalls: number;
};

const HOOK_NAME = /^use[A-Z0-9]/u;

/** Counts hook calls over one walk. */
export const ecosystemCollector = (): FactsCollector<EcosystemFacts> => {
  let hookCalls = 0;
  return {
    enter: onNodes({
      CallExpression: ({ callee }) => {
        const name =
          callee.type === "MemberExpression" &&
          !callee.computed &&
          identifierName(callee.object) === "React"
            ? identifierName(callee.property)
            : identifierName(callee);
        hookCalls += name !== undefined && HOOK_NAME.test(name) ? 1 : 0;
      },
    }),
    finish: () => ({ hookCalls }),
  };
};

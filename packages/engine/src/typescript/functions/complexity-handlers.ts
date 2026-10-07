// Owns the increments of cognitive complexity: which syntax adds to the function it sits in, and which syntax deepens the nesting.
// The rules are the SonarSource whitepaper's (v1.7, https://www.sonarsource.com/docs/CognitiveComplexity.pdf); the table below is its Appendix B on ESTree.
// Unlike the whitepaper's total for a method, each function is scored apart, as eslint-plugin-sonarjs reports it.
//
//   +1, and +nesting level, and raises the nesting of its body:
//       `if`, ternary, `switch` (once for all its cases), `for`, `for in`, `for of`, `while`, `do while`, `catch`
//   +1 flat, and raises the nesting of its body: `else if`, `else`
//   +1 per run of like operators: `&&` and `||` sequences (`??` and `?.` add nothing, as the whitepaper does not list them)
//   +1 flat: `break` or `continue` to a label, and a function that calls itself by name, once however often
//   0: a nested function, arrow function or method; it is scored on its own, from nesting 0, and the function around it adds nothing for it
//   0: `try`, `finally`, `return`, `await`, spread
//
// Recursion is only found for a direct call by the function's own name (`f()`, or `this.m()` in a method); indirect cycles are not.

import type { Node } from "@oxc-project/types";

import type { NodeHandlers } from "../walk.js";
import { countStructure } from "./function-frame.js";
import type { Frame } from "./function-frame.js";
import { isCountedOperator, sequenceIncrements } from "./logical-sequences.js";

/** What the handlers need of the walk: the functions around the current node, and a way to deepen a child's nesting. */
export type Scope = {
  /** The functions being walked, outermost first. */
  readonly frames: ReadonlyArray<Frame>;
  /** Deepens the nesting level inside each of the nodes, the bodies a structure nests. */
  readonly raise: (...nodes: ReadonlyArray<Node | null | undefined>) => void;
};

/** The innermost function that `name` names, unless a function between declares a name of its own that hides it. */
const frameNamed = (
  frames: ReadonlyArray<Frame>,
  name: string,
): Frame | undefined => {
  // Most calls name no function around them, and reading what each declares scans its body.
  if (!frames.some(({ bindings }) => bindings.includes(name))) {
    return undefined;
  }
  for (const frame of frames.toReversed()) {
    if (frame.declared().has(name)) {
      return undefined;
    }
    if (frame.bindings.includes(name)) {
      return frame;
    }
  }
  return undefined;
};

/** The innermost function whose own name or member name the callee spells, undefined for any other call. */
const recursiveFrame = (
  frames: ReadonlyArray<Frame>,
  callee: Node,
): Frame | undefined => {
  if (callee.type === "Identifier") {
    return frameNamed(frames, callee.name);
  }
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "ThisExpression" &&
    callee.property.type === "Identifier"
  ) {
    const { name } = callee.property;
    return frames.findLast(({ method }) => method === name);
  }
  return undefined;
};

const currentOf = (scope: Scope): Frame | undefined => scope.frames.at(-1);

/** The handlers of the structures that nest: they add their nesting level, and deepen their bodies. */
const nestingHandlers = (scope: Scope): NodeHandlers => {
  const elseIfs = new WeakSet<Node>();
  /** A structure with a nesting increment, whose bodies are one level deeper. */
  const nest = (...bodies: ReadonlyArray<Node | null>): void => {
    const frame = currentOf(scope);
    if (frame !== undefined) {
      countStructure(frame);
      scope.raise(...bodies);
    }
  };
  const nestBody = ({ body }: { readonly body: Node }): void => {
    nest(body);
  };
  return {
    IfStatement: (node) => {
      const frame = currentOf(scope);
      if (frame === undefined) {
        return;
      }
      if (elseIfs.has(node)) {
        frame.complexity += 1;
      } else {
        countStructure(frame);
      }
      scope.raise(node.consequent);
      const { alternate } = node;
      if (alternate?.type === "IfStatement") {
        elseIfs.add(alternate);
      } else if (alternate !== null) {
        frame.complexity += 1;
        scope.raise(alternate);
      }
    },
    ConditionalExpression: ({ consequent, alternate }) => {
      nest(consequent, alternate);
    },
    SwitchStatement: ({ cases }) => {
      nest(...cases);
    },
    CatchClause: nestBody,
    ForStatement: nestBody,
    ForInStatement: nestBody,
    ForOfStatement: nestBody,
    WhileStatement: nestBody,
    DoWhileStatement: nestBody,
  };
};

/** The handlers of the increments that do not nest: logical sequences, jumps to a label and recursion. */
const flatHandlers = (scope: Scope): NodeHandlers => {
  const sequences = new WeakSet<Node>();
  const jump = ({ label }: { readonly label: Node | null }): void => {
    const frame = currentOf(scope);
    if (frame !== undefined && label !== null) {
      frame.complexity += 1;
    }
  };
  return {
    LogicalExpression: (node) => {
      const frame = currentOf(scope);
      if (
        frame !== undefined &&
        isCountedOperator(node.operator) &&
        !sequences.has(node)
      ) {
        frame.complexity += sequenceIncrements(node, sequences);
      }
    },
    BreakStatement: jump,
    ContinueStatement: jump,
    CallExpression: ({ callee }) => {
      const frame = recursiveFrame(scope.frames, callee);
      if (frame !== undefined) {
        frame.recursive = true;
      }
    },
  };
};

/** The handlers that add to the innermost function; nodes outside any function add nothing. */
export const complexityHandlers = (scope: Scope): NodeHandlers => ({
  ...nestingHandlers(scope),
  ...flatHandlers(scope),
});

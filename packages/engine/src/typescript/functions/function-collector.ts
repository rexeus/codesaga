// Owns collecting the function facts of one file over the shared walk: a frame per function, the increments of cognitive complexity inside it, and the scored units when an outermost function closes.

import type { Node } from "@oxc-project/types";

import type { FactsCollector } from "../parsed-source.js";
import { onNodes } from "../walk.js";
import type { NodeOfType } from "../walk.js";
import { complexityHandlers } from "./complexity-handlers.js";
import { functionFactsOf } from "./function-facts.js";
import type { FunctionFacts, MeasuredFunction } from "./function-facts.js";
import { newFrame } from "./function-frame.js";
import type { Frame } from "./function-frame.js";
import { ANONYMOUS, nameHandlers, shortName } from "./function-names.js";
import type { FunctionNames } from "./function-names.js";
import { COMPLEXITY_LIMIT } from "./function-thresholds.js";
import { lineIndexOf } from "./line-index.js";

/** The syntax that is a function for complexity: its own scope, and a nesting level of its own. */
type FunctionNode =
  | NodeOfType<"FunctionDeclaration">
  | NodeOfType<"ArrowFunctionExpression">
  | NodeOfType<"StaticBlock">;

/** Parameters other than a TypeScript `this`; a destructured parameter is one. */
const parametersOf = (node: FunctionNode): number =>
  node.type === "StaticBlock"
    ? 0
    : node.params.filter(
        (parameter) =>
          !(parameter.type === "Identifier" && parameter.name === "this"),
      ).length;

const frameOf = (
  node: FunctionNode,
  names: FunctionNames,
  parent: Frame | undefined,
): Frame => {
  const named = names.get(node);
  const own = node.type === "StaticBlock" ? undefined : node.id?.name;
  const inherited =
    parent === undefined ? ANONYMOUS : `${parent.name} > ${ANONYMOUS}`;
  return newFrame({
    name: shortName(own ?? named?.name ?? inherited),
    binding: own ?? named?.binding,
    method: named?.method,
    start: named?.start ?? node.start,
    end: node.end,
    parameters: parametersOf(node),
  });
};

const deepen = (frame: Frame | undefined, by: number): void => {
  if (frame !== undefined) {
    frame.nesting += by;
  }
};

/** The functions being walked, and the measures of the outermost ones once they close. */
const functionStack = (names: FunctionNames, text: string) => {
  const lines = lineIndexOf(text);
  const frames: Frame[] = [];
  const measured: MeasuredFunction[] = [];
  /** The measures of a function and of the functions in it, outermost first. */
  const measure = (
    frame: Frame,
    insideHard: boolean,
  ): ReadonlyArray<MeasuredFunction> => [
    {
      name: frame.name,
      line: lines.lineAt(frame.start),
      complexity: frame.complexity,
      lines: lines.nonBlankLines(frame.start, frame.end),
      parameters: frame.parameters,
      depth: frame.depth,
      insideHard,
    },
    ...frame.children.flatMap((child) =>
      measure(child, insideHard || frame.complexity >= COMPLEXITY_LIMIT),
    ),
  ];
  const open = (node: FunctionNode): void => {
    const frame = frameOf(node, names, frames.at(-1));
    frames.at(-1)?.children.push(frame);
    frames.push(frame);
  };
  const close = (): void => {
    const frame = frames.pop();
    if (frame === undefined) {
      return;
    }
    frame.complexity += frame.recursive ? 1 : 0;
    if (frames.length === 0) {
      measured.push(...measure(frame, false));
    }
  };
  return { frames, measured, open, close };
};

/** Counts function facts over one walk: the functions of the file and the cognitive complexity of each. */
export const functionCollector = (
  text: string,
): FactsCollector<FunctionFacts> => {
  const names: FunctionNames = new WeakMap();
  const { frames, measured, open, close } = functionStack(names, text);
  /** The bodies a structure nests: entering one deepens the innermost function, leaving it restores. */
  const raised = new Set<Node>();
  const enter = onNodes({
    ...nameHandlers(names),
    ...complexityHandlers({
      frames,
      raise: (...nodes) => {
        for (const node of nodes) {
          if (node !== null && node !== undefined) {
            raised.add(node);
          }
        }
      },
    }),
    FunctionDeclaration: open,
    FunctionExpression: open,
    ArrowFunctionExpression: open,
    StaticBlock: open,
  });
  const leave = onNodes({
    FunctionDeclaration: close,
    FunctionExpression: close,
    ArrowFunctionExpression: close,
    StaticBlock: close,
  });
  return {
    enter: (node) => {
      if (raised.has(node)) {
        deepen(frames.at(-1), 1);
      }
      enter(node);
    },
    leave: (node) => {
      leave(node);
      if (raised.delete(node)) {
        deepen(frames.at(-1), -1);
      }
    },
    finish: () => functionFactsOf(measured),
  };
};

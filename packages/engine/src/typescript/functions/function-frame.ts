// Owns the bookkeeping of one function while the walk is inside it, and how a finished function turns into scored units.
// A frame counts its own increments apart from the functions inside it, because a nested function's score depends on how deep it sits.

/** One function being walked; the counters are those of its own body, nested functions apart. */
export type Frame = {
  readonly name: string;
  /** The identifier that names the function in its own scope, such as `f` in `function f` and `const f = () => ...`. */
  readonly binding: string | undefined;
  /** The member name that `this.name()` calls inside it mean, for a method. */
  readonly method: string | undefined;
  readonly start: number;
  readonly end: number;
  readonly parameters: number;
  /** The nesting level of the enclosing function at the point this one starts. */
  readonly opened: number;
  readonly children: Frame[];
  /** The current nesting level inside the body. */
  nesting: number;
  /** The increments of the body that do not depend on how deep the function sits. */
  flat: number;
  /** How many of the body's increments are also raised by every level the function sits deeper. */
  nested: number;
  /** The deepest control structure of the body, counting itself: 1 for an `if` at the top. */
  depth: number;
  recursive: boolean;
};

/** Starts the counters of a function. */
export const newFrame = (
  identity: Pick<
    Frame,
    "name" | "binding" | "method" | "start" | "end" | "parameters"
  >,
  parent: Frame | undefined,
): Frame => ({
  ...identity,
  opened: parent?.nesting ?? 0,
  children: [],
  nesting: 0,
  flat: 0,
  nested: 0,
  depth: 0,
  recursive: false,
});

/** Counts a structure that adds its nesting level to its increment: `if`, a ternary, `switch`, a loop or `catch`. */
export const countStructure = (frame: Frame): void => {
  frame.flat += 1 + frame.nesting;
  frame.nested += 1;
  frame.depth = Math.max(frame.depth, frame.nesting + 1);
};

/** A function with its score. */
export type ScoredFrame = {
  readonly frame: Frame;
  readonly complexity: number;
  readonly depth: number;
};

/** The score and depth of a frame and the functions inside it, when the frame sits `offset` levels deep. */
const fold = (
  frame: Frame,
  offset: number,
): { readonly complexity: number; readonly depth: number } => {
  let complexity = frame.flat + frame.nested * offset;
  let depth = frame.depth > 0 ? frame.depth + offset : 0;
  for (const child of frame.children) {
    const inner = fold(child, offset + child.opened + 1);
    complexity += inner.complexity;
    depth = Math.max(depth, inner.depth);
  }
  return { complexity, depth };
};

/** A function with nothing of its own to count that holds other functions. */
const isDeclarative = (frame: Frame): boolean =>
  frame.flat === 0 && frame.children.length > 0;

/**
 * The scored functions of a function that no other contains. A function with
 * complexity of its own is one unit that includes everything inside it. A
 * declarative one, the whitepaper's JavaScript exception, is a unit of 0 and
 * the functions directly inside it are scored the same way from nesting 0.
 */
export const scoredFramesOf = (frame: Frame): ReadonlyArray<ScoredFrame> => {
  if (isDeclarative(frame)) {
    return [
      { frame, complexity: 0, depth: 0 },
      ...frame.children.flatMap(scoredFramesOf),
    ];
  }
  return [{ frame, ...fold(frame, 0) }];
};

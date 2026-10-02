// Owns the bookkeeping of one function while the walk is inside it.
// A function scores from its own body: the structures of the functions nested in it are theirs, and an enclosing function adds no nesting, as eslint-plugin-sonarjs reports each function.

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
  /** The functions nested directly in this one, for the walk to read their scores when the outermost closes. */
  readonly children: Frame[];
  /** The current nesting level inside the body. */
  nesting: number;
  /** The cognitive complexity of the body so far. */
  complexity: number;
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
): Frame => ({
  ...identity,
  children: [],
  nesting: 0,
  complexity: 0,
  depth: 0,
  recursive: false,
});

/** Counts a structure that adds its nesting level to its increment: `if`, a ternary, `switch`, a loop or `catch`. */
export const countStructure = (frame: Frame): void => {
  frame.complexity += 1 + frame.nesting;
  frame.depth = Math.max(frame.depth, frame.nesting + 1);
};

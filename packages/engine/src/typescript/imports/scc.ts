// Owns finding the strongly connected components of a directed graph: the sets of nodes that can all reach each other.
// Tarjan's algorithm, iterative, because a repository's import graph can be deeper than the call stack.

type Frame = {
  readonly node: number;
  /** The position in the node's successors the walk goes on from. */
  next: number;
};

/** The bookkeeping of one run. */
type Run = {
  readonly successors: ReadonlyArray<ReadonlyArray<number>>;
  readonly order: Int32Array;
  readonly low: Int32Array;
  readonly onStack: Uint8Array;
  readonly stack: Array<number>;
  readonly components: Array<ReadonlyArray<number>>;
  visited: number;
};

const enter = (run: Run, node: number): Frame => {
  run.order[node] = run.visited;
  run.low[node] = run.visited;
  run.visited += 1;
  run.stack.push(node);
  run.onStack[node] = 1;
  return { node, next: 0 };
};

const close = (run: Run, node: number): void => {
  if (run.low[node] !== run.order[node]) {
    return;
  }
  const component: Array<number> = [];
  for (let member = run.stack.pop(); member !== undefined;) {
    run.onStack[member] = 0;
    component.push(member);
    if (member === node) {
      break;
    }
    member = run.stack.pop();
  }
  run.components.push(component);
};

/** Walks one step from the frame on top of `frames`: into an unseen successor, or back out of a finished node. */
const step = (run: Run, frames: Array<Frame>, frame: Frame): void => {
  const target = run.successors[frame.node]?.[frame.next];
  if (target === undefined) {
    close(run, frame.node);
    frames.pop();
    const parent = frames.at(-1);
    if (parent !== undefined) {
      run.low[parent.node] = Math.min(
        run.low[parent.node] ?? 0,
        run.low[frame.node] ?? 0,
      );
    }
    return;
  }
  frame.next += 1;
  if (run.order[target] === -1) {
    frames.push(enter(run, target));
  } else if (run.onStack[target] === 1) {
    run.low[frame.node] = Math.min(
      run.low[frame.node] ?? 0,
      run.order[target] ?? 0,
    );
  }
};

/**
 * The strongly connected components of the graph with nodes `0` to
 * `successors.length - 1`, where `successors[n]` lists the nodes `n` points
 * to. Every node is in exactly one component, and a node with no cycle is a
 * component of its own. Components and the nodes in them come in no
 * particular order.
 */
export const stronglyConnected = (
  successors: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<ReadonlyArray<number>> => {
  const count = successors.length;
  const run: Run = {
    successors,
    order: new Int32Array(count).fill(-1),
    low: new Int32Array(count),
    onStack: new Uint8Array(count),
    stack: [],
    components: [],
    visited: 0,
  };
  for (let root = 0; root < count; root += 1) {
    if (run.order[root] === -1) {
      const frames = [enter(run, root)];
      for (let top = frames.at(-1); top !== undefined; top = frames.at(-1)) {
        step(run, frames, top);
      }
    }
  }
  return run.components;
};

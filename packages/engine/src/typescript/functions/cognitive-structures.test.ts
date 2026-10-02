import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

/** The scores of the functions of a source, as `[score, functions]` pairs, ascending. */
const scoresOf = (text: string, path = "a.ts") =>
  factsOfText(path, text).functions.scores;

describe("cognitive complexity: logical operators", () => {
  it("counts each run of like logical operators once, and a change of operator again", () => {
    const scores = scoresOf(`
function f(a, b, c, d, e, g) {
  if (a && b && c || d || e && g) {} // +1 for if, then &&, ||, &&
}
function h(a, b, c) {
  if (a && !(b && c)) {} // +1 for if, +1 for &&, +1 for the negated sequence
}
function i(a, b, c, d) {
  return a || b || c || d;
}
function j(a, b, c) {
  return a && (b && c);
}`);

    expect(scores).toStrictEqual([
      [1, 2],
      [3, 1],
      [4, 1],
    ]);
  });

  it("adds nothing for ?? and ?. and counts the sequence inside a ?? operand", () => {
    const scores = scoresOf(`
function f(a, b) { return a?.b ?? b?.c?.d; }
function g(a, b, c) { return a ?? (b && c); }`);

    expect(scores).toStrictEqual([
      [0, 1],
      [1, 1],
    ]);
  });
});

describe("cognitive complexity: conditions", () => {
  it("nests ternaries in a ternary by their depth", () => {
    const scores = scoresOf(
      "function f(a, b, c) { return a ? 1 : b ? 2 : c ? 3 : 4; } // 1 + 2 + 3",
    );

    expect(scores).toStrictEqual([[6, 1]]);
  });

  it("adds a flat increment for else if and else, and a nesting increment for an if inside", () => {
    const scores = scoresOf(`
function chain(a, b) {
  if (a) {} else if (b) {} else {} // +1 +1 +1
}
function inner(a, b) {
  if (a) {       // +1
    if (b) {} else {} // +2 for the if, +1 for the else
  }
}`);

    expect(scores).toStrictEqual([
      [3, 1],
      [4, 1],
    ]);
  });
});

describe("cognitive complexity: jumps, exceptions and loops", () => {
  it("counts a labelled break, and not an unlabelled one", () => {
    const scores = scoresOf(`
function labelled(xs) {
  outer: for (const x of xs) { // +1
    for (const y of x) {       // +2
      if (y) break outer;      // +3 and +1
    }
  }
}
function plain(xs) {
  for (const x of xs) { // +1
    if (x) break;       // +2
  }
}`);

    expect(scores).toStrictEqual([
      [3, 1],
      [7, 1],
    ]);
  });

  it("ignores try and finally, and counts the structures inside them at their own depth", () => {
    const scores = scoresOf(`
function f() {
  try { if (a) {} }       // +1
  catch (e) { if (b) {} } // +1 for catch, +2 for the if
  finally { if (c) {} }   // +1
}`);

    expect(scores).toStrictEqual([[5, 1]]);
  });

  it("counts every kind of loop, and a switch with an if in a case", () => {
    const scores = scoresOf(`
function loops(xs, o, c) {
  for (const a of xs) {}
  for (const k in o) {}
  while (c) {}
  do {} while (c);
  for (;;) { break; }
}
function select(a, b) {
  switch (a) {   // +1
    case 1:
      if (b) {}  // +2
  }
}`);

    expect(scores).toStrictEqual([
      [3, 1],
      [5, 1],
    ]);
  });

  it("adds nothing for code outside any function", () => {
    expect(scoresOf("if (a && b) {}\nconst x = a ? 1 : 2;\n")).toStrictEqual(
      [],
    );
  });
});

describe("cognitive complexity: nested functions", () => {
  it("scores a nested arrow function on its own, from nesting 0, and not in the function around it", () => {
    const scores = scoresOf(`
function f(xs) {
  if (xs) {                       // +1
    xs.forEach((x) => {
      if (x) {}                   // +1 in the arrow function
    });
  }
}`);

    expect(scores).toStrictEqual([[1, 2]]);
  });
});

describe("cognitive complexity: recursion", () => {
  it("adds one for a function that calls itself by name, however often", () => {
    const scores = scoresOf(`
function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); } // +1 ternary, +1 recursion
function fib(n) {
  if (n < 2) return n;                                      // +1
  return fib(n - 1) + fib(n - 2);                           // +1 once
}
const walk = (node) => { if (node) walk(node.next); };     // +1 if, +1 recursion
class Tree {
  visit(node) { if (node) this.visit(node.left); }          // +1 if, +1 recursion
}`);

    expect(scores).toStrictEqual([[2, 4]]);
  });

  it("does not count a call to another function, a method of another object or an indirect cycle", () => {
    const scores = scoresOf(`
function a() { b(); }
function b() { a(); }
function c(o) { o.c(); }
function d(other) { other.d(); this.d; }`);

    expect(scores).toStrictEqual([[0, 4]]);
  });
});

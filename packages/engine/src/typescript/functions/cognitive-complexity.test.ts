import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

/** The scores of the functions of a source, as `[score, functions]` pairs, ascending. */
const scoresOf = (text: string, path = "a.ts") =>
  factsOfText(path, text).functions.scores;

describe("cognitive complexity: the whitepaper's first examples", () => {
  it("scores a switch once for all its cases (getWords = 1)", () => {
    const scores = scoresOf(`
function getWords(number: number): string {
  switch (number) {
    case 1:
      return "one";
    case 2:
      return "a couple";
    case 3:
      return "a few";
    default:
      return "lots";
  }
}`);

    expect(scores).toStrictEqual([[1, 1]]);
  });

  it("adds the nesting level to nested loops and a labelled continue (sumOfPrimes = 7)", () => {
    const scores = scoresOf(`
function sumOfPrimes(max: number): number {
  let total = 0;
  OUT: for (let i = 1; i <= max; ++i) { // +1
    for (let j = 2; j < i; ++j) {       // +2
      if (i % j === 0) {                // +3
        continue OUT;                   // +1
      }
    }
    total += i;
  }
  return total;
}`);

    expect(scores).toStrictEqual([[7, 1]]);
  });
});

describe("cognitive complexity: the whitepaper's nested examples", () => {
  it("nests a catch and what lies in it, and ignores try (myMethod = 9)", () => {
    const scores = scoresOf(`
function myMethod() {
  try {
    if (condition1) {                 // +1
      for (let i = 0; i < 10; i++) {  // +2
        while (condition2) {}         // +3
      }
    }
  } catch (e) {                       // +1
    if (condition2) {}                // +2
  }
}`);

    expect(scores).toStrictEqual([[9, 1]]);
  });

  it("scores a method of nested ifs and a loop (overriddenSymbolFrom = 19)", () => {
    const scores = scoresOf(`
function overriddenSymbolFrom(classType: ClassType): Method | null {
  if (classType.isUnknown()) {                          // +1
    return unknownMethodSymbol;
  }
  let unknownFound = false;
  const symbols = classType.getSymbol().members().lookup(name);
  for (const overrideSymbol of symbols) {               // +1
    if (overrideSymbol.isKind(MTH)                      // +2
      && !overrideSymbol.isStatic()) {                  // +1
      const methodSymbol = overrideSymbol as Method;
      if (canOverride(methodSymbol)) {                  // +3
        const overriding = checkOverridingParameters(methodSymbol, classType);
        if (overriding == null) {                       // +4
          if (!unknownFound) {                          // +5
            unknownFound = true;
          }
        } else if (overriding) {                        // +1
          return methodSymbol;
        }
      }
    }
  }
  if (unknownFound) {                                   // +1
    return unknownMethodSymbol;
  }
  return null;
}`);

    expect(scores).toStrictEqual([[19, 1]]);
  });
});

describe("cognitive complexity: the whitepaper's JavaScript example", () => {
  it("charges the nested callbacks of a JavaScript method by their depth (model.js save = 20)", () => {
    const scores = scoresOf(
      `
const model = {
  save: function (options, callback) {
    var self = this;
    if (typeof options === 'function') {                // +1
      callback = options;
      options  = {};
    }
    options || (options = {});                          // +1
    self._validate(self.toJSON(), function (err) {
      if (err) {                                        // +2
        callback && callback.call(null, err);           // +1
        return;
      }
      self.sync(self.isNew() ? 'create' : 'update', options, function (err, response) { // +2
        var facade = { options: options, response: response }, parsed;
        if (err) {                                      // +3
          facade.error = err;
        } else {                                        // +1
          if (!self._saveEvent) {                       // +4
            self._saveEvent = self.publish(EVT_SAVE, { preventable: false });
          }
          if (response) {                               // +4
            parsed = facade.parsed = self._parse(response);
            self.setAttrs(parsed, options);
          }
          self.changed = {};
        }
        callback && callback.apply(null, arguments);    // +1
      });
    });
    return self;
  }
};`,
      "model.js",
    );

    expect(scores).toStrictEqual([[20, 1]]);
  });
});

describe("cognitive complexity: JavaScript wrappers", () => {
  it("ignores a function that only declares, so the functions inside start at nesting 0 (total 1)", () => {
    const scores = scoresOf(
      `(function () {
  var foo;
  bar.myFun = function () {
    if (condition) {}
  };
})();`,
      "wrapper.js",
    );

    expect(scores).toStrictEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("scores one function with structure of its own and the nested function one level deeper (total 3)", () => {
    const scores = scoresOf(
      `(function () {
  var foo;
  if (condition) {}
  bar.myFun = function () {
    if (condition) {}
  };
})();`,
      "wrapper.js",
    );

    expect(scores).toStrictEqual([[3, 1]]);
  });

  it("scores the callbacks of a describe block one by one, however deep the describes nest", () => {
    const scores = scoresOf(
      `describe("a", () => {
  describe("b", () => {
    it("c", () => { if (x) {} });
    it("d", () => {});
  });
});`,
      "a.test.ts",
    );

    expect(scores).toStrictEqual([
      [0, 3],
      [1, 1],
    ]);
  });
});

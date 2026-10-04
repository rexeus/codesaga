---
"codesaga": minor
---

The dashboard gains a "Deep dive: TypeScript" section and a nav entry when the report has `deepDives.typescript`. It opens with five figures and the coverage of the analysis, then shows type safety (escape hatches as stacked bars for production code and tests, counterparts, and the compiler strictness per option with the `tsconfig` list), functions (histograms of complexity and length, the hardest functions, complexity and change), and imports (the territory map as a sorted edge list with coupling and instability, mutual imports, edges toward less stable territories, and the file graph with its cycles). Idioms, modules, ecosystem, tests and markers are folded cards that open on demand. A parser that did not load leaves a calm note, and a territory card gains TypeScript lines in its stats band. The histogram of function complexity and length prints the count of every bar.

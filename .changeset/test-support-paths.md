---
"codesaga": patch
---

Count test-support folders as tests. Files in a `testing`, `test-utils`, `test-helpers`, `__mocks__` or `__fixtures__` directory now belong to the test share, the tests side of the TypeScript deep dive (escape hatches, complexity, trends) and the `well-tested` and `tester` badges instead of production, and no longer show up as a production territory in the import map. The numbers of repositories with such folders change; plain `fixtures/` and `mocks/` folders stay production.

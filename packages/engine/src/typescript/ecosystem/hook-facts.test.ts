import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

describe("ecosystem facts", () => {
  it("counts calls of hooks, plain and through React, and not other names", () => {
    const facts = factsOfText(
      "a.tsx",
      [
        "const [a] = useState(0);",
        "const b = React.useMemo(f, []);",
        "const c = useEffect2();",
        "user(); used(); use(); Foo.useBar(); useless();",
        "const d = <p>{useCallback(f)}</p>;",
      ].join("\n"),
    ).ecosystem;

    expect(facts).toStrictEqual({ hookCalls: 4 });
  });
});

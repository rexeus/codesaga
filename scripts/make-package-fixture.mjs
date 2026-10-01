// The repository the package check analyzes with the packed CLI.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Creates a tiny repository with three commits by one author.
 * @param {string} root directory to create
 */
export const makeRepository = (root) => {
  mkdirSync(root);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  /** @param {string[]} args */
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { env, stdio: "ignore" });
  git("init", "--quiet");
  for (const round of [1, 2, 3]) {
    writeFileSync(join(root, "a.ts"), `run(${round});\n`);
    git("add", "--all");
    git(
      "-c",
      "user.name=Pack",
      "-c",
      "user.email=pack@example.invalid",
      "commit",
      "--quiet",
      "-m",
      `round ${round}`,
    );
  }
  return root;
};

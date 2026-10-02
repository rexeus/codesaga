// Proves the packed `codesaga` package works the way `npx codesaga` will run it:
// one bundled file with `oxc-parser` as its one runtime dependency, installable
// with npm and pnpm, and able to analyze and inspect a real git repository, with
// `--json` documents that decode with the engine's schemas and a TypeScript deep
// dive that parsed files, to list its MCP tools over `codesaga mcp`, and to
// degrade to a coverage note when the parser's native binding is gone.
// Run after `pnpm --filter codesaga build`.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { makeRepository } from "./make-package-fixture.mjs";
import { mcpToolsList } from "./mcp-tools-list.mjs";
import { expectBundledArtifact } from "./packed-artifact.mjs";
import { removeParserBindings, valueAt } from "./parser-dependency.mjs";

const repository = resolve(import.meta.dirname, "..");

/**
 * Reads one field of a JSON object without trusting its shape.
 * @param {string} json
 * @param {string} field
 * @returns {unknown}
 */
const fieldOf = (json, field) => {
  /** @type {unknown} */
  const value = JSON.parse(json);
  return typeof value === "object" && value !== null && field in value
    ? Object.getOwnPropertyDescriptor(value, field)?.value
    : undefined;
};

const expectedVersion = fieldOf(
  readFileSync(join(repository, "apps/cli/package.json"), "utf8"),
  "version",
);
if (typeof expectedVersion !== "string") {
  throw new TypeError("apps/cli/package.json does not declare a version.");
}
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const binName = process.platform === "win32" ? "codesaga.cmd" : "codesaga";
const decoder = join(repository, "scripts", "decode-cli-json.ts");
const temporary = mkdtempSync(join(tmpdir(), "codesaga-package-"));

/**
 * @param {string} command
 * @param {ReadonlyArray<string>} args
 * @param {string} [cwd]
 */
const run = (command, args, cwd = repository) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

/** Packs the CLI and returns the tarball path. */
const pack = () => {
  const destination = join(temporary, "pack");
  mkdirSync(destination);
  run(pnpm, [
    "--filter",
    "codesaga",
    "pack",
    "--pack-destination",
    destination,
  ]);
  const tarballs = readdirSync(destination).filter((name) =>
    name.endsWith(".tgz"),
  );
  if (tarballs.length !== 1 || tarballs[0] === undefined) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}.`);
  }
  return join(destination, tarballs[0]);
};

/**
 * Runs a packed command with `--json` and decodes its output with the engine
 * schema from the workspace source, which the bundle itself does not ship.
 * @param {string} bin
 * @param {"analyze" | "inspect"} command
 * @param {string} repositoryRoot
 * @param {string} installer
 * @returns {string} the document
 */
const decodedJson = (bin, command, repositoryRoot, installer) => {
  const args = command === "inspect" ? [command, "a.ts"] : [command];
  const output = spawnSync(bin, [...args, "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const decoded = spawnSync(
    pnpm,
    ["--filter", "codesaga", "exec", "tsx", decoder, command],
    { input: output.stdout, encoding: "utf8" },
  );
  if (output.status !== 0 || decoded.status !== 0) {
    throw new Error(
      `codesaga ${command} --json from ${installer} is not a valid document:\n${output.stdout}${output.stderr}${decoded.stderr}`,
    );
  }
  return output.stdout;
};

/**
 * @param {string} applicationRoot
 * @param {string} installer
 * @param {string} repositoryRoot
 */
const expectWorkingInstall = async (
  applicationRoot,
  installer,
  repositoryRoot,
) => {
  const bin = join(applicationRoot, "node_modules", ".bin", binName);
  if (!existsSync(bin)) {
    throw new Error(
      `The package installed with ${installer} exposes no codesaga executable.`,
    );
  }
  const version = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (version.stdout.trim() !== `codesaga v${expectedVersion}`) {
    throw new Error(
      `codesaga from ${installer} reports:\n${version.stdout}${version.stderr}`,
    );
  }
  const analysis = decodedJson(bin, "analyze", repositoryRoot, installer);
  const contributors = fieldOf(analysis, "contributors");
  if (!Array.isArray(contributors) || contributors.length !== 1) {
    throw new Error(
      `codesaga from ${installer} did not analyze the repository.`,
    );
  }
  const parsed = valueAt(
    analysis,
    "deepDives",
    "typescript",
    "coverage",
    "parsed",
  );
  if (typeof parsed !== "number" || parsed < 1) {
    throw new Error(
      `codesaga from ${installer} parsed no TypeScript file: ${analysis}`,
    );
  }
  decodedJson(bin, "inspect", repositoryRoot, installer);
  const served = await mcpToolsList(bin, repositoryRoot);
  for (const tool of ["analyze", "inspect", "check"]) {
    if (!served.includes(`"name":"${tool}"`)) {
      throw new Error(
        `codesaga mcp from ${installer} does not list the ${tool} tool:\n${served}`,
      );
    }
  }
};

/**
 * @param {string} applicationRoot
 * @param {string} installer
 */
const expectNoEffect = (applicationRoot, installer) => {
  if (existsSync(join(applicationRoot, "node_modules", "effect"))) {
    throw new Error(
      `${installer} installed effect; the bundle must not need it.`,
    );
  }
};

/**
 * Without the native binding the run still succeeds, and the deep dive says
 * why it has no parser. Destroys the installation, so it runs last.
 * @param {string} applicationRoot
 * @param {string} installer
 * @param {string} repositoryRoot
 */
const expectDegradedWithoutBinding = (
  applicationRoot,
  installer,
  repositoryRoot,
) => {
  removeParserBindings(join(applicationRoot, "node_modules"));
  const bin = join(applicationRoot, "node_modules", ".bin", binName);
  const analysis = decodedJson(
    bin,
    "analyze",
    repositoryRoot,
    `${installer} without the binding`,
  );
  const coverage = ["deepDives", "typescript", "coverage"];
  const unavailable = valueAt(analysis, ...coverage, "unavailable");
  const parsed = valueAt(analysis, ...coverage, "parsed");
  if (typeof unavailable !== "string" || unavailable === "" || parsed !== 0) {
    throw new Error(
      `Without its binding the parser should be unavailable and parse nothing: ${analysis}`,
    );
  }
};

try {
  const tarball = pack();
  expectBundledArtifact(tarball, repository);
  const repositoryRoot = makeRepository(join(temporary, "repository"));

  const pnpmApplication = join(temporary, "application-pnpm");
  mkdirSync(pnpmApplication);
  writeFileSync(
    join(pnpmApplication, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(pnpm, ["add", "--ignore-scripts", tarball], pnpmApplication);
  await expectWorkingInstall(pnpmApplication, "pnpm", repositoryRoot);
  expectNoEffect(pnpmApplication, "pnpm");
  expectDegradedWithoutBinding(pnpmApplication, "pnpm", repositoryRoot);

  // npm (and therefore npx) resolves dependencies differently from pnpm.
  const npmApplication = join(temporary, "application-npm");
  mkdirSync(npmApplication);
  writeFileSync(
    join(npmApplication, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    npmApplication,
  );
  expectNoEffect(npmApplication, "npm");
  await expectWorkingInstall(npmApplication, "npm", repositoryRoot);
  expectDegradedWithoutBinding(npmApplication, "npm", repositoryRoot);

  console.log(
    `Package verified: codesaga v${expectedVersion} installs and runs with pnpm and npm, and without oxc-parser's binding it degrades.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

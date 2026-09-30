// Proves the packed `codesaga` package works the way `npx codesaga` will run it:
// one bundled file, no runtime dependencies, and installable with npm and pnpm
// with a working executable. Run after `pnpm --filter codesaga build`.
import { execFileSync, spawnSync } from "node:child_process";
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

/** @param {string} tarball */
const expectBundledArtifact = (tarball) => {
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  const files = listing.trim().split("\n").toSorted();
  const expected = new Set([
    "package/dist/codesaga.js",
    "package/package.json",
  ]);
  const unexpected = files.filter(
    (file) =>
      !expected.has(file) &&
      !/^package\/(README|LICENSE|CHANGELOG)/u.test(file),
  );
  const required = [
    "package/dist/codesaga.js",
    "package/LICENSE",
    "package/README.md",
  ];
  if (required.some((file) => !files.includes(file)) || unexpected.length > 0) {
    throw new Error(`Unexpected package contents:\n${files.join("\n")}`);
  }
  // npm resolves relative links against the package directory, where the
  // repository's docs do not exist; the packed README must link absolutely.
  const packedReadme = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/README.md"],
    { encoding: "utf8" },
  );
  const relativeLinks = packedReadme.match(
    /\]\((?!https?:|#|mailto:)[^)\s]+\)/gu,
  );
  if (relativeLinks !== null) {
    throw new Error(
      `The packed README has relative links: ${relativeLinks.join(", ")}`,
    );
  }
  // The build copies the repository LICENSE into apps/cli; the packed copy must match it.
  const packedLicense = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/LICENSE"],
    { encoding: "utf8" },
  );
  if (packedLicense !== readFileSync(join(repository, "LICENSE"), "utf8")) {
    throw new Error("The packed LICENSE differs from the repository LICENSE.");
  }
  const packed = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/package.json"],
    { encoding: "utf8" },
  );
  if (fieldOf(packed, "dependencies") !== undefined) {
    throw new Error(
      "The packed manifest declares runtime dependencies; the CLI must stay bundled.",
    );
  }
};

/**
 * @param {string} applicationRoot
 * @param {string} installer
 */
const expectWorkingInstall = (applicationRoot, installer) => {
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
};

try {
  const tarball = pack();
  expectBundledArtifact(tarball);

  const pnpmApplication = join(temporary, "application-pnpm");
  mkdirSync(pnpmApplication);
  writeFileSync(
    join(pnpmApplication, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(pnpm, ["add", "--ignore-scripts", tarball], pnpmApplication);
  expectWorkingInstall(pnpmApplication, "pnpm");

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
  if (existsSync(join(npmApplication, "node_modules", "effect"))) {
    throw new Error("npm installed effect; the bundle must not need it.");
  }
  expectWorkingInstall(npmApplication, "npm");

  console.log(
    `Package verified: codesaga v${expectedVersion} installs and runs with pnpm and npm.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

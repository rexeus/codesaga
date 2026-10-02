// What the packed `codesaga` tarball may contain.
import { execFileSync } from "node:child_process";

import { expectPackedLegalFiles } from "./packed-legal-files.mjs";
import { pinnedParserVersion, valueAt } from "./parser-dependency.mjs";

/**
 * Checks what the tarball ships: the bundle, the legal files, absolute README
 * links, and a manifest whose only dependency is the pinned `oxc-parser`.
 * @param {string} tarball
 * @param {string} repository the workspace root
 */
export const expectBundledArtifact = (tarball, repository) => {
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  const files = listing.trim().split("\n").toSorted();
  const expected = new Set([
    "package/dist/codesaga.js",
    "package/package.json",
    "package/THIRD_PARTY_NOTICES.md",
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
    "package/THIRD_PARTY_NOTICES.md",
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
  expectPackedLegalFiles(tarball, repository);
  const packed = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/package.json"],
    { encoding: "utf8" },
  );
  const dependencies = JSON.stringify(valueAt(packed, "dependencies"));
  const expectedDependencies = JSON.stringify({
    "oxc-parser": pinnedParserVersion(repository),
  });
  if (dependencies !== expectedDependencies) {
    throw new Error(
      `The packed manifest's dependencies are ${dependencies}, not exactly ${expectedDependencies}; the CLI is bundled apart from its native parser.`,
    );
  }
  if (valueAt(packed, "engines", "node") !== ">=22.12") {
    throw new Error("The packed manifest must require Node >=22.12.");
  }
};

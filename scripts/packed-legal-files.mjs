// Checks the legal files of the packed CLI package; used by check-cli-package.mjs.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The text of one file of the packed package.
 * @param {string} tarball
 * @param {string} file
 */
const packedText = (tarball, file) =>
  execFileSync("tar", ["-xOzf", tarball, `package/${file}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

/**
 * The build copies the repository LICENSE and the third-party notices (the
 * bundled dashboard carries Lucide icons) into apps/cli; the packed copies must
 * match them, and the dashboard script inside the bundle must open with
 * Lucide's license.
 * @param {string} tarball
 * @param {string} repository the repository root
 */
export const expectPackedLegalFiles = (tarball, repository) => {
  for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    if (
      packedText(tarball, file) !== readFileSync(join(repository, file), "utf8")
    ) {
      throw new Error(
        `The packed ${file} differs from the repository ${file}.`,
      );
    }
  }
  const bundle = packedText(tarball, "dist/codesaga.js");
  // the ISC notice for Lucide and the MIT notice for the icons from Feather
  for (const holder of ["Lucide Icons and Contributors", "Cole Bemis"]) {
    if (!bundle.includes(holder)) {
      throw new Error(
        `The bundled dashboard lost the license notice of ${holder}.`,
      );
    }
  }
};

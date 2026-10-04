// Owns the few path operations the tsconfig reader needs on repository-relative POSIX paths.
// "" is the repository root, so joining onto it adds nothing.

/** The directory of a repository-relative file path; "" for a file at the root. */
export const directoryOf = (path: string): string =>
  path.slice(0, Math.max(0, path.lastIndexOf("/")));

/**
 * `relative` below `base`, with `.` and `..` segments resolved. A path that
 * climbs above the root keeps its leading `..` segments, so it matches no
 * repository file.
 */
export const joinPosix = (base: string, relative: string): string => {
  const segments: Array<string> = [];
  for (const segment of `${base}/${relative}`.split("/")) {
    if (segment === ".." && segments.length > 0 && segments.at(-1) !== "..") {
      segments.pop();
    } else if (segment !== "." && segment !== "") {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

/** How many directories deep a repository-relative directory is; 0 for the root. */
export const depthOf = (directory: string): number =>
  directory === "" ? 0 : directory.split("/").length;

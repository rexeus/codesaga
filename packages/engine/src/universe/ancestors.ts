// Owns the directory chain of a repository-relative path.

/** The directories that contain `path`, outermost first; empty for a root-level file. */
export const ancestorsOf = (path: string): ReadonlyArray<string> => {
  const parts = path.split("/").slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
};

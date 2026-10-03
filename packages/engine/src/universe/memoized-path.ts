// Owns remembering a path predicate's answers, for callers that ask about the same paths over and over.
// The glob matchers behind the path kinds cost a regular expression per call; a replay of a long history asks about each path once per change.

/** `predicate` with its answers kept by path. It must be a pure function of the path. */
export const memoizedByPath = (
  predicate: (path: string) => boolean,
): ((path: string) => boolean) => {
  const answers = new Map<string, boolean>();
  return (path) => {
    const known = answers.get(path);
    if (known !== undefined) {
      return known;
    }
    const answer = predicate(path);
    answers.set(path, answer);
    return answer;
  };
};

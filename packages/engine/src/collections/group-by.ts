// Owns grouping a list by a key into a Map, which the ES2023 library of this workspace lacks.
// A Map, not an object: keys such as paths and account names can be "constructor" or "__proto__".

/** The items per key, in first-seen key order and in input order within a key. */
export const groupBy = <A, K>(
  items: Iterable<A>,
  keyOf: (item: A) => K,
): ReadonlyMap<K, ReadonlyArray<A>> => {
  const groups = new Map<K, Array<A>>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
};

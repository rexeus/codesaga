// Owns the truck factor of Avelino et al., ICPC 2016 (arXiv 1604.06766): greedy removal of the most needed person.
// Generic over the person type, compared by identity, so it stays pure arithmetic over sets.

import { Order } from "effect";

/**
 * The people whose departure leaves more than half of the files without an
 * expert, in removal order. Each step removes the person who is expert on the
 * most files; `tieBreak` orders equals. `fileExperts` lists the experts of
 * each file. Its length is the truck factor: 0 when already more than half
 * of the files have no expert, and exactly half uncovered is not enough.
 */
export const removalOrder = <P>(
  fileExperts: ReadonlyArray<ReadonlyArray<P>>,
  tieBreak: Order.Order<P>,
): ReadonlyArray<P> => {
  const removed: Array<P> = [];
  while (fileExperts.length > 0) {
    const remaining = fileExperts.map((experts) =>
      experts.filter((person) => !removed.includes(person)),
    );
    const uncovered = remaining.filter((experts) => experts.length === 0);
    if (uncovered.length * 2 > fileExperts.length) {
      break;
    }
    const filesOf = new Map<P, number>();
    for (const person of remaining.flat()) {
      filesOf.set(person, (filesOf.get(person) ?? 0) + 1);
    }
    const [next] = [...filesOf.keys()].toSorted(
      Order.combine(
        Order.flip(
          Order.mapInput(Order.Number, (person: P) => filesOf.get(person) ?? 0),
        ),
        tieBreak,
      ),
    );
    if (next === undefined) {
      break;
    }
    removed.push(next);
  }
  return removed;
};

// Owns describing the knowledge over a set of files: directory, inspected path set or the repository.
// Who is expert on what, who must leave for the set to lose its experts, and whether it is an island or orphaned.

import { Order } from "effect";

import { lineOwnersOf } from "../blame/line-owners.js";
import type { LineOwners } from "../blame/line-owners.js";
import { groupBy } from "../collections/group-by.js";
import { roundReported } from "../report/precision.js";
import type { Report } from "../report/report.js";
import type { Human } from "./contributions.js";
import { isActive, personOf } from "./model.js";
import type { KnowledgeModel, Person } from "./model.js";
import { removalOrder } from "./truck-factor.js";

/** A directory is a knowledge island when one person is the sole expert on at least this share of its files. */
export const ISLAND_SHARE = 0.8;
/** A directory is orphaned when more than this share of its files have no active expert. */
export const ORPHANED_SHARE = 0.5;

const MAX_EXPERTS = 5;

type Expert = Report["knowledge"]["directories"][number]["experts"][number];

/** The knowledge state of a set of files. */
export type FileSetKnowledge = {
  readonly files: number;
  readonly withoutExpert: number;
  readonly withoutActiveExpert: number;
  /** The people whose departure leaves more than half of the files without an expert, in order. */
  readonly truckFactor: ReadonlyArray<Person>;
  readonly island: boolean;
  readonly orphaned: boolean;
  /** The five people expert on the most files. */
  readonly experts: ReadonlyArray<Expert>;
  /** Explanations of `island` and `orphaned`. */
  readonly reasons: ReadonlyArray<string>;
  /** Who wrote the lines; undefined when the model has no blame. */
  readonly lineOwners: LineOwners | undefined;
};

const byCommitsThenName = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (human: Human) => human.commits)),
  Order.combine(
    Order.mapInput(Order.String, (human: Human) => human.name),
    Order.mapInput(Order.String, (human: Human) => human.email),
  ),
);

const byFilesThenName = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (expert: Expert) => expert.files)),
  Order.combine(
    Order.flip(
      Order.mapInput(Order.Number, (expert: Expert) => expert.soleFiles),
    ),
    Order.combine(
      Order.mapInput(Order.String, (expert: Expert) => expert.name),
      Order.mapInput(Order.String, (expert: Expert) => expert.email),
    ),
  ),
);

/** Every expert of the set, most files first. */
const expertsOfSet = (
  fileExperts: ReadonlyArray<ReadonlyArray<Human>>,
  model: KnowledgeModel,
): ReadonlyArray<Expert> => {
  const byPerson = groupBy(
    fileExperts.flatMap((experts) =>
      experts.map((human) => ({ human, sole: experts.length === 1 })),
    ),
    ({ human }) => human,
  );
  return [...byPerson]
    .map(([human, own]) =>
      Object.assign({}, personOf(human, model), {
        files: own.length,
        soleFiles: own.filter(({ sole }) => sole).length,
        share: roundReported(own.length / fileExperts.length),
      }),
    )
    .toSorted(byFilesThenName);
};

const filesLabel = (count: number): string =>
  `${count} file${count === 1 ? "" : "s"}`;

const orphanedReason = (
  withoutActive: ReadonlyArray<ReadonlyArray<Human>>,
  files: number,
  model: KnowledgeModel,
): string => {
  const lastExpertCommit = withoutActive
    .flatMap((experts) => experts.map((h) => personOf(h, model).lastCommitAt))
    .toSorted()
    .at(-1);
  const when =
    lastExpertCommit === undefined
      ? ""
      : ` (last expert commit ${lastExpertCommit.slice(0, 10)})`;
  return `no active expert for ${withoutActive.length} of ${filesLabel(files)}${when}`;
};

/**
 * Describes the knowledge over `paths`, universe files that all have an
 * entry in `model`: the experts on the most files, the truck factor, and the
 * island and orphaned flags with their reasons.
 */
export const describeFileSet = (
  paths: ReadonlyArray<string>,
  model: KnowledgeModel,
): FileSetKnowledge => {
  const fileExperts = paths.map((path) => model.experts.get(path) ?? []);
  const files = fileExperts.length;
  const withoutActive = fileExperts.filter(
    (experts) => !experts.some((human) => isActive(human, model)),
  );
  const experts = expertsOfSet(fileExperts, model);
  const [top] = experts;
  const sole =
    top !== undefined && top.soleFiles / files >= ISLAND_SHARE
      ? top
      : undefined;
  const orphaned = withoutActive.length / files > ORPHANED_SHARE;
  return {
    files,
    withoutExpert: fileExperts.filter((list) => list.length === 0).length,
    withoutActiveExpert: withoutActive.length,
    truckFactor: removalOrder(fileExperts, byCommitsThenName).map((human) =>
      personOf(human, model),
    ),
    island: sole !== undefined,
    orphaned,
    experts: experts.slice(0, MAX_EXPERTS),
    reasons: [
      ...(sole === undefined
        ? []
        : [
            `${sole.name} is the only expert on ${sole.soleFiles} of ${filesLabel(files)}`,
          ]),
      ...(orphaned ? [orphanedReason(withoutActive, files, model)] : []),
    ],
    lineOwners:
      model.ownership === undefined
        ? undefined
        : lineOwnersOf(paths, model.ownership),
  };
};

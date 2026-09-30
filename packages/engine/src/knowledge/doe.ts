// Owns the Degree of Expertise model of Cury et al., 2024 (arXiv 2408.08733), with its published constants.
// A higher degree means the person knows the file better; only the ratio between people matters.

/** An expert's degree is at least this share of the highest degree among the file's authors. */
export const EXPERT_RATIO = 0.7;

/** What the model reads about one person and one file. */
export type ExpertiseInput = {
  /** Lines the person added to the file over the full history, following renames. */
  readonly adds: number;
  /** The person authored the oldest commit that touches the file. */
  readonly firstAuthor: boolean;
  /** Whole days between the person's last commit to the file and the HEAD commit. */
  readonly days: number;
  /** The file's current non-blank lines. */
  readonly size: number;
};

/** The Degree of Expertise of one person for one file. */
export const degreeOfExpertise = ({
  adds,
  firstAuthor,
  days,
  size,
}: ExpertiseInput): number =>
  5.28223 +
  0.23173 * Math.log(1 + adds) +
  0.36151 * (firstAuthor ? 1 : 0) -
  0.19421 * Math.log(1 + days) -
  0.28761 * Math.log(Math.max(1, size));

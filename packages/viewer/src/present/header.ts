import type { Report } from "@codesaga/engine";

import { botsCard } from "./bots.js";
import { describeComparison } from "./comparison-note.js";
import { formatAge, formatCount, formatDateLong } from "./format.js";

/** A run of text of the header; `strong` runs are set in the primary ink. */
export type Segment = { readonly text: string; readonly strong: boolean };

/** A pill under the lede. `icon` names a glyph of the render layer. */
export type Chip = {
  readonly icon: "branch" | "hash" | "calendar" | "sun" | "compare";
  readonly mono: boolean;
  readonly parts: readonly Segment[];
};

const SHORT_SHA_LENGTH = 7;

const plain = (text: string): Segment => ({ text, strong: false });
const strong = (text: string): Segment => ({ text, strong: true });

const weeksOf = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "week" : "weeks"}`;

const commitsPhrase = ({ window, repository, overview }: Report): Segment[] => {
  const covered =
    repository.firstCommitAt !== null &&
    window.since <= repository.firstCommitAt;
  return [
    strong(`${formatCount(overview.commits)} commits`),
    ...(covered ? [] : [plain(` since ${formatDateLong(window.since)}`)]),
  ];
};

const activePhrase = (active90: number, total: number): string => {
  if (total === 1) {
    return active90 === 0 ? "not active" : "active";
  }
  return active90 === 0
    ? "none active"
    : `${formatCount(active90)} of them active`;
};

const peoplePhrase = ({ overview }: Report): Segment[] => {
  const { total, active90, allTime } = overview.contributors;
  if (allTime === 1) {
    return [
      plain(" from a single author, "),
      strong(`${formatCount(overview.loc)} lines`),
      plain(` in ${formatCount(overview.files)} files.`),
    ];
  }
  return [
    plain(" from "),
    strong(`${formatCount(total)} ${total === 1 ? "person" : "people"}`),
    plain(`, ${activePhrase(active90, total)} in the last 90 days.`),
  ];
};

/** One sentence that says what the repository is: its main language, age, commits and people. */
export const lede = (report: Report): Segment[] => {
  const { repository, generatedAt, overview } = report;
  if (repository.firstCommitAt === null) {
    return [plain("A repository without commits yet.")];
  }
  const language = overview.languages[0]?.name;
  return [
    plain(`A ${language === undefined ? "" : `${language} `}project that is `),
    strong(formatAge(repository.firstCommitAt, generatedAt)),
    plain(" old: "),
    ...commitsPhrase(report),
    ...peoplePhrase(report),
  ];
};

/** The facts under the lede: branch, HEAD, the window, the weeks of history and the comparison, when there are any. */
export const chips = ({
  repository,
  window,
  activity,
  comparison,
}: Report): Chip[] => [
  ...(repository.branch === null
    ? []
    : [
        {
          icon: "branch",
          mono: false,
          parts: [plain("Branch "), strong(repository.branch)],
        } satisfies Chip,
      ]),
  ...(repository.head === null
    ? []
    : [
        {
          icon: "hash",
          mono: true,
          parts: [
            plain("HEAD "),
            strong(repository.head.slice(0, SHORT_SHA_LENGTH)),
          ],
        } satisfies Chip,
      ]),
  {
    icon: "calendar",
    mono: false,
    parts: [
      strong(formatDateLong(window.since)),
      plain(" to "),
      strong(formatDateLong(window.until)),
    ],
  },
  {
    icon: "sun",
    mono: false,
    parts: [strong(weeksOf(activity.weeks.length)), plain(" of history")],
  },
  ...(comparison === undefined
    ? []
    : [
        {
          icon: "compare",
          mono: false,
          parts: [plain(describeComparison(comparison.previous))],
        } satisfies Chip,
      ]),
];

/** A link of the section navigation. */
export type NavItem = { readonly id: string; readonly label: string };

/** The sections the page has, in page order; Stories and Bots & Agents only exist when the report has something for them. */
export const navItems = (report: Report): NavItem[] => [
  ...(report.stories.length === 0 ? [] : [{ id: "stories", label: "Stories" }]),
  { id: "activity", label: "Activity" },
  ...(report.pullRequests === undefined
    ? []
    : [{ id: "pull-requests", label: "Pull requests" }]),
  { id: "knowledge", label: "Knowledge" },
  { id: "team", label: "Team" },
  ...(botsCard(report) === null
    ? []
    : [{ id: "bots", label: "Bots & Agents" }]),
];

/** "Generated 2 Oct 2026". */
export const generatedNote = ({ generatedAt }: Report): string =>
  `Generated ${formatDateLong(generatedAt)}`;

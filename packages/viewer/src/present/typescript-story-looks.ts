// Owns how the stories about the TypeScript code look as cards: icon, accent slot, big figure, picture and evidence.
// Apart from `stories.ts` so that the card file stays within its size; the cards say what the engine's story says and nothing more.
import type { Report } from "@codesaga/engine";

import { formatCount, formatDateLong } from "./format.js";
import type { IconName } from "./icons.js";

type Story = Report["stories"][number];

type Parts = {
  readonly big: string;
  readonly unit: string;
  readonly viz: { readonly kind: "path" | "pill"; readonly text: string };
  readonly evidence: string;
};

type Look = {
  readonly icon: IconName;
  readonly slot: number;
  readonly build: (story: Story) => Parts;
};

const valueOf = ({ value }: Story): number => value ?? 0;

/** A card that names a path under a count. */
const pathFact =
  (unit: string, evidence: string) =>
  (story: Story): Parts => ({
    big: formatCount(valueOf(story)),
    unit,
    viz: { kind: "path", text: story.path ?? "" },
    evidence,
  });

const strictSince = (story: Story): Parts => ({
  big: formatCount(valueOf(story)),
  unit: "months strict",
  viz: { kind: "pill", text: formatDateLong(story.date ?? "") },
  evidence: `strict turned on in ${story.path ?? ""}`,
});

const typeTrend = (story: Story): Parts => ({
  big: `${valueOf(story) < 0 ? "−" : "+"}${formatCount(Math.round(Math.abs(valueOf(story)) * 100))}%`,
  unit: "escape hatches per 1,000 lines",
  viz: { kind: "pill", text: "last 12 months" },
  evidence: "production code, against the same month a year ago",
});

const moduleEra = (story: Story): Parts => ({
  big: `${formatCount(Math.round(valueOf(story) * 100))}%`,
  unit: "CommonJS",
  viz: {
    kind: "pill",
    text: story.date === undefined ? "today" : formatDateLong(story.date),
  },
  evidence: "share of the production module files that use CommonJS",
});

/** The looks of the six story kinds about the TypeScript code. */
export const TYPESCRIPT_STORY_LOOKS: Record<
  | "focused-test"
  | "complex-core"
  | "core-territory"
  | "strict-since"
  | "type-trend"
  | "module-era",
  Look
> = {
  "focused-test": {
    icon: "flask-conical",
    slot: 4,
    build: pathFact(
      "focused tests",
      "a runner skips every other test while a focused one stays",
    ),
  },
  "complex-core": {
    icon: "brain",
    slot: 6,
    build: pathFact(
      "hardest function",
      "cognitive complexity of the hardest production function",
    ),
  },
  "core-territory": {
    icon: "package",
    slot: 3,
    build: pathFact(
      "territories import it",
      "territories whose production files import this one",
    ),
  },
  "strict-since": { icon: "lock", slot: 2, build: strictSince },
  "type-trend": { icon: "chart-column", slot: 1, build: typeTrend },
  "module-era": { icon: "history", slot: 7, build: moduleEra },
};

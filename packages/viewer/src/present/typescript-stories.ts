import type { Report } from "@codesaga/engine";

import type { IconName } from "./icons.js";
import { TYPESCRIPT_STORY_LOOKS } from "./typescript-story-looks.js";

type Story = Report["stories"][number];

/** A story about the TypeScript code as a line of the section's opening. */
export type StoryLine = {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
};

const isTypeScriptKind = (
  kind: Story["kind"],
): kind is keyof typeof TYPESCRIPT_STORY_LOOKS =>
  kind in TYPESCRIPT_STORY_LOOKS;

/** The stories of the report that are about the TypeScript code, in the report's order and with the icon of their card. */
export const typeScriptStoryLines = (stories: readonly Story[]): StoryLine[] =>
  stories.flatMap(({ kind, title, detail }) =>
    isTypeScriptKind(kind)
      ? [{ icon: TYPESCRIPT_STORY_LOOKS[kind].icon, title, detail }]
      : [],
  );

/** The story that says how the module system changed, for the card that shows its history. */
export const moduleEraStory = (stories: readonly Story[]): Story | null =>
  stories.find(({ kind }) => kind === "module-era") ?? null;

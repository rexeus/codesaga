// Tests only: commit signals in the shapes classification reads.
import type { classifyCommit } from "../automation/classify.js";

export type Signals = Parameters<typeof classifyCommit>[0];

export const ada = { name: "Ada", email: "ada@example.com" };

/** A GitHub account as commits show it: `<id>+<login>@users.noreply.github.com`. */
export const account = (id: number, login: string) => ({
  name: login,
  email: `${id}+${login}@users.noreply.github.com`,
});

export const coAuthor = (value: string) => ({
  key: "Co-Authored-By",
  value,
});

export const trailer = (key: string, value = "x") => ({ key, value });

/** A commit by `ada` without trailers or markers; `overrides` replace any field. */
export const commit = (overrides: Partial<Signals> = {}): Signals => ({
  author: ada,
  committer: ada,
  trailers: [],
  markers: [],
  ...overrides,
});

export const agent = (tool: string) => ({ class: "agent", tool });
export const assisted = (tool: string) => ({ class: "agent-assisted", tool });
export const bot = (tool: string) => ({ class: "bot", tool });

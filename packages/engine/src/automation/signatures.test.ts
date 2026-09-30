import { describe, expect, it } from "vitest";

import {
  account,
  ada,
  agent,
  assisted,
  bot,
  coAuthor,
  commit,
  trailer,
} from "../testing/commit-signals.js";
import type { Signals } from "../testing/commit-signals.js";
import { classifyCommit } from "./classify.js";

// One real-format sample per row of the signature table.
const SAMPLES: ReadonlyArray<readonly [string, Signals, unknown]> = [
  [
    "Claude Code trailer",
    commit({
      trailers: [coAuthor("Claude Opus 4.8 <noreply@anthropic.com>")],
    }),
    assisted("Claude Code"),
  ],
  [
    "Claude Code cloud author",
    commit({ author: { name: "Claude", email: "noreply@anthropic.com" } }),
    agent("Claude Code"),
  ],
  [
    "Claude Code cloud session trailer",
    commit({
      trailers: [trailer("Claude-Session", "https://claude.ai/code/s")],
    }),
    assisted("Claude Code"),
  ],
  [
    "Claude Code pull request line",
    commit({
      markers: [
        "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      ],
    }),
    assisted("Claude Code"),
  ],
  [
    "Claude GitHub app",
    commit({ author: account(209_825_114, "claude[bot]") }),
    agent("Claude Code"),
  ],
  [
    "Copilot cloud agent author",
    commit({ author: account(198_982_749, "Copilot") }),
    agent("GitHub Copilot"),
  ],
  [
    "Copilot cloud agent log trailer",
    commit({ trailers: [trailer("Agent-Logs-Url", "https://github.com/o/r")] }),
    assisted("GitHub Copilot"),
  ],
  [
    "Copilot CLI trailer",
    commit({
      trailers: [
        trailer(
          "Co-authored-by",
          "Copilot <223556219+Copilot@users.noreply.github.com>",
        ),
      ],
    }),
    assisted("GitHub Copilot"),
  ],
  [
    "Copilot CLI session trailer",
    commit({ trailers: [trailer("Copilot-Session")] }),
    assisted("GitHub Copilot"),
  ],
  [
    "Cursor IDE marker trailer",
    commit({ trailers: [trailer("Made-with", "Cursor")] }),
    assisted("Cursor"),
  ],
  [
    "Cursor co-author",
    commit({ trailers: [coAuthor("Cursor <cursoragent@cursor.com>")] }),
    assisted("Cursor"),
  ],
  [
    "Cursor cloud agent author",
    commit({
      author: { name: "Cursor Agent", email: "cursoragent@cursor.com" },
    }),
    agent("Cursor"),
  ],
  [
    "Cursor Bugbot",
    commit({ author: account(206_951_365, "cursor[bot]") }),
    agent("Cursor"),
  ],
  [
    "Codex CLI trailer",
    commit({ trailers: [coAuthor("Codex <noreply@openai.com>")] }),
    assisted("Codex"),
  ],
  [
    "Codex CLI message line",
    commit({ markers: ["Generated with [Codex](https://openai.com/codex)"] }),
    assisted("Codex"),
  ],
  [
    "Codex cloud",
    commit({ author: account(199_175_422, "chatgpt-codex-connector[bot]") }),
    agent("Codex"),
  ],
  [
    "Jules",
    commit({ author: account(161_369_871, "google-labs-jules[bot]") }),
    agent("Jules"),
  ],
  [
    "Devin author",
    commit({ author: account(158_243_242, "devin-ai-integration[bot]") }),
    agent("Devin"),
  ],
  [
    "Devin trailer",
    commit({ trailers: [coAuthor("Devin <noreply@cognition.ai>")] }),
    assisted("Devin"),
  ],
  [
    "Devin message line",
    commit({ markers: ["Generated with [Devin](https://devin.ai)"] }),
    assisted("Devin"),
  ],
  [
    "Aider trailer",
    commit({ trailers: [coAuthor("aider (gpt-5) <aider@aider.chat>")] }),
    assisted("Aider"),
  ],
  [
    "Aider committer",
    commit({ committer: { name: "Ada (aider)", email: ada.email } }),
    assisted("Aider"),
  ],
  [
    "Aider author of older versions",
    commit({ author: { name: "Ada (aider)", email: ada.email } }),
    agent("Aider"),
  ],
  [
    "Amp trailer",
    commit({ trailers: [coAuthor("Amp <amp@ampcode.com>")] }),
    assisted("Amp"),
  ],
  [
    "Amp thread trailer",
    commit({ trailers: [trailer("Amp-Thread-ID", "T-1")] }),
    assisted("Amp"),
  ],
  [
    "OpenHands",
    commit({
      author: { name: "openhands", email: "openhands@all-hands.dev" },
    }),
    agent("OpenHands"),
  ],
  [
    "Factory droid",
    commit({ author: account(138_933_559, "factory-droid[bot]") }),
    agent("Factory"),
  ],
  [
    "Kiro",
    commit({ trailers: [coAuthor("Kiro <noreply@kiro.dev>")] }),
    assisted("Kiro"),
  ],
  [
    "Junie author",
    commit({ author: account(311_396_830, "junie-the-developer[bot]") }),
    agent("Junie"),
  ],
  [
    "Junie trailer",
    commit({ trailers: [coAuthor("Junie <junie@jetbrains.com>")] }),
    assisted("Junie"),
  ],
  [
    "Cline cloud author",
    commit({ author: account(276_134_852, "cline-cloud[bot]") }),
    agent("Cline"),
  ],
  [
    "Cline trailer",
    commit({ trailers: [coAuthor("Cline <noreply@cline.bot>")] }),
    assisted("Cline"),
  ],
  [
    "Gemini Code Assist review co-author",
    commit({
      trailers: [
        coAuthor(
          "gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>",
        ),
      ],
    }),
    assisted("Gemini Code Assist"),
  ],
  [
    "Windsurf review co-author",
    commit({
      trailers: [
        coAuthor(
          "windsurf-bot[bot] <189301087+windsurf-bot[bot]@users.noreply.github.com>",
        ),
      ],
    }),
    assisted("Windsurf"),
  ],
  [
    "Dependabot",
    commit({ author: account(49_699_333, "dependabot[bot]") }),
    bot("Dependabot"),
  ],
  [
    "Renovate app",
    commit({ author: account(29_139_614, "renovate[bot]") }),
    bot("Renovate"),
  ],
  [
    "self-hosted Renovate",
    commit({ author: { name: "Renovate Bot", email: "bot@renovateapp.com" } }),
    bot("Renovate"),
  ],
  [
    "GitHub Actions",
    commit({ author: account(41_898_282, "github-actions[bot]") }),
    bot("GitHub Actions"),
  ],
  [
    "GitHub Actions with the identity workflows set by hand",
    commit({
      author: { name: "GitHub Actions", email: "actions@github.com" },
    }),
    bot("GitHub Actions"),
  ],
  [
    "pre-commit.ci",
    commit({ author: account(66_853_113, "pre-commit-ci[bot]") }),
    bot("pre-commit.ci"),
  ],
  [
    "Sweep",
    commit({ author: account(128_439_645, "sweep-ai[bot]") }),
    bot("Sweep"),
  ],
];

describe("classifyCommit signature table", () => {
  it.each(SAMPLES)("classifies %s", (_row, signals, expected) => {
    expect(classifyCommit(signals)).toStrictEqual(expected);
  });
});

// Owns the agent and bot signature table: data, one entry per source row, with its source.
// Classification reads the table and never hard-codes a tool name.
// New tools are new entries; a rule that needs code belongs in classify.ts.

/**
 * Identifies a person by any one of its fields. Emails are lowercase and match
 * exactly; `githubId` is the number in a `<id>+<login>@users.noreply.github.com`
 * address, which stays stable when an account is renamed.
 */
export type PersonPattern = {
  readonly email?: string;
  readonly name?: RegExp;
  readonly githubId?: number;
};

/** A trailer that marks a tool; without `value`, the key alone marks it (matched case-insensitively). */
type TrailerPattern = { readonly key: string; readonly value?: RegExp };

/**
 * One row of the table. Rows of one product share a `name`, so its variants
 * (CLI, cloud, pull request line) merge in the report. A commit matches a row
 * when its author, committer or a `Co-authored-by` trailer matches `people`,
 * when a trailer matches `trailers`, or when a message line matches
 * `messageLines`.
 */
export type Signature = {
  /** Reported as the tool's name, such as "Claude Code". */
  readonly name: string;
  readonly kind: "agent" | "bot";
  readonly people?: ReadonlyArray<PersonPattern>;
  readonly trailers?: ReadonlyArray<TrailerPattern>;
  /** Tested against the trimmed "Generated with [<Tool>]" lines of the message. */
  readonly messageLines?: ReadonlyArray<RegExp>;
};

/**
 * Every known agent and bot. A row's source URL sits in a comment on it.
 * Rows were researched on 2026-09-30; the URLs are the vendors' documentation
 * of the default attribution, and the account IDs come from `GET /user/<id>`.
 */
export const SIGNATURES: ReadonlyArray<Signature> = [
  // Agents
  {
    // https://code.claude.com/docs/en/settings (attribution, on by default);
    // also the author of Claude Code in the cloud, `Claude <noreply@anthropic.com>`
    name: "Claude Code",
    kind: "agent",
    people: [{ email: "noreply@anthropic.com" }],
  },
  {
    // https://code.claude.com/docs/en/settings (cloud sessions)
    name: "Claude Code",
    kind: "agent",
    trailers: [{ key: "Claude-Session" }],
  },
  {
    // https://code.claude.com/docs/en/settings (pull request description, on by default)
    name: "Claude Code",
    kind: "agent",
    messageLines: [/Generated with \[Claude Code\]/iu],
  },
  {
    // https://code.claude.com/docs/en/github-actions (the Claude GitHub app)
    name: "Claude Code",
    kind: "agent",
    people: [{ githubId: 209_825_114, name: /^claude\[bot\]$/iu }],
  },
  {
    // https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent
    // The author is named `Copilot` without a `[bot]` suffix, hence the ID.
    name: "GitHub Copilot",
    kind: "agent",
    people: [{ githubId: 198_982_749, name: /^copilot-swe-agent\[bot\]$/iu }],
    trailers: [{ key: "Agent-Logs-Url" }],
  },
  {
    // https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
    name: "GitHub Copilot",
    kind: "agent",
    people: [{ githubId: 223_556_219 }],
    trailers: [{ key: "Copilot-Session" }],
  },
  {
    // https://cursor.com/docs/cli/overview (`Made-with: Cursor`, on by default)
    name: "Cursor",
    kind: "agent",
    people: [{ email: "cursoragent@cursor.com" }],
    trailers: [{ key: "Made-with", value: /^cursor$/iu }],
  },
  {
    // https://cursor.com/docs/cloud-agent (cloud agent and Bugbot)
    name: "Cursor",
    kind: "agent",
    people: [{ githubId: 206_951_365, name: /^cursor\[bot\]$/iu }],
  },
  {
    // https://developers.openai.com/codex/cli (attribution is server-controlled)
    name: "Codex",
    kind: "agent",
    people: [{ email: "noreply@openai.com" }],
    messageLines: [/Generated with \[Codex\]/iu],
  },
  {
    // https://developers.openai.com/codex/cloud
    name: "Codex",
    kind: "agent",
    people: [
      { githubId: 199_175_422, name: /^chatgpt-codex-connector\[bot\]$/iu },
    ],
  },
  {
    // https://jules.google/docs
    name: "Jules",
    kind: "agent",
    people: [{ githubId: 161_369_871, name: /^google-labs-jules\[bot\]$/iu }],
  },
  {
    // https://docs.devin.ai
    name: "Devin",
    kind: "agent",
    people: [
      {
        email: "noreply@cognition.ai",
        githubId: 158_243_242,
        name: /^devin-ai-integration\[bot\]$/iu,
      },
    ],
    messageLines: [/Generated with \[Devin\]/iu],
  },
  {
    // https://aider.chat/docs/git.html (the committer, or an old author, is named `<You> (aider)`)
    name: "Aider",
    kind: "agent",
    people: [{ email: "aider@aider.chat", name: /\(aider\)$/iu }],
  },
  {
    // https://ampcode.com/manual
    name: "Amp",
    kind: "agent",
    people: [{ email: "amp@ampcode.com" }],
    trailers: [{ key: "Amp-Thread-ID" }],
  },
  {
    // https://docs.all-hands.dev
    name: "OpenHands",
    kind: "agent",
    people: [{ email: "openhands@all-hands.dev" }],
  },
  {
    // https://docs.factory.ai
    name: "Factory",
    kind: "agent",
    people: [{ githubId: 138_933_559, name: /^factory-droid\[bot\]$/iu }],
  },
  {
    // https://kiro.dev/docs
    name: "Kiro",
    kind: "agent",
    people: [{ email: "noreply@kiro.dev" }],
  },
  {
    // https://www.jetbrains.com/help/junie/
    // Unverified: no vendor document states the default attribution; the account
    // ID and the commit format were confirmed on real commits on 2026-09-30.
    name: "Junie",
    kind: "agent",
    people: [
      {
        email: "junie@jetbrains.com",
        githubId: 311_396_830,
        name: /^junie-the-developer\[bot\]$/iu,
      },
    ],
  },
  {
    // https://docs.cline.bot
    // Unverified: no vendor document states the default attribution; the account
    // ID and the commit format were confirmed on real commits on 2026-09-30.
    name: "Cline",
    kind: "agent",
    people: [
      {
        email: "noreply@cline.bot",
        githubId: 276_134_852,
        name: /^cline-cloud\[bot\]$/iu,
      },
    ],
  },
  {
    // https://developers.google.com/gemini-code-assist/docs/review-github-code
    // A review bot: it appears as co-author when a human accepts its suggestion.
    name: "Gemini Code Assist",
    kind: "agent",
    people: [{ githubId: 176_961_590, name: /^gemini-code-assist\[bot\]$/iu }],
  },
  {
    // https://docs.windsurf.com (a review bot, like Gemini Code Assist)
    name: "Windsurf",
    kind: "agent",
    people: [{ githubId: 189_301_087, name: /^windsurf-bot\[bot\]$/iu }],
  },
  // Bots
  {
    // https://docs.github.com/en/code-security/dependabot
    name: "Dependabot",
    kind: "bot",
    people: [{ githubId: 49_699_333, name: /^dependabot\[bot\]$/iu }],
  },
  {
    // https://docs.renovatebot.com (the hosted app and self-hosted `Renovate Bot`)
    name: "Renovate",
    kind: "bot",
    people: [
      {
        email: "bot@renovateapp.com",
        githubId: 29_139_614,
        name: /^renovate\[bot\]$/iu,
      },
    ],
  },
  {
    // https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
    name: "GitHub Actions",
    kind: "bot",
    people: [{ githubId: 41_898_282, name: /^github-actions\[bot\]$/iu }],
  },
  {
    // https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
    // Not in the researched table: the identity that workflows set by hand with
    // `git config user.email actions@github.com`, seen on 368 of the 798
    // commits of anthropics/claude-code-action.
    name: "GitHub Actions",
    kind: "bot",
    people: [{ email: "actions@github.com" }],
  },
  {
    // https://pre-commit.ci
    name: "pre-commit.ci",
    kind: "bot",
    people: [{ githubId: 66_853_113, name: /^pre-commit-ci\[bot\]$/iu }],
  },
  {
    // https://github.com/sweepai/sweep (legacy; the account is now `sweep-ai-deprecated[bot]`)
    name: "Sweep",
    kind: "bot",
    people: [
      { githubId: 128_439_645, name: /^sweep-ai(?:-deprecated)?\[bot\]$/iu },
    ],
  },
];

// Owns the agent and bot signature table: data, one entry per tool, with its source.
// Classification reads the table and never hard-codes a tool name.
// New tools are new entries; a rule that needs code belongs in classify.ts.

/** Where a signature is looked for: the author line, a co-author trailer, or the commit message. */
type SignatureField = "author" | "co-author" | "message";

/** One automation tool and the patterns that identify its commits. */
type Signature = {
  /** Reported as the tool's name, such as "Claude Code". */
  readonly name: string;
  readonly kind: "agent" | "bot";
  readonly matches: ReadonlyArray<{
    readonly where: SignatureField;
    /** Tested case-insensitively against the `Name <email>` of an author or co-author, or against a message line. */
    readonly pattern: RegExp;
  }>;
};

/**
 * Every known agent and bot, agents first. A tool's source URL sits in a
 * comment on its entry.
 */
export const SIGNATURES: ReadonlyArray<Signature> = [];

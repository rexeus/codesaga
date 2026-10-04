// Owns which packages mean which framework or tool: a table of data, not logic.
// Add a row to teach codesaga a tool. A package ending in `/*` names every package of a scope; `node:test` and `bun:test` are the built-in test runners, matched on their prefixed specifiers.

import type { Ecosystem } from "../../report/typescript-ecosystem.js";

/** One tool: its name, what it is for, and the packages that mean it. */
export type EcosystemEntry = {
  readonly name: string;
  readonly category: Ecosystem["tools"][number]["category"];
  readonly packages: ReadonlyArray<string>;
};

export const ECOSYSTEM_TABLE: ReadonlyArray<EcosystemEntry> = [
  { name: "React", category: "framework", packages: ["react", "react-dom"] },
  { name: "Next.js", category: "framework", packages: ["next"] },
  { name: "Vue", category: "framework", packages: ["vue"] },
  { name: "Svelte", category: "framework", packages: ["svelte"] },
  { name: "Angular", category: "framework", packages: ["@angular/core"] },
  { name: "Solid", category: "framework", packages: ["solid-js"] },
  { name: "Express", category: "server", packages: ["express"] },
  { name: "Fastify", category: "server", packages: ["fastify"] },
  { name: "Hono", category: "server", packages: ["hono"] },
  { name: "Koa", category: "server", packages: ["koa"] },
  { name: "NestJS", category: "server", packages: ["@nestjs/*"] },
  { name: "tRPC", category: "server", packages: ["@trpc/*"] },
  { name: "Prisma", category: "data", packages: ["@prisma/client", "prisma"] },
  { name: "Drizzle", category: "data", packages: ["drizzle-orm"] },
  { name: "Effect", category: "library", packages: ["effect", "@effect/*"] },
  { name: "fp-ts", category: "library", packages: ["fp-ts"] },
  { name: "RxJS", category: "library", packages: ["rxjs"] },
  { name: "zod", category: "validation", packages: ["zod"] },
  { name: "valibot", category: "validation", packages: ["valibot"] },
  { name: "Vitest", category: "test", packages: ["vitest", "@vitest/*"] },
  { name: "Jest", category: "test", packages: ["jest", "@jest/*"] },
  { name: "Mocha", category: "test", packages: ["mocha"] },
  { name: "node:test", category: "test", packages: ["node:test"] },
  { name: "bun:test", category: "test", packages: ["bun:test"] },
  {
    name: "Playwright",
    category: "test",
    packages: ["playwright", "@playwright/*"],
  },
  { name: "Cypress", category: "test", packages: ["cypress"] },
  { name: "ESLint", category: "lint", packages: ["eslint", "@eslint/*"] },
  { name: "oxlint", category: "lint", packages: ["oxlint"] },
  { name: "Biome", category: "lint", packages: ["@biomejs/*"] },
  { name: "Prettier", category: "format", packages: ["prettier"] },
  { name: "oxfmt", category: "format", packages: ["oxfmt"] },
  { name: "Vite", category: "build", packages: ["vite"] },
  { name: "webpack", category: "build", packages: ["webpack"] },
  { name: "esbuild", category: "build", packages: ["esbuild"] },
  { name: "tsup", category: "build", packages: ["tsup"] },
  { name: "tsdown", category: "build", packages: ["tsdown"] },
  { name: "Turborepo", category: "monorepo", packages: ["turbo"] },
  { name: "Nx", category: "monorepo", packages: ["nx", "@nx/*"] },
];

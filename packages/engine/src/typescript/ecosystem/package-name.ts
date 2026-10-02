// Owns telling what an import specifier names: a Node built-in, a package, or neither.
// Specifiers are untrusted text from the repository, so anything that is not a plausible package name is dropped rather than counted.

/** Node's built-in modules, as an `import` names them with or without the `node:` prefix. */
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

const PACKAGE_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/iu;

/** What a specifier names. */
export type SpecifierTarget =
  | { readonly kind: "builtin"; readonly name: string }
  | { readonly kind: "package"; readonly name: string };

const firstSegment = (specifier: string): string =>
  specifier.split("/")[0] ?? "";

/**
 * What `specifier` names, or undefined for a relative path, a path alias such
 * as `@/x` or `~/x`, a URL, or text that no package could be named. A
 * built-in is named without its prefix and subpath: `node:fs/promises` is `fs`.
 */
export const targetOf = (specifier: string): SpecifierTarget | undefined => {
  if (specifier.startsWith("node:")) {
    const name = firstSegment(specifier.slice("node:".length));
    return name === "" ? undefined : { kind: "builtin", name };
  }
  const name = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : firstSegment(specifier);
  if (NODE_BUILTINS.has(name) && !specifier.startsWith("@")) {
    return { kind: "builtin", name };
  }
  return PACKAGE_NAME.test(name) ? { kind: "package", name } : undefined;
};

/** The name the ecosystem table matches a specifier by: `node:test` for a built-in with its prefix, else the package name. */
export const tableKeyOf = (specifier: string): string | undefined => {
  const target = targetOf(specifier);
  if (target === undefined) {
    return undefined;
  }
  return specifier.startsWith("node:") ? `node:${target.name}` : target.name;
};

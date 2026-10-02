/**
 * Reads the Lucide icons the page draws out of `lucide-static`: their shapes as
 * data, so the page builds SVG elements and never parses markup, and the
 * package's license, which must travel with every copy of them.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** One drawing element of an icon, such as `["path", { d: "M12 2v2" }]`. */
type IconNode = readonly [
  tag: string,
  attributes: Readonly<Record<string, string>>,
];

const lucideRoot = path.dirname(
  fileURLToPath(import.meta.resolve("lucide-static/package.json")),
);

const ELEMENT = /<([a-z]+)((?:\s+[a-z][a-z0-9-]*="[^"]*")*)\s*\/>/gu;
const ATTRIBUTE = /([a-z][a-z0-9-]*)="([^"]*)"/gu;

/** The drawing elements of a Lucide SVG; anything else in the file is an error, not something to skip. */
const nodesOf = (name: string, svg: string): IconNode[] => {
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/u.exec(svg)?.[1];
  if (inner === undefined) {
    throw new Error(`lucide-static's ${name}.svg has no <svg> element.`);
  }
  if (inner.replaceAll(ELEMENT, "").trim() !== "") {
    throw new Error(
      `lucide-static's ${name}.svg has markup that is not a self-closing element.`,
    );
  }
  return [...inner.matchAll(ELEMENT)].map(([, tag = "", attributes = ""]) => [
    tag,
    Object.fromEntries(
      [...attributes.matchAll(ATTRIBUTE)].map(([, key = "", value = ""]) => [
        key,
        value,
      ]),
    ),
  ]);
};

/** The shapes of the icons `names`, failing for a name `lucide-static` does not have. */
export const readIconShapes = async (
  names: readonly string[],
): Promise<Record<string, IconNode[]>> =>
  Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        const svg = await readFile(
          path.join(lucideRoot, "icons", `${name}.svg`),
          "utf8",
        ).catch(() => {
          throw new Error(`lucide-static has no icon "${name}".`);
        });
        return [name, nodesOf(name, svg)] as const;
      }),
    ),
  );

/** The license text of `lucide-static`: ISC for Lucide, and MIT for the icons it took from Feather. */
export const readLucideLicense = async (): Promise<string> =>
  (await readFile(path.join(lucideRoot, "LICENSE"), "utf8")).trim();

import type { Segment } from "../present/header.js";

type Child = Node | string;
type Attributes = Readonly<Record<string, string | number>>;

/**
 * Creates an element from a tag, a class list and children. String children
 * become text nodes, so untrusted text (names, paths) never parses as markup.
 */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  element.append(...children);
  return element;
};

/** Finds a skeleton element of the page, failing loudly when the page and script disagree. */
export const byId = <T extends Element>(
  id: string,
  type: abstract new () => T,
): T => {
  const element = document.querySelector(`#${id}`);
  if (!(element instanceof type)) {
    throw new TypeError(`The page has no <${type.name}> with id "${id}".`);
  }
  return element;
};

/**
 * Creates an SVG element. The namespace is read from the parser-created
 * `#svg-root` of the page template, so the script carries no namespace URL.
 */
export const s = (
  tag: string,
  attributes: Attributes = {},
  ...children: readonly (SVGElement | string)[]
): SVGElement => {
  const element = document.createElementNS(
    byId("svg-root", SVGSVGElement).namespaceURI,
    tag,
  );
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  element.append(...children);
  if (!(element instanceof SVGElement)) {
    throw new TypeError(`<${tag}> is not an SVG element.`);
  }
  return element;
};

/** Text with its strong runs wrapped in `<b>`; every run is a text node, so nothing parses as markup. */
export const richText = (segments: readonly Segment[]): Child[] =>
  segments.map(({ text, strong }) => (strong ? h("b", "", text) : text));

/** A file name or path in monospace; `title` holds the whole path when the text is a tail of it. */
export const mono = (text: string, title = text): HTMLElement => {
  const element = h("span", "mono", text);
  element.title = title;
  return element;
};

/** The nodes with ", " between them, for a sentence that names several files. */
export const commaList = (nodes: readonly Node[]): Child[] => {
  const parts: Child[] = [];
  for (const node of nodes) {
    parts.push(...(parts.length === 0 ? [] : [", "]), node);
  }
  return parts;
};

/**
 * The text split into pieces that end in a slash, with a word-break
 * opportunity between them, so a long path wraps after a `/` and never inside
 * a name. The pieces are text nodes.
 */
export const breakAfterSlashes = (text: string): Child[] => {
  const names = text.split("/");
  const last = names.length - 1;
  return names
    .map((name, index) => (index === last ? name : `${name}/`))
    .filter((piece) => piece !== "")
    .flatMap((piece, index) =>
      index === 0 ? [piece] : [document.createElement("wbr"), piece],
    );
};

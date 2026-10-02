import type { Segment } from "../present/story.js";

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

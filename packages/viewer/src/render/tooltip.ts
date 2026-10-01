import { byId, h } from "./dom.js";

/** One line of a tooltip: the value leads; `key` is the entity class (`c-added`) drawn as a line key. */
type TooltipRow = {
  readonly label: string;
  readonly value: string;
  readonly key?: string;
};

export type TooltipContent = {
  readonly title: string;
  readonly rows: readonly TooltipRow[];
};

const POINTER_OFFSET = 14;

const row = ({ label, value, key }: TooltipRow): HTMLElement =>
  h(
    "div",
    "tooltip-row",
    ...(key === undefined ? [] : [h("span", `key ${key}`)]),
    h("strong", "", value),
    h("span", "label", label),
  );

const place = (tooltip: HTMLElement, x: number, y: number): void => {
  const flipX = x + POINTER_OFFSET + tooltip.offsetWidth > window.innerWidth;
  const flipY = y + POINTER_OFFSET + tooltip.offsetHeight > window.innerHeight;
  const left = flipX
    ? x - POINTER_OFFSET - tooltip.offsetWidth
    : x + POINTER_OFFSET;
  const top = flipY
    ? y - POINTER_OFFSET - tooltip.offsetHeight
    : y + POINTER_OFFSET;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.top = `${Math.max(0, top)}px`;
};

/** Shows the page's tooltip near a viewport point. Every string is set as text. */
export const showTooltip = (
  { title, rows }: TooltipContent,
  event: { readonly clientX: number; readonly clientY: number },
): void => {
  const tooltip = byId("tooltip", HTMLElement);
  tooltip.replaceChildren(
    h("div", "tooltip-title", title),
    ...rows.map((entry) => row(entry)),
  );
  tooltip.hidden = false;
  place(tooltip, event.clientX, event.clientY);
};

export const hideTooltip = (): void => {
  byId("tooltip", HTMLElement).hidden = true;
};

/** Makes `target` show `content` while the pointer is over it. */
export const bindTooltip = (
  target: SVGElement | HTMLElement,
  content: TooltipContent,
): void => {
  target.addEventListener("pointermove", (event) => {
    if (event instanceof PointerEvent) {
      showTooltip(content, event);
    }
  });
  target.addEventListener("pointerleave", hideTooltip);
};

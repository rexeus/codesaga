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
  /** A sentence under the rows, such as the rule behind a badge. */
  readonly text?: string;
};

const POINTER_OFFSET = 14;
const TOOLTIP_ID = "tooltip";

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
  { title, rows, text }: TooltipContent,
  event: { readonly clientX: number; readonly clientY: number },
): void => {
  const tooltip = byId(TOOLTIP_ID, HTMLElement);
  tooltip.replaceChildren(
    h("div", "tooltip-title", title),
    ...rows.map((entry) => row(entry)),
    ...(text === undefined ? [] : [h("div", "tooltip-text", text)]),
  );
  tooltip.hidden = false;
  place(tooltip, event.clientX, event.clientY);
};

export const hideTooltip = (): void => {
  byId(TOOLTIP_ID, HTMLElement).hidden = true;
};

/**
 * Makes `target` show `content` while the pointer is over it, and, for a
 * focusable target, while it has the keyboard focus: the tooltip then
 * describes the target to assistive technology, and Escape dismisses it
 * without moving the focus.
 */
export const bindTooltip = (
  target: SVGElement | HTMLElement,
  content: TooltipContent,
): void => {
  const dismiss = (): void => {
    target.removeAttribute("aria-describedby");
    hideTooltip();
  };
  target.addEventListener("pointermove", (event) => {
    if (event instanceof PointerEvent) {
      showTooltip(content, event);
    }
  });
  target.addEventListener("pointerleave", hideTooltip);
  target.addEventListener("focus", () => {
    const box = target.getBoundingClientRect();
    target.setAttribute("aria-describedby", TOOLTIP_ID);
    showTooltip(content, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
  });
  target.addEventListener("blur", dismiss);
  target.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") {
      dismiss();
    }
  });
};

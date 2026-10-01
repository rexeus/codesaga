import type { Report } from "@codesaga/engine";

/**
 * The sentence that replaces the charts of a window section, or `null` when
 * the window holds commits. The engine still emits a zero-filled week and
 * month for every period, so only the window's commit count can tell.
 */
export const emptyWindowNotice = ({ window }: Report): string | null =>
  window.commits === 0 ? "No commits in the window." : null;

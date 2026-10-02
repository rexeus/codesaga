import type { IconName } from "../present/icons.js";
import { s } from "./dom.js";

const SHAPES: Record<IconName, readonly string[]> = {
  branch: [
    "M6 3v12",
    "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M18 9a9 9 0 0 1-9 9",
  ],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  ],
  cake: [
    "M4 21h16",
    "M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7",
    "M5 16c2 1.5 3.5 1.5 5 0s3-1.5 4.5 0 3 1.5 4.5 0",
    "M12 12V8",
    "M12 5.2c-.9-1-.9-1.7 0-2.7.9 1 .9 1.7 0 2.7z",
  ],
  compare: ["M7 7h13", "m16 3 4 4-4 4", "M17 17H4", "m8 21-4-4 4-4"],
  flame: [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  ],
  ghost: [
    "M9 10h.01",
    "M15 10h.01",
    "M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z",
  ],
  hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"],
  shuffle: [
    "M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22",
    "m18 2 4 4-4 4",
    "M2 6h1.9c1.5 0 2.9.9 3.6 2.2",
    "M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8",
    "m18 14 4 4-4 4",
  ],
  snow: [
    "M2 12h20",
    "M12 2v20",
    "m20 16-4-4 4-4",
    "m4 8 4 4-4 4",
    "m16 4-4 4-4-4",
    "m8 20 4-4 4 4",
  ],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M12 2v2",
    "M12 20v2",
    "m4.9 4.9 1.4 1.4",
    "m17.7 17.7 1.4 1.4",
    "M2 12h2",
    "M20 12h2",
    "m6.3 17.7-1.4 1.4",
    "m19.1 4.9-1.4 1.4",
  ],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  truck: [
    "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
    "M15 18H9",
    "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14",
    "M17 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    "M3 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  ],
  up: ["M7 17 17 7", "M7 7h10v10"],
  down: ["M17 7 7 17", "M17 17H7V7"],
  usersplus: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M19 8v6",
    "M22 11h-6",
  ],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
};

/** A line icon that takes the text color of its surroundings. */
export const icon = (
  name: IconName,
  size = 18,
  strokeWidth = 1.8,
): SVGElement =>
  s(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    },
    ...SHAPES[name].map((d) => s("path", { d })),
  );

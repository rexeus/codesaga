import { describe, expect, it } from "vitest";

import { FrameParser } from "./blob-frames.js";
import type { Frame } from "./blob-frames.js";

const encoder = new TextEncoder();
const oid = (digit: string) => digit.repeat(40);

const bytes = (...parts: ReadonlyArray<string | Uint8Array>) =>
  Uint8Array.from(
    parts.flatMap((part) =>
      Array.from(typeof part === "string" ? encoder.encode(part) : part),
    ),
  );

const frame = (id: string, content: string | Uint8Array) => {
  const body = bytes(content);
  return bytes(`${id} blob ${body.length}\n`, body, "\n");
};

const parse = (chunks: ReadonlyArray<Uint8Array>, maxBytes?: number) => {
  const parser = new FrameParser(maxBytes);
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.end()];
};

const split = (whole: Uint8Array, size: number) =>
  Array.from({ length: Math.ceil(whole.length / size) }, (_, index) =>
    whole.subarray(index * size, (index + 1) * size),
  );

const contents = (frames: ReadonlyArray<Frame>) =>
  frames.map((entry) => {
    if ("malformed" in entry) {
      return ["malformed", entry.malformed];
    }
    if ("content" in entry) {
      return [entry.oid, Array.from(entry.content)];
    }
    return [entry.oid, "tooLarge" in entry ? "tooLarge" : "unreadable"];
  });

describe("FrameParser", () => {
  it("cuts content that holds newlines, empty content and invalid UTF-8 by its size", () => {
    const invalid = Uint8Array.of(0xff, 0x0a, 0xfe, 0x0a);
    const whole = bytes(
      frame(oid("a"), "one\ntwo\n"),
      frame(oid("b"), ""),
      frame(oid("c"), invalid),
    );

    expect(contents(parse([whole]))).toStrictEqual([
      [oid("a"), [...encoder.encode("one\ntwo\n")]],
      [oid("b"), []],
      [oid("c"), [...invalid]],
    ]);
  });

  it("yields the same frames however the output is split into chunks", () => {
    const whole = bytes(
      frame(oid("a"), "line\nline\n"),
      `${oid("d")} missing\n`,
      frame(oid("c"), Uint8Array.of(0xc3, 0xa9, 0x0a, 0x00)),
    );

    const expected = contents(parse([whole]));

    expect(expected).toHaveLength(3);
    for (const size of [1, 2, 7, 41, 50]) {
      expect(contents(parse(split(whole, size)))).toStrictEqual(expected);
    }
  });

  it("reports a missing object and an object that is not a blob as unreadable", () => {
    const tree = bytes(`${oid("b")} tree 3\nabc\n`);
    const whole = bytes(`${oid("a")} missing\n`, tree);

    expect(contents(parse([whole]))).toStrictEqual([
      [oid("a"), "unreadable"],
      [oid("b"), "unreadable"],
    ]);
  });

  it("reports the frame the output ended in as unreadable", () => {
    const cut = bytes(frame(oid("a"), "whole"), `${oid("b")} blob 10\nshort`);

    expect(contents(parse([cut]))).toStrictEqual([
      [oid("a"), [...encoder.encode("whole")]],
      [oid("b"), "unreadable"],
    ]);
  });

  it("ends the output with a malformed frame on a header it does not know, as framing cannot recover", () => {
    const whole = bytes("not a header\n", frame(oid("a"), "ignored"));

    expect(contents(parse([whole]))).toStrictEqual([
      ["malformed", "not a header"],
    ]);
  });

  it("counts the content of a blob over the limit without keeping it, and reads the next frame", () => {
    const big = "x".repeat(100);
    const whole = bytes(frame(oid("a"), big), frame(oid("b"), "small"));

    expect(contents(parse(split(whole, 7), 50))).toStrictEqual([
      [oid("a"), "tooLarge"],
      [oid("b"), Array.from(encoder.encode("small"))],
    ]);
  });
});

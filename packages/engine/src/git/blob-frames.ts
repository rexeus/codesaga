// Owns the framing of `git cat-file --batch` output: `<oid> <type> <size>\n`,
// then exactly `<size>` bytes of content, then `\n`; or `<oid> missing\n`.
// The frames are cut by byte count, because the content may hold any byte,
// newlines and invalid UTF-8 included.

/** An object read from the batch output. */
export type Frame =
  | { readonly oid: string; readonly content: Uint8Array }
  /** The object does not exist or is not a blob. */
  | { readonly oid: string; readonly unreadable: true }
  /** The blob is larger than the parser's `maxBytes`; its content was skipped, not kept. */
  | { readonly oid: string; readonly tooLarge: true }
  /** A header git would never print; the framing cannot recover, so no frame follows. */
  | { readonly malformed: string };

type OpenFrame = {
  readonly oid: string;
  readonly isBlob: boolean;
  /** Whether the content is counted and dropped rather than kept. */
  readonly discard: boolean;
  /** The content and its closing newline. */
  readonly length: number;
  readonly parts: Array<Uint8Array>;
  received: number;
};

const NEWLINE = 10;
const HEADER = /^([0-9a-f]+) (\w+) (\d+)$/u;
const MISSING = /^(\S+) missing$/u;

const concat = (first: Uint8Array, second: Uint8Array): Uint8Array => {
  const both = new Uint8Array(first.length + second.length);
  both.set(first);
  both.set(second, first.length);
  return both;
};

const joined = (parts: ReadonlyArray<Uint8Array>, length: number) => {
  const [only] = parts;
  if (parts.length === 1 && only !== undefined) {
    return only.subarray(0, length);
  }
  const content = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    content.set(part.subarray(0, length - offset), offset);
    offset += part.length;
  }
  return content;
};

const completed = (open: OpenFrame): Frame => {
  if (!open.isBlob) {
    return { oid: open.oid, unreadable: true };
  }
  return open.discard
    ? { oid: open.oid, tooLarge: true }
    : { oid: open.oid, content: joined(open.parts, open.length - 1) };
};

/**
 * Turns chunks of `cat-file --batch` output into frames. It holds the state
 * between chunks, so use one instance per process.
 */
export class FrameParser {
  #header: Uint8Array = new Uint8Array(0);
  #open: OpenFrame | undefined;
  #broken = false;
  readonly #maxBytes: number;

  /** A blob larger than `maxBytes` (default: no limit) is reported as too large without keeping its content. */
  constructor(maxBytes = Number.POSITIVE_INFINITY) {
    this.#maxBytes = maxBytes;
  }

  /**
   * Consumes the next chunk and returns the frames it completed. A header git
   * would never print ends the output with a `malformed` frame, and every
   * later chunk yields nothing.
   */
  push(chunk: Uint8Array): ReadonlyArray<Frame> {
    const frames: Array<Frame> = [];
    let position = 0;
    while (position < chunk.length && !this.#broken) {
      if (this.#open === undefined) {
        position = this.#readHeader(chunk, position, frames);
      } else {
        position = this.#readContent(chunk, position, frames);
      }
    }
    return frames;
  }

  /** The frame the output ended in the middle of, as unreadable; call once after the last `push`. */
  end(): ReadonlyArray<Frame> {
    const open = this.#open;
    this.#open = undefined;
    return open === undefined ? [] : [{ oid: open.oid, unreadable: true }];
  }

  #readHeader(
    chunk: Uint8Array,
    position: number,
    frames: Array<Frame>,
  ): number {
    const newline = chunk.indexOf(NEWLINE, position);
    if (newline === -1) {
      this.#header = concat(this.#header, chunk.subarray(position));
      return chunk.length;
    }
    const line = new TextDecoder().decode(
      concat(this.#header, chunk.subarray(position, newline)),
    );
    this.#header = new Uint8Array(0);
    const missing = MISSING.exec(line)?.[1];
    if (missing !== undefined) {
      frames.push({ oid: missing, unreadable: true });
      return newline + 1;
    }
    const [, oid = "", type = "", size = ""] = HEADER.exec(line) ?? [];
    if (oid === "") {
      this.#broken = true;
      frames.push({ malformed: line.slice(0, 200) });
      return chunk.length;
    }
    this.#open = {
      oid,
      isBlob: type === "blob",
      discard: type !== "blob" || Number(size) > this.#maxBytes,
      length: Number(size) + 1,
      parts: [],
      received: 0,
    };
    return newline + 1;
  }

  #readContent(
    chunk: Uint8Array,
    position: number,
    frames: Array<Frame>,
  ): number {
    const open = this.#open;
    if (open === undefined) {
      return position;
    }
    const end = Math.min(chunk.length, position + open.length - open.received);
    if (!open.discard) {
      open.parts.push(chunk.subarray(position, end));
    }
    open.received += end - position;
    if (open.received === open.length) {
      frames.push(completed(open));
      this.#open = undefined;
    }
    return end;
  }
}

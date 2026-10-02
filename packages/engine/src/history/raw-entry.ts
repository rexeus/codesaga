// Owns one `git log --raw` entry: the modes, blob ids and status git prints for a file.

/** The blob facts of a change, left out when git has none (an added file has no previous blob). */
export type BlobFields = {
  /** The file's full blob id after the commit; absent when the commit deletes it. */
  readonly oid?: string;
  /** The file's full blob id before the commit; absent when the commit adds it. */
  readonly previousOid?: string;
  /** The file's mode after the commit, as git prints it (`100644`, `120000` for a symlink, `160000` for a submodule); absent when the commit deletes it. */
  readonly mode?: string;
};

export type RawEntry = {
  /** git's status letter: `A`, `M`, `D`, `R`, `T`. */
  readonly status: string;
  readonly blob: BlobFields;
};

// `:<old mode> <new mode> <old id> <new id> <status>[<score>]`, ids unabbreviated.
const RAW_ENTRY = /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/u;
const NO_MODE = /^0+$/u;
const NO_BLOB = /^0+$/u;

/** The raw entry in `text` (without its path tokens), or undefined when it is not one. */
export const parseRawEntry = (text: string): RawEntry | undefined => {
  const match = RAW_ENTRY.exec(text);
  if (match === null) {
    return undefined;
  }
  const [, , mode = "", previousOid = "", oid = "", status = ""] = match;
  return {
    status,
    blob: {
      ...(NO_BLOB.test(oid) ? {} : { oid }),
      ...(NO_BLOB.test(previousOid) ? {} : { previousOid }),
      ...(NO_MODE.test(mode) ? {} : { mode }),
    },
  };
};

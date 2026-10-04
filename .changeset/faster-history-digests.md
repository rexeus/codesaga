---
"codesaga": patch
---

Shorten the first `analyze` of a large repository: the TypeScript and JavaScript history is digested in about half the time on Effect's 59,000 file versions (about 50 seconds instead of two minutes on a shared machine), and the digests, and so the report, are the same as before. The parse processes get smaller batches and the next batch is read while one is parsed, so none of them waits, the digest walk skips what it never reads, and the progress line on a terminal shows the time left.

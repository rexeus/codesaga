---
"codesaga": patch
---

The terminal truck factor line names three people and ends with "and N more" instead of listing everyone. Long names are cut to terminal columns (wide CJK characters and emoji count as two, combining marks as none) on whole characters, so a control character in a name or path is never shown as half an escape sequence.

---
"codesaga": patch
---

Recognise machine accounts whose name or GitHub login ends in `-bot` or `_bot`, or is `bot`, such as `effect-bot`, as bots. They no longer count as contributors or earn person badges, and appear under Bots & Agents. People named `Abbot` or `Talbot` stay people. The same rule keeps such logins out of the pull request authors and reviewers lists.

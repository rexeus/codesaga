---
"codesaga": minor
---

`codesaga analyze --github` (or `"github": true` in `.codesaga.json`) reads pull requests and reviews from GitHub. The JSON gains an optional `pullRequests` section (opened, merged and closed-unmerged counts, median hours to merge and to first review, opened and merged per month, authors and reviewers; `schemaVersion` stays 1), the terminal summary gains a "Pull requests" block and the dashboard a "Pull requests" section. The token comes from `GH_TOKEN`, `GITHUB_TOKEN` or `gh auth token`, and only the repository name and the token are sent to GitHub. Without the flag codesaga still makes no network request. A missing token or a non-GitHub `origin` exits with code 2, a rate limit or a GitHub error with code 1.

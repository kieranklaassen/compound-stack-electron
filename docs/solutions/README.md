# docs/solutions

Dated write-ups of problems that were solved here, so the next person or agent
does not find them again the slow way. One file a solution, with a kebab-case
name that says the problem, and YAML frontmatter.

## Frontmatter

```yaml
---
title: A short sentence that names the problem
module: updates         # the docs/modules/<name> it belongs to, or "none"
date: 2026-10-15        # the day the solution was written down
problem_type: bug       # gotcha | bug | performance | config | design
component: shell/main.mjs   # the file or area involved
tags: [electron, quit]  # free words to search by
applies_when: One line that says when a reader is in this situation.
---
```

## Body

Four sections, in this order:

- **Problem**: what was seen, in the words a search would use.
- **Cause**: why it happened.
- **Solution**: what was changed, and where.
- **Prevention**: the rule or the test that keeps it from coming back. Leave it
  out where there is none.

Keep a write-up to a screen or two. Say only what is true of the code as it
stands, and say what was not tried.

## Why this exists

A solution that other apps need becomes an entry in `docs/changelog/`, which an
upgrade agent applies to each app that adopted the module.

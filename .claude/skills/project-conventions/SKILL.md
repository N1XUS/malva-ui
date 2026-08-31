---
name: project-conventions
description: Use when naming files, functions, types, or variables to follow project conventions.
---

# Conventions

## Rules

### File names use camelCase. Function names use pascalCase.

**Why:** Detected from dominant pattern across project files.

**Scope:** entire project
**Trigger:** context: naming|variable|function|file
**Confidence:** 75/100

---

## Common Rationalizations

| Excuse                                                | Reality                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| My naming is clearer, the project's convention is bad | Consistency beats personal preference. Follow the project. |

## Red Flags — STOP and Reassess

- You're using a different casing than the rest of the project
- You're inventing a new naming pattern instead of following the existing one

## Source

Generated from project scan. See `.claude/skills/project.json` for full evidence trail.

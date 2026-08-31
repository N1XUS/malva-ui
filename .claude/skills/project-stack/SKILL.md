---
name: project-stack
description: Use when starting any implementation task to ensure stack-appropriate patterns are followed.
---

# Stack

## Rules

### Project uses Angular. Detected via import scanning.

**Why:** Detected during project scan via stack.frameworks.

**Scope:** entire project
**Trigger:** always (applies to all work in this project)
**Confidence:** 90/100

---

### Project uses Next.js. Detected via import scanning.

**Why:** Detected during project scan via stack.frameworks.

**Scope:** entire project
**Trigger:** always (applies to all work in this project)
**Confidence:** 90/100

---

### Project uses React. Detected via import scanning.

**Why:** Detected during project scan via stack.frameworks.

**Scope:** entire project
**Trigger:** always (applies to all work in this project)
**Confidence:** 90/100

---

### Project uses Vue. Detected via import scanning.

**Why:** Detected during project scan via stack.frameworks.

**Scope:** entire project
**Trigger:** always (applies to all work in this project)
**Confidence:** 90/100

---

## Red Flags — STOP and Reassess

- You're about to import a library that isn't already in the project dependencies
- You're choosing a framework that contradicts the detected stack

## Source

Generated from project scan. See `.claude/skills/project.json` for full evidence trail.

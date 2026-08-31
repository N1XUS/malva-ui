# Docs Page: Tokenizer

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/tokenizer`
- **Component:** `TokenizerPageComponent` (`apps/docs/src/app/pages/tokenizer/index.ts`)

## Overview

A token input component for managing lists of tags, emails, or other values with support for custom templates and validation.

## Examples

| #   | Title                       | What it demonstrates                                                      |
| --- | --------------------------- | ------------------------------------------------------------------------- |
| 1   | With label, hint & message  | Full form-field integration with label, hint text, and validation message |
| 2   | Comma-separated input       | Parsing comma-delimited text into separate tokens on input                |
| 3   | Error state                 | Validation error state rendering                                          |
| 4   | Custom template & transform | Custom token item template and value transform function                   |
| 5   | Disabled                    | Disabled state preventing interaction                                     |
| 6   | Signal forms                | `[formField]` array binding with live value and touched state             |

## Interaction notes

- **Backspace chip-selection.** With the caret in the (empty) text input, the first **Backspace** _arms_ the last chip — it turns `primary`-toned and gains a selection ring, but is **not** removed. Pressing **Backspace** (or **Delete**) again removes that chip and arms the new last one, deleting from the end one chip per press. Typing, moving the caret (Arrow/Home/End), `Enter`, blur, or clicking disarms the selection. Focus stays in the input the whole time; the armed chip is announced via a polite screen-reader live region. This is distinct from focusing a chip directly (Tab/Arrow into the token row), where Backspace/Delete removes the focused chip immediately.

## Libraries Used

- `@malva-ui/core/tokenizer` — primary component library for this page
- `@malva-ui/core/form-utils` — form field wrapper used in examples

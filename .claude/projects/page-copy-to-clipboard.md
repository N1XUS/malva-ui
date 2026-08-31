---
# Page: copy-to-clipboard

> **Keep this file up to date.** Update whenever examples, route, or sidebar entry change.

## Overview

Documentation page for the `<mlv-copy-to-clipboard>` component at `/copy-to-clipboard`.

**Route:** `copy-to-clipboard`
**Component:** `CopyToClipboardPageComponent`
**File:** `apps/docs/src/app/pages/copy-to-clipboard/index.ts`
**Sidebar group:** Components (flat list, between Calendar and Divider)
**Sidebar icon:** `LucideClipboardCheck`

---

## Examples

| #   | Title                      | File          | Description                                                                                          |
| --- | -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Basic inline usage         | `examples/1/` | `<mlv-copy-to-clipboard>` wrapping an API key inside a paragraph. Copies the projected text content. |
| 2   | Override with `[value]`    | `examples/2/` | Visible label is short (`0042`), `[value]` binds the full `ORDER-0042-7F9X2` as the copied payload.  |
| 3   | Code snippet context       | `examples/3/` | Nested inside a `<pre><code>` block for a commit SHA — shows the zero-layout-shift hover tint.       |
| 4   | Custom `copiedDuration`    | `examples/4/` | `[copiedDuration]="4000"` keeps the success state visible for 4 seconds.                             |
| 5   | Toast feedback integration | `examples/5/` | `(copied)` output wired to `MlvToastService.success()` for out-of-band confirmation.                 |

---

## Imports Used in Examples

- `@malva-ui/core/copy-to-clipboard` — `MlvCopyToClipboard`
- `@malva-ui/core/toast` — `MlvToastService` (example 5)

All examples use only the component; no extra buttons, icons, or form controls are needed in the example imports because the component ships its own icon stack and hover affordance.

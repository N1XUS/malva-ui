---
name: exports and UI component conventions
description: Always use export * from, @malva-ui components over custom, Lucide directive form for static icons
type: feedback
---

Three mandatory conventions for this codebase:

**1. Barrel exports — always `export * from`, never `export { X }`**
Every library `index.ts` must use `export * from './path'` exclusively. Named-export form is forbidden.

**Why:** User preference for consistency and simpler maintenance across all 20+ libraries.

**How to apply:** When writing or updating any `libs/*/src/index.ts`, always use star-exports. Never write `export { Foo } from './lib/foo'`.

---

**2. @malva-ui components over any custom implementation**
Never implement custom buttons, inputs, checkboxes, selects, dialogs, dropdowns, or other UI primitives. Always use the corresponding `@malva-ui/*` component.

**Why:** User caught the data-table library using hand-rolled buttons, checkboxes, and inputs instead of `button[mlvButton]`, `mlv-checkbox`, `mlv-input`, `mlv-select`.

**How to apply:** Before writing any UI element, check CLAUDE.md Libraries table for a `@malva-ui` equivalent and use it.

---

**3. Lucide icons — directive form for static icons**
Import the icon class (e.g. `LucideArrowUp`) and use it as an attribute directive: `<svg lucideArrowUp [size]="16" />`. Only use `lucide-dynamic-icon` with `[img]` when the icon variable is determined at runtime.

**Why:** User corrected usage of `lucide-dynamic-icon` with stored icon references — unnecessary indirection when the icon is statically known.

**How to apply:** `import { LucideArrowUp } from '@lucide/angular'` → add to `imports` array → `<svg lucideArrowUp [size]="N" />`.

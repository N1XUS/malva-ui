# 2026-09 — a full-screen `mlv-popup` sheet is a modal dialog

**Packages:** `@malva-ui/core/popup` (`MlvPopup`), and every consumer that opts into `mobileMode`: `mlv-select`, `mlv-combobox`, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`.
**Kind:** breaking, **behaviour only** (VERSIONING §3 row 112: changed default behaviour at an unchanged API — ARIA, and focus and `touch` timing for `mlv-select`). Nothing was renamed, removed or retyped: `panelRole` still defaults to `null`, `modal` to `false`, and no selector, input, output, token, i18n key or BEM class changes. On `0.x` the `!` releases as `0.2.0`. Fixes #322 (audit C028 / OVERLAYS-07).

---

## Why

In full-screen mode the panel traps focus (`cdkTrapFocus`), sits behind a forced solid scrim that blocks the page, and carries a close button — a modal dialog in every respect except the one assistive technology reads. Its `role`, `aria-modal` and accessible name came only from `panelRole`, `modal` and `ariaLabel`, and the visible `mobileTitle` was referenced by nothing.

`mlv-select` and `mlv-combobox` set none of the three, and `mlv-date-range-picker` set only `ariaLabel`. A VoiceOver user on a phone who opened a select landed in a trapped, **role-less, unnamed** region: no "dialog" announcement, no title, and nothing telling AT the page behind was inert (WCAG 4.1.2, 1.3.1).

No axe sweep caught it. Measured with axe-core 4.12.1: a role-less `<div>` violates no rule, and an `aria-label` on one is only `incomplete` (`aria-prohibited-attr`), so the existing full-screen sweeps of the pickers passed over it. Now that the sheet is a `dialog`, an unnamed one fails `aria-dialog-name`.

---

## What changed

### 1. The panel's ARIA while `isFullscreen()`

| Attribute         | Before                       | After (full-screen)                                                                               |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `role`            | `panelRole()` (default none) | `panelRole()` when set, else **`dialog`**                                                         |
| `aria-modal`      | `"true"` only when `modal()` | `"true"` when `modal()`, or when the resolved role is `dialog` / `alertdialog`                    |
| `aria-labelledby` | never                        | the id of `.mlv-popup__title` when `mobileTitle` is non-blank                                     |
| `aria-label`      | `ariaLabel()`                | `ariaLabel()`, **withheld** while `aria-labelledby` is emitted — one naming attribute, never both |

The **anchored** panel is byte-identical: no role unless `panelRole` is set, `aria-modal` only with `modal`, `aria-label` from `ariaLabel`.

- **`aria-modal` only on a dialog role.** It is supported on `dialog` and `alertdialog` alone; on any other role axe raises `aria-allowed-attr` (measured on `role="region"`). A consumer's explicit non-dialog `panelRole` on a sheet therefore gets no `aria-modal`.
- **The title beats `ariaLabel`: a titled sheet can only be named by its visible title.** This follows the form-control carve-out recorded in `libs-progress.md` (`mlv-radio-group` and the pickers: their own `label` beats `ariaLabel`, because a field label is an authored label). It is the reverse of `mlv-drawer` and `MlvDialogContainer`, which drop their title `aria-labelledby` for an explicit `ariaLabel` — there both are authored for the same surface. Here `ariaLabel` is mode-agnostic: it is the anchored popover's only name (that panel has no visible heading), while `mobileTitle` is written for the sheet and is on screen there. The pickers pass their own `label()` as the title, so a labelled picker's sheet announces the same name as its trigger, which already prefers `label` over `ariaLabel`. `ariaLabel` first would have announced "Select date range" under a visible "Stay dates".
- **Consumer consequence:** no input can name a titled sheet with anything but its title. An `ariaLabel` richer than the `mobileTitle` ("Filter orders by delivery date" around a visible "Filters") still names the anchored panel but is dropped on the sheet, with no escape hatch. Put the wording you want announced in `mobileTitle`, or leave `mobileTitle` unset so `ariaLabel` names the sheet.
- **A blank title does not count.** `"   "` renders an empty-looking title but does not name the sheet, so `ariaLabel` stays the name.
- **Dev warning.** A sheet that opens with neither a non-blank `mobileTitle` nor `ariaLabel` logs `[MlvPopup] A full-screen sheet opened with no accessible name…` once per open (dev mode only).

### 2. `mlv-date-range-picker`'s inner panel steps down while full-screen

The picker's `.mlv-date-range-picker__panel` carried `role="dialog"`, `aria-modal="true"` and `aria-label` in both modes. It already turned its own focus trap off while full-screen, so that the popup's trap was the only one. It now drops all three attributes there too. Otherwise the sheet would be a modal dialog nested in a modal dialog: announced twice, and the inner `aria-modal` would wall off the sheet header's title, close button and `Done`. axe does not flag the nesting (measured), so a spec pins it. Anchored, the inner panel is still the dialog, exactly as before.

### 3. What each consumer's sheet announces

| Consumer                | Before (full-screen)                                               | After (full-screen)                                                                                |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `mlv-select`            | no role, not modal, unnamed                                        | `dialog`, modal, named by `mobileTitle` → `label` → placeholder                                    |
| `mlv-combobox`          | no role, not modal, unnamed                                        | `dialog`, modal, named by `mobileTitle` → `label` → placeholder                                    |
| `mlv-date-range-picker` | no role, not modal, `aria-label` "Select date range"; inner dialog | `dialog`, modal, named by `label` → "Select date range" (the visible title); inner panel role-less |
| `mlv-day-picker`        | `dialog`, modal, `aria-label` = `label` → placeholder              | `dialog`, modal, named by the visible title: `label` → "Select day"                                |
| `mlv-time-picker`       | `dialog`, modal, `aria-label` = the resolved picker label          | `dialog`, modal, named by the visible title: `label` → the resolved picker label                   |

### 4. `mlv-select` moves focus into its sheet

A non-searchable `mlv-select` left focus on its trigger when the sheet opened, by click, Enter and ArrowDown alike. ArrowDown's `requestFocusFirst()` is a plain `Subject` emission sent before the dropdown panel exists to subscribe, so it was lost, and `afterOpened` only handed focus to the search field of a searchable select. In a role-less region that went unnoticed. Behind an `aria-modal` dialog it tells AT that everything outside the dialog is inert while focus sits outside it, on the trigger under the scrim.

The sheet now focuses the listbox's tab stop once it has opened: the first selected option it can focus, else the first option it can focus (`@angular/aria`'s default tab stop). This covers every open path. Unchanged: a searchable select still focuses its search field, the anchored dropdown still leaves focus on the trigger, and closing still returns focus to the trigger. `mlv-combobox` and the three pickers already moved focus into their sheets.

Moving focus into the sheet is not leaving the field, so it is not a touch (owner ruling D22, #347: `touch` arrives when focus leaves the control, not when it moves between the control's own parts). The trigger's blur names where focus went (`relatedTarget`). When that is inside the select's own panel, the select neither emits `touch` nor clears its focused state. `touch` arrives when focus leaves from the trigger, where closing puts it back. Picking an option still touches, as before.

The same rule fixes a pre-existing case: a **searchable** select, anchored or full-screen, emitted one `touch` on every open, because the search field taking focus blurred the trigger. It now emits none. A required searchable select opened and closed without a pick is no longer touched on open; its error shows once the user leaves the field, as it does for every other control.

### 5. Other surfaces

`mlv-menu` and `mlv-color-picker-popup` never go full-screen and are unaffected. In the docs app, the app-bar preferences popup (`panelRole="dialog"`, `mobileMode="auto"`, no `modal`) gains `aria-modal` below `md`. Popup example 8 is unchanged in effect: same role, modality and name text, now reached through `aria-labelledby`.

---

## Consumer action

- **Nothing**, for a sheet with a `mobileTitle`, or for any Malva control above.
- **A custom full-screen popup with no `mobileTitle`:** set one (it is the visible heading and the name), or set `ariaLabel` if the sheet genuinely has no heading. Otherwise it is now an unnamed dialog: dev mode warns, and axe fails `aria-dialog-name`.
- **A sheet you already named with `ariaLabel` and also gave a different `mobileTitle`:** the title is the name now. Make the title say what you want announced.
- **`panelRole` set to something other than `dialog` / `alertdialog` on a popup that can go full-screen:** it is kept, but the sheet gets no `aria-modal`. Use `dialog` unless the content genuinely is something else.
- **Specs that expect a full-screen `mlv-select` to leave `document.activeElement` on the trigger:** after the open settles, focus is on the selected option (or the first). Assert the trigger regains focus after close instead.
- **Specs or code that expect a searchable `mlv-select` to emit `touch` (or mark its `[formField]` touched) when it opens:** it emits none now (§ 4). Move focus off the trigger after closing, or pick an option, to get the `touch`.
- **Specs** that asserted `role` absent, `aria-label="…"` or no `aria-modal` on a full-screen `.mlv-popup`: assert `role="dialog"`, `aria-modal="true"` and the resolved name (`aria-labelledby` → the title's text) instead. Specs that assert the inner `.mlv-date-range-picker__panel` is a dialog hold only while it is anchored.

---

## Not changed

- The anchored panel, in every consumer.
- `cdkTrapFocus` (still `modal() || isFullscreen()`), the header markup (the title stays a `<span>`, gaining only an `id`), the close button and its label.
- Every other generated id on the page. The title id is allocated only when a titled sheet first renders, so anchored-only popups take no number from the shared `mlvNextId` counter.
- `modal()` on a role-less anchored panel still emits `aria-modal`, which axe flags (`aria-allowed-attr`, measured). No shipped surface does this: every `[modal]="true"` in `libs/` and `apps/docs` also sets `panelRole="dialog"`.
- Where focus lands when the sheet opens is still each consumer's own `afterOpened` handler. `MlvPopup` moves none. Only `mlv-select`'s handler changed (§ 4).

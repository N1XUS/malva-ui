# 2026-09 — a control reports touched when focus leaves it

Applies to `@malva-ui/core/form-utils` (`MlvSignalFormUiControlBase`),
`@malva-ui/core/pin-input` (`MlvPinInput`), `@malva-ui/core/radio`
(`MlvRadioGroup`), `@malva-ui/core/segmented` (`MlvSegmented`),
`@malva-ui/core/rating` (`MlvRating`), `@malva-ui/core/slider` (`MlvSlider`),
`@malva-ui/core/color-picker` (`MlvColorPicker`), `@malva-ui/core/file-upload`
(`MlvFileUpload`) and `@malva-ui/core/tokenizer` (`MlvTokenizer`). Fixes #347
(audit C054, findings FC-11 and FC-15, owner decision D22).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
model, injection token, i18n key or BEM class was renamed, removed or retyped.
The `touch` output keeps its name and its `void` payload; what changes is
_when_ it emits. The base gains three `protected` helpers,
`_focusLeavesControl()`, `_focusIsInsideControl()` and
`_reportTouchOnFocusLeave()`. None is abstract, so no subclass owes anything
(`VERSIONING.md` § 2.4). Two `_`-prefixed template handlers are gone:
`MlvPinInput._onCellBlur` and `MlvSlider._onThumbBlur`. `_`-prefixed members
are not public.

The major is `VERSIONING.md` § 3 row 112: _"Changed **default behaviour** at an
unchanged API — ordering, timing, emitted events, focus …"_. The ticket names
row 111, which is wrong: 111 is a changed default **value** of an input. On the
`0.x` line the `!` releases as `0.2.0` (§ 7).

---

## 1. The contract

The eight controls in the table below report touched when focus leaves the
**control** or group, and `focused()` goes `false` at the same moment. A move
between the control's own parts reports nothing, and neither does a selection.
Two kinds of input still report on their own, both deliberate:

- **A pointer gesture that leaves no focus inside.** The slider's drag end and
  the colour picker's canvas `pointerup` touch only when focus is not inside
  the control at release (`_focusIsInsideControl()`); otherwise touched waits
  for focus to leave. A press on the slider's track, or a canvas drag while
  focus is elsewhere, never reaches the focus-leave report, so its end is the
  only "done" signal a mouse user gives.
- **The tokenizer's clear button.** Clearing touches at once (#301), as it
  does on every `clearable` control. All clear buttons move together in the
  follow-up (§ 4).

The contract covers these eight. Every other control keeps its own timing, and
some of those still touch while focus stays inside them — see _Unchanged_ below
and § 4.

Why it matters: `resolvedState()` resolves to `error` when `errors` is non-empty
and `touched` is set (#320). So the timing of touched is the timing of the red
paint, of `aria-invalid="true"`, and of `mlv-form-field`'s announced error.

| Control                 | `touch` before                                                                                                                                                                                                                                             | `touch` after                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlv-pin-input`         | Every cell blur, auto-advance included. After one digit, a `minLength(6)` code painted every cell `error` (FC-11). `focused()` flickered `false` → `true` on every digit.                                                                                  | Focus leaves the row. `focused()` stays `true` from cell to cell.                                                                                                                                                                                                                                                                                                                                                                           |
| `mlv-radio-group`       | Only inside `selectRadio`, meaning a click, arrow or Space. Never on leaving, so a required group the user tabbed through showed no error until submit. Touched and valid always arrived together (FC-15).                                                 | Focus leaves the group, chosen or not. Never on a selection.                                                                                                                                                                                                                                                                                                                                                                                |
| `mlv-segmented` (radio) | Every selection (click, arrows, Home / End).                                                                                                                                                                                                               | Focus leaves the track. Link mode still emits nothing.                                                                                                                                                                                                                                                                                                                                                                                      |
| `mlv-rating`            | Any star `blur`, except the arrow-key move from #314: a pointer press on another star, or between two stars, which focuses the host.                                                                                                                       | Focus leaves the rating.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mlv-slider`            | Each thumb's `blur`, so Tab from the start thumb to the end thumb touched. Also every pointer drag end, a thumb drag included, while the pressed thumb still had focus.                                                                                    | Focus leaves the slider. A drag end touches only if focus is not in the slider: a track press focuses nothing and still touches at release; a thumb press focuses the thumb (Chromium, Firefox and WebKit measured), so touched waits for focus to leave.                                                                                                                                                                                   |
| `mlv-color-picker`      | Host `(focusout)` on every inner move: canvas → hue → mode tabs → HEX field. Also every canvas `pointerup`.                                                                                                                                                | Focus leaves the panel. A canvas drag moves no focus (its `pointerdown` is `preventDefault()`ed; measured in all three engines), so its `pointerup` touches only when focus is outside the picker; with one of the picker's own inputs focused, touched waits.                                                                                                                                                                              |
| `mlv-file-upload`       | Host `(focusout)` on every inner move: browse button → a file's remove button.                                                                                                                                                                             | Focus leaves the zone.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `mlv-tokenizer`         | **Never, in a browser.** `(focus)` / `(blur)` were bound on the `<mlv-input>` element, and those events do not bubble. `focused()` was never `true` and the `--focused` ring never drew. Only specs that called `onInputBlur()` directly ever saw a touch. | Focus leaves the tokenizer. `focused()` is `true` while inside, so the ring draws. Disabling it while its input has focus removes the input and counts as leaving: `focused()` clears and `touch` emits once in every engine (Firefox and WebKit fire no `focusout` for a removed element). The clear button still touches on clear. Also newly live: `onInputBlur()` now runs in a browser, so a token armed by Backspace disarms on blur. |

Unchanged — and not all of it matches the contract:

- **`mlv-checkbox`, `mlv-switch`, editable `mlv-title`.** One focusable element each; they touch on its native `blur`, which is focus leaving the control.
- **`mlv-input`, `mlv-textarea`, `mlv-number-input`.** They touch on the native input's `blur`. With `clearable`, the wrapper renders a tabbable clear button **inside** the host, so Tab or a press from the input to that button touches while focus stays in the control: an invalid value turns `error` and `aria-invalid="true"` before the user has left (measured on `mlv-input`). A focusable element projected into a prepend / append slot behaves the same. Their clear buttons also touch on clear. Follow-up (§ 4).
- **`mlv-select`, `mlv-combobox`.** Besides the trigger / input `blur`, both touch on **every selection, in every mode**: `mlv-select`'s `_commitSelection` and `mlv-combobox`'s `_emitValue` call it while focus is still on the trigger or input, so a value that fails a validator — the last option of a required multi-select deselected, a disallowed choice — paints `error` at once, not when the user moves on. Their clear buttons touch on clear, and `clearable` puts them in the same shape as the text inputs above. Follow-up (§ 4).
- **`mlv-checkbox-group` / `mlv-switch-group`.** They are not form controls; each child touches on its own blur.
- **`updateOn`.** Angular's custom-control interop (`ngControlCreate` in `@angular/forms`) calls `setValue` on every model change and `markAsTouched()` on `touch`. `updateOn: 'blur'` never delayed a Malva signal control's value, so nothing moves there.

## 2. What counts as leaving

`MlvSignalFormUiControlBase._focusLeavesControl(event, ...containers)` reads the
`focusout`'s `relatedTarget` synchronously:

- **Inside the host, or inside a container → not leaving.**
  - A shadow root nested in the control is covered: the browser retargets `relatedTarget` to its host. No `composedPath()` walk.
  - `containers` are elements owned by the control but outside its host, such as a portaled pane. No adopter passes one yet.
- **An element outside → leaving.**
- **No element → leaving.** Browsers send `null`; jsdom sends the `Document` for `el.blur()`. The cases: a click on non-focusable space, `el.blur()`, a focused element removed (Chromium), and a window or tab switch.
  - Why a window switch counts: telling it apart would mean trusting `document.activeElement` during `focusout`. That reads `body` for every real focus move in Chromium, Firefox and WebKit (measured).
  - Counting it also matches the controls that touch on a native `blur`, which fires on a window switch too, and Angular's own value accessors.

`_reportTouchOnFocusLeave({ enabled?, containers? })` wires this up.

- The constructor calls it once.
- It listens with `fromEvent(host, 'focusout')` and `takeUntilDestroyed`.
- With `containers`, it also listens on the injected `DOCUMENT` for a `focusout` or `pointerdown` whose target is inside a container: a container sits outside the host, so neither event reaches the host from there. Focus leaving a container for anywhere else then counts as leaving. A container inside a shadow root is not seen from the document.
- On leaving it calls `setFocused(false)` and then emits `touch`.
- `enabled` switches it off. `mlv-segmented` uses that for link mode, `mlv-tokenizer` while disabled.

`_focusIsInsideControl(...containers)` answers the same question after the fact,
from the root-aware `activeElement`: the slider and colour picker read it at the
end of a pointer gesture.

**One exception: a pointer press inside the control.**

- The problem. `mousedown` on a non-focusable part moves focus to the press target's nearest focusable ancestor. On the docs app that is `main[mlvPage]`, which is `tabindex="-1"`; with no such ancestor it goes to no element. Measured with Playwright in Chromium, Firefox and WebKit.
- A click on an `mlv-radio`'s label therefore blurs the focused radio at `mousedown` and focuses the chosen radio only at `click`, after the click listeners. Decided on the spot, that touched the group mid-choice.
- The fix: a capture `pointerdown` inside the control opens a press. The press ends at the first of:
  - `click`
  - `pointercancel`
  - 500 ms after `pointerup`, for a press that no `click` follows
- The press listeners are bound to the injected `DOCUMENT`, not the ambient global, and are released at the press's end or on destroy.
- While a press is open, a `focusout` to no element or to an ancestor of the host (or of a container) is held. When the press ends, the base waits one task, so the label's own focus move can run. It then reads the root-aware `activeElement`, and reports leaving only if focus is not back inside.
- Every other `focusout` is decided on the spot, including one to a named outside element during a press.
- Limit: the ancestor test does not cross a shadow boundary. Inside a shadow root, an ancestor beyond it counts as leaving.

## 3. Who is affected

- **(a) Specs that simulated leaving on one part.** They used to dispatch `blur` or `focusout` naming another part, or call `onInputBlur()` / `_onCellBlur()` / `_onThumbBlur()`. Now:
  - A `focusout` naming another part of the same control reports nothing.
  - `MlvTokenizer.onInputBlur()` only disarms.
  - The two `_` handlers no longer exist, so a bracket access to them fails.
  - A `focusout` naming no element, and jsdom's `el.blur()`, still count as leaving.
  - **Do:** move focus to a real element outside the control (`outside.focus()`). Every `*-binding-matrix.spec.ts` in this change does that now.
- **(b) Code reading `touched` as "a choice was made"** on `mlv-radio-group` or `mlv-segmented`. That covers an error or a Save button keyed on `touched` right after a click, and `(touch)` used as a selection event. Now `touched` arrives when the user moves on.
  - **Do:** use `valueChange` / `(ngModelChange)` / the field's value for selection.
  - A required group now shows its error when the user tabs out without choosing. That is the fix.
- **(c) Live validation on `mlv-pin-input`.** Anything that relied on the error appearing after the first digit now waits until focus leaves the row.
  - **Do:** key the state on `dirty` instead of `touched` (`ctrl.invalid && ctrl.dirty`) if you want the error while typing.
- **(d) `mlv-tokenizer` in a browser.** `touched` now arrives and the `--focused` ring now draws.
  - A consumer who worked around the missing touch, for example a host `(focusout)` calling `markAsTouched()`, now marks twice. That is harmless, because marking is idempotent.
  - A token armed by Backspace now disarms when the input loses focus. `onInputBlur()` always did that, but no browser reached it before; a flow that pressed Backspace, left the input and came back expecting the arm to survive never worked outside a spec.
  - **Do:** delete the workaround. Re-check any snapshot or visual test that captured an unfocused-looking tokenizer while it was focused.
- **(e) A synchronous assertion right after a pointer press.** When a press moves focus to an ancestor or to nowhere, the verdict now waits for the `click` plus one task, or up to 500 ms after a `pointerup` that no `click` follows.
  - **Do:** await a task (`await new Promise((r) => setTimeout(r))`) before asserting `touched`.
- **(f) Pointer drags on `mlv-slider` and `mlv-color-picker`.** A thumb drag, or a canvas drag with one of the picker's own inputs focused, no longer touches at release; touched arrives when focus leaves.
  - **Do:** if a spec asserted `touched` right after a thumb drag, move focus outside first. Code that wants "the user moved it" reads `dirty` or the value.

## 4. Not changed here — follow-ups

These controls still touch while focus stays inside them, or on an action rather than on leaving. Each needs its own change:

- **Clear buttons and slot content of single-input controls.** `mlv-input`, `mlv-textarea`, `mlv-number-input`, and `clearable` `mlv-select` / `mlv-combobox` / `mlv-tokenizer` / the pickers: a move from the input to the control's own clear button (or a focusable prepend / append) touches, and clearing touches at once. Fix: adopt `_reportTouchOnFocusLeave` through `mlv-form-control-wrapper`'s consumers, and decide whether a clear is a leave.
- **`mlv-select` / `mlv-combobox` — every mode.** `_commitSelection` / `_emitValue` touch on every selection. On top of that, a full-screen combobox moves focus from trigger to in-sheet input on open, and that hand-off touches. A searchable select's hand-off to its in-panel search field no longer touches: the trigger's blur into the select's own panel is skipped (#322, [2026-09-popup-fullscreen-dialog-semantics.md](2026-09-popup-fullscreen-dialog-semantics.md) § 4). Fix: drop the selection-time touch and pass the popup as a container.
- **`mlv-day-picker` / `mlv-time-picker` / `mlv-date-range-picker`**
  - The trigger's blur into its own popup touches on open.
  - `_onPopupClosed` touches while focus is returning to the trigger.
- **`mlv-color-picker-popup`:** input → panel touches, and Escape touches while focus stays.
- **`mlv-color-picker`:** its mode tab group's overflow popup is portaled, so focus moving into it counts as leaving.
- **`mlv-editor`:** has its own null-`relatedTarget` policy.
- **`mlv-tokenizer`:** a token focused from outside, never through the text input, does not set `focused()`.

## 5. Verification

- **Unit specs.**
  - `focus-leaves-control.spec.ts` (form-utils) covers: part ↔ part, leaving, `null`, `el.blur()`, a nested shadow root, the four press paths, the 500 ms fallback, `pointercancel`, a named element during a press, and containers — through the helper and through real `focusout`s into, within and out of a portaled pane, including a press inside it. It pins the injected `DOCUMENT` (an isolated `createHTMLDocument()` receives the press and container listeners, the global none, and a destroy mid-press releases them). Ablating the one-task wait, the deferral, the ancestor clause, the `DOCUMENT` injection, or any of the container listeners turns it red.
  - One `*-touched.spec.ts` per adopter. The pin-input spec pins `touched() === false` with `focused()` still true after a digit, then touched after an outside blur. The radio-group spec pins focus-in-and-out touching with no value, a selection not touching, and a label press not touching. The slider and colour-picker specs pin both halves of the drag-end rule; the tokenizer spec pins disabling with focus inside (one touch, no focus ring) and the extra `focusout` Chromium sends for the removed input.
- **#320 re-verified.** `radio-group-validation`, `rating-validation`, `slider-validation`, and the checkbox, switch and form-utils validation specs pass unchanged.
- **Real browsers.** Playwright on the docs app, in Chromium, Firefox and WebKit. Every engine gave the same counts:
  - pin-input: after a digit, 0 touches with `focused()` still true; leaving gives 1.
  - radio: arrow gives 0, label click gives 0, Tab out gives 1.
  - segmented and rating: moves give 0, leaving gives 1.
  - slider: thumb → thumb gives 0 with `focused()` still true; Tab out gives 1.
  - color-picker: inner Tabs give 0, leaving gives 1.
  - tokenizer: `focused()` is true, input → token gives 0, leaving gives 1.
  - Pressing a thumb-like focusable element focuses it by `pointerup`; a `preventDefault()`ed canvas press leaves focus where it was; a track press moves it to the focusable ancestor — the basis of the drag-end rule (static probe, all three engines).

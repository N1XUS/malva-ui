# 2026-09 — an empty `mlv-time-picker` renders as empty, not as the current time

Applies to `@malva-ui/core/time-picker` (`MlvTimePicker`) and, through it,
`@malva-ui/core/scrubber` (`MlvScrubber`) and `@malva-ui/i18n`
(`MlvTimePickerI18n`). Fixes #348 (owner ruling D4, option (c)).

**Breaking — behaviour, plus one type-level read case** (`MlvScrubber.selectedValue()`
now reads `T | null`, so `const v: number = scrubber.selectedValue()` fails
TS2322 — row 115, shape (f)). No exported symbol, selector, input, output,
model, injection token, BEM class, `--mlv-*` token or i18n key was renamed,
removed or narrowed. `value` keeps its name, its `string` type and its `''`
default, and a held value renders exactly as before. What moves is what an
**empty** value (`''`, or `null` from a non-strict form) renders, and what the
first pick from it commits.

Classified under `VERSIONING.md` § 3:

- **Row 112** — _Changed default behaviour at an unchanged API — … ARIA, what a
  value means_ — for the empty value: what the trigger shows and exposes, what
  the drums mark selected, and what the first pick commits. The issue says row
  111, which is a changed default **value**; no input default moved.
- **Row 115** — _New optional input; widened input type; new optional i18n key
  with a shipped default_ — for `placeholder` and `defaultToNow` on the time
  picker, `MlvScrubber.selectedValue` widening from `T` to `T | null`, and the
  optional `MlvTimePickerI18n.placeholder` key (all 14 shipped packs declare
  it).
- **Row 114** — _New … BEM modifier_ — for the new element class
  `.mlv-time-picker__placeholder`.

On the `0.x` line a `!` commit is demoted to a minor: `0.2.0` → `0.3.0` (§ 7).

## 1. What changed

**Before.** `_applyValue('')` seeded the working time from `new Date()`. An
empty picker therefore:

- showed the wall clock in its trigger (`.mlv-time-picker__value`), looking
  exactly like a chosen time while `value` was `''`;
- opened with that time marked `aria-selected` in every drum (and AM or PM
  pressed in 12-hour mode);
- committed the rest of the wall clock with the first pick — at 14:37, picking
  minute 30 wrote `'14:30'`, an hour nobody chose;
- rendered one clock on the server and another on the client, and read the
  global `Date`, not the date adapter.

**After.**

- **Trigger:** the value while one is held, otherwise
  `.mlv-time-picker__placeholder` — `placeholder` input → the pack's
  `timePicker.placeholder` → the English "Select time...". Placeholder colour
  is `--mlv-text-tertiary`, as on `mlv-day-picker`. The trigger's accessible
  name is unchanged (its label, through `aria-labelledby`), but Chromium
  exposes the `role="combobox"` trigger's text as its **value**, so an empty
  picker now reads as its placeholder instead of a time — measured in
  Chromium 153 through CDP `Accessibility.getFullAXTree` on docs example 9:
  `combobox "Reminder"` value `"No reminder"`, `combobox "Arrival"` value
  `"Select time..."`, and `"01:00"` once a time is picked. The old value (the
  wall clock) follows from the old trigger text; it was not measured.
  Firefox and WebKit were not measured.
- **Drums:** no option `aria-selected`, no `.mlv-scrubber__item--selected`,
  neither AM nor PM pressed. The model stays `''`: opening, closing and moving
  focus between drums write nothing. `hasValue()` is `false` (it has read the
  model since #301).
- **First pick:** commits a whole time from the drums' resting position — the
  first item of each: `00`, or `01` AM in 12-hour mode, minutes and seconds
  `00`. Minute 30 → `'00:30'`; PM first in 12-hour mode → `'13:00'`; Home on an
  empty drum commits its first item.
- **`defaultToNow`** (new, opt-in): each time an empty picker opens, its drums
  are seeded from the date adapter's `now()` (`MLV_DATE_ADAPTER`, falling back
  to `MlvNativeDateAdapter` — never `new Date()`). Hours and minutes only;
  seconds seed as `00`, since `MlvDateAdapter` reads no seconds. The seed is a
  starting point, not a value: the model stays `''` and the trigger keeps its
  placeholder until a drum or the period changes. A held value is never
  replaced. Accepting the seed exactly takes a change: a click on the
  already-selected option is dropped by the scrubber's echo guard, and Enter /
  Space are not bound in a drum (aria binds them only when selection does not
  follow focus); the 12-hour period buttons are the exception, since they
  always emit.
- **`mlv-scrubber`:** `selectedValue` accepts `null` for **no selection**. The
  strip does not scroll when the selection goes away (a programmatic scroll
  would come back through its scroll read-back and select whatever it landed
  on), drops a read-back still pending from an earlier scroll, and it stays in
  aria's `explicit` selection mode until its first focus, so aria's
  default-state pass does not select the first item on its own.
  Activating any item from `null` emits it, the resting one included.

## 2. Who is affected, and what to do

**(a) Specs and snapshots that expect a time on an empty picker** — the
trigger's text, `aria-selected` options, a pressed period, or a scripted
keydown at an unfocused drum committing a value.

**Do:** expect `.mlv-time-picker__placeholder` and no selected option. To test
the drums from a known time, set `value`; to test `defaultToNow`, provide a
stub adapter with `provideMlvDateAdapter(…)` whose `now()` returns a fixed
date. Focus a drum before sending it arrow keys, as a user does — with no
selection, an unfocused drum's arrows only move the active option.

**(b) Apps that relied on an empty picker opening at the current time.**

**Do:** add `defaultToNow`. It seeds the drums only; if the current time should
be the **value** (shown in the trigger and submitted), write it into the model
yourself.

**(c) Code that relied on the first pick keeping the other columns at the
current time** — picking a minute on an empty picker used to keep today's
hour.

**Do:** add `defaultToNow`, or seed `value`. Without either, the untouched
columns commit their resting position (`00`, or `01` AM).

**(d) Specs that pinned the picker's clock by faking the global `Date`.**

**Do:** provide a date adapter instead. The picker no longer reads `Date` at
all; `defaultToNow` reads `adapter.now()`.

**(e) A hand-written `MlvLanguage` pack.** It still compiles — `placeholder` is
optional — but an empty picker then shows the English "Select time..." in a
non-English UI.

**Do:** add `timePicker.placeholder` to the pack.

**(f) `mlv-scrubber` consumers.** A `null` `selectedValue` now means no
selection (a non-strict template could pass one before; it rendered the first
item selected and emitted it). Code reading `selectedValue()` off a scrubber
instance from TypeScript now sees `T | null` — a type-level break for a
read typed as `T` (TS2322).

**Do:** use a real item for a selected strip; narrow the read (`?? fallback`).
`null` cannot be an item value any more.

**(g) Layouts sized to the trigger's text.** The placeholder is usually wider
than `HH:mm`, and an empty trigger now shows it.

**Do:** nothing, unless the trigger sits in a tight inline row; give the
picker a width there.

## 3. In the repository

- No in-repo picker renders an empty value: docs examples 1–8, the
  settings-access showcase and `ssr-smoke.spec.ts` all hold one. Docs example 9
  (_Empty value_) is new and shows both `placeholder` and `defaultToNow`.
- `time-picker.spec.ts`'s two "defaults to the current time" cases became one
  `it.each` asserting empty drums and no time in the trigger;
  `time-picker-clear.spec.ts` now expects the placeholder after a clear; the
  a11y suite's default host is empty, so it gains a sweep with a value held.
- `core-scrubber` leaves `ROLLOUT_PENDING` in `scripts/check-axe-coverage.mjs`:
  its first axe sweep (no selection) arrived with this change, and
  `scrubber-a11y.spec.ts` gains the other states that change the markup —
  selected, disabled, horizontal, three sibling strips.
- New `time-picker-empty.spec.ts` (22 cases; the global `Date` is faked to
  14:37:52 and the adapter stubbed at 09:41, so a picker still reading the
  system clock is caught) and `scrubber-empty.spec.ts` (10).

## 4. Not changed

- The value format (`HH:mm` / `HH:mm:ss`, always 24-hour), `mode`,
  `showSeconds`, `ariaLabel`, `clearable` and the clear button, `hasValue()`,
  `touch` timing.
- The trigger's accessible name (its value changes on an empty picker — § 1),
  and every name inside the panel.
- A picker holding a value: trigger, drums and period are identical.
- The scrubber with a non-`null` `selectedValue`: `follow` selection mode,
  scroll-to-value, echo guarding — all as before.

## 5. Known limitation

Switching `mode` from 24h to 12h while an **empty** picker is open, with focus
in the hour drum, can commit `01:00` with no user input: `@angular/aria`
re-runs its default-selection pass when the active option leaves the list, and
that pass is not gated on interaction. Only a consumer flipping `mode` under an
open, empty picker reaches it. **Do:** do not change `mode` while the popup is
open, or reset the value after the switch.

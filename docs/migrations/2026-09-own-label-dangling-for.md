# 2026-09 — a control's own `<mlv-label>` stops emitting a dangling `for`

Applies to `@malva-ui/core/select`, `@malva-ui/core/day-picker`,
`@malva-ui/core/time-picker`, `@malva-ui/core/date-range-picker`,
`@malva-ui/core/input`, `@malva-ui/core/tokenizer` and `@malva-ui/editor`, plus
the shared base in `@malva-ui/core/form-utils`. Fixes #216.

**Breaking, behaviour only.** Nothing exported was renamed, removed or retyped;
no barrel changes; no input, output, model, token or i18n key changes. Two
things move: a `for` attribute that named nothing disappears, and the three
date/time pickers' own labels become clickable. Almost every consumer edits
nothing.

## 1. What changed

#197 built the mechanism that decides whether `<label for>` can name a control:
`MlvFormControlLabelTarget.labelable`, and `MlvLabel._resolvedFor()` which
emits **no** attribute when nothing labelable resolves. It only reached labels
**projected into** `mlv-form-field`. `_resolvedFor()` returns an explicit
`[for]` first, so a control that renders its own `<mlv-label [for]="id()">`
short-circuited the whole thing and kept emitting the attribute wherever its
`id` happened to sit.

`<label for>` names only an HTML **labelable** element — `button`, `input`,
`meter`, `output`, `progress`, `select`, `textarea`. Pointing it at a `div`, or
at an id no element carries, produces an attribute that reads as an association
in review while naming nothing and focusing nothing. Nothing catches it: axe's
`label` and `aria-input-field-name` rules ask whether the control **has** a
name, and every one of these controls already had one from `aria-labelledby`,
so a full sweep stayed green with the defect present.

| Control                      | Where its own `for` pointed                                   | Now                |
| ---------------------------- | ------------------------------------------------------------- | ------------------ |
| `mlv-select`                 | `div[role="combobox"\|"button"]` behind the custom trigger    | no attribute       |
| `mlv-select` (native mode)   | its native `<select>` — a real association                    | unchanged          |
| `mlv-day-picker`             | trigger `div[role="combobox"]`                                | no attribute       |
| `mlv-time-picker`            | trigger `div[role="combobox"]`                                | no attribute       |
| `mlv-date-range-picker`      | trigger `div[role="button"]`                                  | no attribute       |
| `mlv-input` `projectControl` | an id no element carries — see the note under this table      | no attribute       |
| `mlv-tokenizer` disabled     | an id no element carries (the inner input is not rendered)    | no attribute       |
| `mlv-editor`                 | an id no element carries (ProseMirror's contenteditable)      | no attribute       |
| `mlv-combobox`               | the inner `mlv-input`'s native `<input>` — a real association | unchanged (see §4) |

`mlv-input` with `projectControl` is the one row whose _reason_ is worth
stating precisely, because it is two defects deep. The intended shape is that
the native input is the consumer's own and carries the consumer's id, which
`mlv-input` does not know — so `[for]="id()"` named nothing. Measured while
reviewing this change: until **#256** the wrapped (non-`bare`) `projectControl`
shape rendered **no input at all**. `input.html` declared
`<ng-content select="input[mlvInputNative]" />` twice — once in the `bare()`
branch, once in the wrapped branch — and Angular binds a projected node to the
first matching slot, so the wrapped shape projected into a slot that was never
stamped. #256 landed first and the shape renders now, which is what makes this
change observable there at all; it was correct either way, because
`_ownLabelFor()` resolves from `_externalLabelStrategy()`, which is `'none'` for
`projectControl` whether or not the projected input is stamped.

**The accessible name does not change anywhere.** All of these already carry
`aria-labelledby` (or, for `mlv-input`/`mlv-tokenizer`/`mlv-combobox` on the
labelable path, a `for` that is kept). What is removed is the false signal, not
a name.

## 2. Mechanism

`MlvSignalFormUiControlBase` gains one protected computed:

```ts
protected readonly _ownLabelFor = computed<string | null>(() => {
  const target = this.labelTarget();
  return target?.labelable ? target.id : null;
});
```

Templates bind `[for]="_ownLabelFor()"` instead of `[for]="id()"`. The question
a control's own label asks — "is the id I would point `for` at on an element
`<label for>` can name?" — is the one `labelTarget` already answers for the
projected case, so both now read one source of truth instead of each deciding
again. It has to be a signal, not a constant: `mlv-select` flips between
`'native'` and `'aria'` as its native `<select>` takes over, and the `for` has
to follow.

Unchanged and deliberately not converted: `mlv-pin-input` points its own `for`
at its **first cell** (`_cellId(0)`), which is not its `labelTarget`;
`mlv-color-picker-popup` renders its label only inside the `field`-presentation
branch that also renders the labelable input, so `[for]="id()"` there can never
dangle; `mlv-textarea` and `mlv-number-input` are unconditionally `'native'`.

## 3. Click-to-focus

A dangling `for` cost more than a false signal: it also meant no native
click-to-focus, so these visible labels were **inert**. Every control in the
list whose focus target is real but not labelable now binds
`(click)="_onLabelClick()"` on its own `<mlv-label>`:

| Control                                                      | On label click                                   |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker` | focuses the trigger `div`                        |
| `mlv-editor`                                                 | focuses ProseMirror's content                    |
| `mlv-select`                                                 | **opens** the dropdown — pre-existing, untouched |

The three pickers focus only: opening is more than a native `<label>` click
does, and they open a modal panel. `mlv-editor` goes through Tiptap's `focus`
command, which restores the stored selection instead of dropping the caret at
the document start; it stays focusable while `readonly` (a read-only
`<textarea>` is) and returns early while `computedDisabled()`.

Nothing is added where there is nothing to focus: `mlv-input` with
`projectControl` and a disabled `mlv-tokenizer` have no focus target of their
own — see §4.3 for the former.

## 4. What a consumer may need to do

Four shapes, all narrow:

1. **CSS or a query keyed on the attribute.** `label[for]`,
   `label[for="…"]`, `.mlv-label label[for]` no longer match on the eight rows
   above. Select the `<label>` itself (`.mlv-label label`) or the
   `<mlv-label>` host. There are zero such selectors in `libs/` and `apps/`.
2. **A test asserting the old id.** `expect(label.getAttribute('for')).toBe(control.id())`
   against any of the affected controls now reads `null`. The assertion that
   holds after #197 is `label.hasAttribute('for')`, and the name is asserted
   through `aria-labelledby`.
3. **`mlv-input` with `projectControl`, and the name it still owes.** The
   visible `<mlv-label>` this control renders from its `label` input is now
   associated with **nothing**: it emits no `for`, and `mlv-input` publishes no
   `aria-labelledby` for a control it does not own. Before, it emitted a `for`
   that resolved to nothing — so no accessible name is lost, but none is gained
   either, and nothing warns (`MlvFormField`'s "names nothing" warning covers
   only labels **projected into a field**, not a control's own).

   The reason is that `_ownLabelFor()` reuses `_externalLabelStrategy()`, which
   answers "may a label **outside** me name me" — `'none'` here, correctly,
   since `mlv-input` cannot publish an id it does not know. For a control's
   _own_ label the two questions genuinely diverge: the consumer's `<input>`
   **is** labelable; only its id is unknown. Closing that gap means letting the
   consumer hand the id in (or letting `mlv-input` read it off the projected
   node), which is **#259**, decided on top of `_ownLabelFor()` rather than
   instead of it. Until then, name a projected
   control yourself — `aria-label` / `aria-labelledby` on your own `<input>`,
   or your own `<label for>`.

4. **A click handler on a label.** A consumer who bound their own `(click)` on
   a projected wrapper around the label of one of the three pickers, or of
   `mlv-editor`, now also gets the control focused (§3). Nothing in `libs/` or
   `apps/` does.

`mlv-combobox` was named in #216 but was already correct: its `id` is forwarded
to the inner `mlv-input`, which puts it on a native `<input>`. It moves to
`_ownLabelFor()` for one source of truth and its rendered markup is unchanged;
`combobox-own-label.spec.ts` pins that, so a future change moving `id()` onto
its `__trigger` div fails loudly instead of silently dropping the name.

## 5. Adjacent

`core-day-picker`, `core-time-picker` and `core-date-range-picker` leave
`ROLLOUT_PENDING` in `scripts/check-axe-coverage.mjs`: each ships its first
`expectNoAxeViolations` sweeps here, and each declares exactly one component,
so nothing in those projects is left with neither coverage nor a tracker.

The sweeps are **open-state**, in a new `*-a11y.spec.ts` per project, not only
the closed trigger the own-label suites render. `.claude/rules/accessibility.md`
asks for one sweep per state that changes the markup, and for overlay content
to be swept from `document.body` because the pane is portaled out of the
fixture — and the calendar grid, the two-panel range view, the drum columns,
the AM/PM pair and the full-screen `mlv-calendar-sheet` are the whole
interactive surface of these three components and exist only while open. Each
project sweeps closed, open-anchored and open-sheet (the time picker also
sweeps 12h + seconds, which changes the column count and adds the AM/PM
buttons). A closed-only sweep would have satisfied the guard while leaving all
of that unswept, and — before #257 — the guard raised `stale-rollout` on a
`ROLLOUT_PENDING` entry whose project had gained _any_ sweep, so it could never
have asked for the rest afterwards. (Since #257 a partially-swept project keeps
its entry as `{ project, owes: [...] }` instead; a bare entry is still the
"nothing swept" shape and still goes stale on the first sweep.)

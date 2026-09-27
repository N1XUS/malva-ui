# 2026-09 — a range `mlv-slider` emits once per change

Applies to `@malva-ui/core/slider` (`MlvSlider`, `mlv-slider`) with `range`
set. Ships with #338 (drag gestures end on `pointercancel`, lost capture and
destroy).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped. The selector, every input, the `value` model and its
`MlvSliderValue` type, the keyboard map and every BEM class are unchanged, and
a single-thumb slider behaves exactly as before. What changes is how many
times a **range** slider emits `valueChange` — and so writes a bound
`FormControl`, `ngModel` or signal-forms field — per interaction. That is
VERSIONING §3 row 112 (_default behaviour — emitted events_), so it ships with
`!`, which on `0.x` releases as `0.2.0` → `0.3.0` (VERSIONING §7). The rest of
#338 — drags that now end on `pointercancel`, lost capture and destroy, the
listener registration each drag used to leak, and a right- or middle-click on
a thumb or the track that no longer jumps it or starts a drag — restores
documented behaviour (row 117) and needs no migration.

## 1. What changed

`model()` drops a write that is `Object.is`-equal to the current value. A
single-thumb value is a number, so a repeated write was dropped. A range value
is a `[low, high]` tuple, and every write built a **new** array, so no write
was ever dropped. Every write path also wrote **twice**: the thumb setter
(`_setLowValue` / `_setHighValue`) wrote a tuple, then `_emitChange()` wrote
`[low, high]` again. So a range slider emitted two identical values for every
key press and track press, and two for every `pointermove` of a drag — even
when the pointer stayed inside one step and the value did not change.

`_emitChange()` is gone. A range write now goes through `_writeRange(low,
high)`, which skips a tuple whose two ends are `Object.is`-equal to the
current model's. A range slider emits once when its value changes and not at
all when it does not.

## 2. Before / after

Measured in `slider-gesture-end.spec.ts`: a range slider, `step` 10, bound to
a `FormControl`, counting `(valueChange)`. `FormControl.valueChanges` counted
the same.

| Interaction                                          | Before | After     |
| ---------------------------------------------------- | ------ | --------- |
| Drag of 10 `pointermove`s that stays inside one step | 20     | 0         |
| Drag that crosses one step                           | 2      | 1         |
| One arrow key                                        | 2      | 1         |
| Track press that moves a thumb                       | 2      | 1         |
| Single-thumb slider, any of the above                | 0 or 1 | unchanged |

## 3. Who is affected

- **Code that counts emissions** — an analytics call, a request per
  `valueChange`, a `valueChanges.pipe(bufferCount(2))`, or a spec asserting
  `toHaveBeenCalledTimes(2)` after one key press. **Do:** expect one emission
  per actual change, and none for a drag that stays inside a step.
- **Code that used the emission as a "pointer moved" signal.** A drag inside
  one step no longer emits at all. **Do:** read the value, not the event
  count. Nothing public reports sub-step pointer movement; the thumb still
  follows the pointer on screen.
- **Code that relied on a second write to the same value** — a `distinctUntilChanged()`
  with a custom comparator that never fired, or a `pairwise()` that saw
  `[a, a]` pairs. **Do:** nothing, unless the logic depended on the duplicate;
  the pairs are now `[previous, next]`.

Not affected: a single-thumb slider, and every `mlv-slider` in this
repository. `apps/docs` binds its range sliders with `[(ngModel)]` (slider
examples 2, 6 and 7, drawer example 4), where one write instead of two changes
nothing on screen; `mlv-chat`'s audio seek bar and the home page's theme split
are single-thumb.

# 2026-09 — The time-picker drum is now `@malva-ui/core/scrubber`

**Packages:** new — `@malva-ui/core/scrubber` (`MlvScrubber`, `MlvScrubberOrientation`). Affected — `@malva-ui/core/time-picker`.
**Kind:** additive in TypeScript, **breaking only for CSS written against the drum's BEM classes**. No exported symbol was renamed, removed or retyped: the extracted component was `@internal` and never appeared in a public barrel. Closes #129 (PR #146).

---

## Why

`libs/core/time-picker/src/lib/time-picker-column/` was a general one-dimensional scroll-snap selector wearing time-picker clothes — a headless `@angular/aria` listbox in activedescendant mode behind a centre stripe and fade masks, with the snap port shifted so items snap to the stripe rather than to the viewport top. A second consumer was arriving: the mobile calendar sheet needs the **same** control on the horizontal axis for its year strip. The choice was to extract it or to write it twice.

Three things had to generalise on the way out:

| Was                                                                                                      | Is                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcoded vertical (`scroll-snap-type: y`, `scroll-padding-block`, a stripe on `top`)                    | an `orientation` input; `'horizontal'` puts the strip on the **inline** axis                                                                             |
| `items: number[]`, `selectedValue: number`, with a zero-padded two-digit numeral baked into the template | a generic `T` plus a `displayWith` hook; the zero-pad is now the time picker's own formatter                                                             |
| No RTL story — the block axis never mirrors                                                              | logical snap port, list padding and centre stripe; one physical→logical conversion of `scrollLeft`; a scope-aware `Directionality` for aria's arrow keys |

---

## What changed

### 1. `mlv-scrubber` is a new published entry point

`@malva-ui/core/scrubber` exports one component. `MlvScrubber<T>` keeps the four inputs and one output the private column had, and adds three:

| Member          | Type                                               | Note                                                       |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `label`         | `input.required<string>()`                         | unchanged — the listbox's `aria-label`                     |
| `items`         | `input.required<readonly T[]>()`                   | was `number[]`                                             |
| `selectedValue` | `input.required<T>()`                              | was `number`                                               |
| `disabled`      | `input<boolean, BooleanInput>(false)`              | unchanged                                                  |
| `valueChange`   | `output<T>()`                                      | was `output<number>()`                                     |
| `orientation`   | `input<MlvScrubberOrientation>('vertical')`        | **new** — `'vertical' \| 'horizontal'`                     |
| `displayWith`   | `input<(item: T) => string>(item => String(item))` | **new** — the rendered label and the option's aria `label` |

`@malva-ui/core`'s root barrel re-exports it, so `import { MlvScrubber } from '@malva-ui/core'` resolves as well as the subpath.

### 2. `mlv-time-picker` composes it

`MlvTimePickerColumn` and its stylesheet are deleted. The three drum columns are `<mlv-scrubber>` elements, and the zero-padded numeral moved out of the primitive and into the time picker, where it belongs:

```diff
-<mlv-time-picker-column
+<mlv-scrubber
   label="Hours"
   [items]="_hourItems()"
   [selectedValue]="_displayHour()"
+  [displayWith]="_twoDigits"
   [disabled]="computedDisabled()"
   (valueChange)="_onHourChange($event)"
 />
```

```ts
/** @protected Clock formatting for the drum columns — an arrow property,
 *  because the strip calls it detached from this instance. */
protected readonly _twoDigits = (value: number): string =>
  String(value).padStart(2, '0');
```

`MlvTimePicker`'s own public API — every input, output, the `HH:mm` / `HH:mm:ss` CVA value, the AM/PM pair, the `:` divider, the mobile sheet — is untouched. Its `viewChildren` query is now `viewChildren(MlvScrubber)`, which is a private field.

### 3. There is no TypeScript API change to migrate

`MlvTimePickerColumn` was declared `@internal` and `libs/core/time-picker/src/index.ts` exported one line, before and after:

```ts
export * from './lib/time-picker/time-picker';
```

Nothing imported it from outside the library, and nothing could have. If you were reaching into it through a deep relative path into `libs/`, that path is gone — but it was never a supported import.

---

## Breaking: the drum's BEM classes

This is the whole migration surface. The block was renamed with the component, and `ViewEncapsulation.None` means a consumer's stylesheet could always target it.

| Before                                    | After                           |
| ----------------------------------------- | ------------------------------- |
| `.mlv-time-picker-column`                 | `.mlv-scrubber`                 |
| `.mlv-time-picker-column__track`          | `.mlv-scrubber__track`          |
| `.mlv-time-picker-column__list`           | `.mlv-scrubber__list`           |
| `.mlv-time-picker-column__item`           | `.mlv-scrubber__item`           |
| `.mlv-time-picker-column__item--selected` | `.mlv-scrubber__item--selected` |

The host also gains an orientation modifier — `.mlv-scrubber--vertical` (what the time picker renders) or `.mlv-scrubber--horizontal`.

```diff
-.my-app .mlv-time-picker-column__item--selected {
+.my-app .mlv-scrubber__item--selected {
   font-weight: 700;
 }
```

Scope such a rule under `.mlv-time-picker` if you mean the time picker specifically — the block is shared now, and the mobile calendar sheet's year strip is the same block.

The `<li>` element ids also changed, from `tp-col-item-<label>-<value>` to `mlv-scrubber-<n>-<index>` (a per-instance counter). They are `aria-activedescendant` targets, generated, and not API; they are listed here only because they are visible in the DOM.

---

## Not breaking: every `--mlv-tp-*` custom property still works

This is the part worth reading even if you write no CSS against the drum.

The primitive reads `--mlv-scrubber-*` names — it cannot carry a time-picker prefix. But `--mlv-tp-*` is a **published** theming surface of `mlv-time-picker`, so no name may disappear and no consumer override may break. All nine are still declared and still read; `mlv-time-picker` maps the six that describe the drum onto the primitive's names:

| `--mlv-tp-*` (published, unchanged)                                      | `--mlv-scrubber-*` (what the drum reads) | Note                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `--mlv-tp-visible-rows` (or `5`)                                         | `--mlv-scrubber-visible-rows`            |                                                                                      |
| `--mlv-tp-side-rows`                                                     | `--mlv-scrubber-side-rows`               | derived from the row count in the alias mixin, then fed across — live, not vestigial |
| `--mlv-tp-item-height` (or `2.25rem`)                                    | `--mlv-scrubber-item-size`               | the primitive's name is axis-neutral; it is a width on a horizontal strip            |
| `--mlv-tp-track-height`                                                  | `--mlv-scrubber-track-size`              |                                                                                      |
| `--mlv-tp-column-width` (or `3.5rem`)                                    | `--mlv-scrubber-cross-size`              | the extent **across** the scroll axis                                                |
| `--mlv-tp-font-size` (or `m`)                                            | `--mlv-scrubber-font-size`               |                                                                                      |
| `--mlv-tp-ampm-width`, `--mlv-tp-ampm-height`, `--mlv-tp-ampm-font-size` | —                                        | AM/PM is a two-state button pair, not a drum. No equivalent, and none needed.        |

### Why the alias layer sits on `<mlv-scrubber>` and nowhere above it

An alias is only correct on the element that the strip actually reads from, and this is the trap the extraction had to avoid rather than a stylistic preference.

**A custom property's `var()`s are substituted on the element that _declares_ it.** Write `--mlv-scrubber-item-size: var(--mlv-tp-item-height)` on `.mlv-time-picker__panel` and the right-hand side resolves _there_, against the panel's own `--mlv-tp-item-height`; what inherits down to the drum is the already-frozen result. Every `--mlv-tp-*` override placed between the panel and the strip is then silently dropped — including the mobile sheet's own `--mlv-tp-visible-rows: 7`, and including anything a consumer writes, who cannot include a Sass mixin.

Declaring the whole set on the leaf makes the substitution happen where the strip reads it, so an override written on the panel, on `.mlv-time-picker__columns`, or on the `<mlv-scrubber>` element itself is inherited into the alias and reaches the drum — the same route a consumer's override takes:

```scss
// libs/core/time-picker/src/lib/time-picker/time-picker.scss
&__panel {
  // …density-aware `--mlv-tp-*` declarations…

  mlv-scrubber {
    @include scrubber-token-aliases;
  }
}
```

Measured in Chrome with the aliases on `.mlv-time-picker__panel` and the overrides on `.mlv-time-picker__columns`: `--mlv-tp-font-size: 2rem` and `--mlv-tp-track-height: 300px` moved the `:` divider (14px → 32px, 180 → 300) and left the drum at 14px / 180 beside it, and `--mlv-tp-visible-rows: 7` — the headline knob — was a no-op in the anchored dropdown.

Two specs hold it. `time-picker-styles.spec.ts` asserts the include site against the compiled stylesheet — every alias on `.mlv-time-picker__panel mlv-scrubber`, none on any ancestor — plus that all nine published names are still declared _and_ still read by something. `time-picker-token-cascade.spec.ts` runs the cascade for real: it injects the compiled stylesheet, opens the anchored dropdown, sets `--mlv-tp-*` overrides on `.mlv-time-picker__columns` and resolves the strip's `--mlv-scrubber-*` values through inheritance and `var()` substitution. It fails with the aliases on the panel (`expected '5' to be '7'`).

So: **nothing to do.** A consumer override of any `--mlv-tp-*` name keeps working, at the same specificity, from the same places.

```html
<!-- Still works, unchanged. -->
<mlv-time-picker style="--mlv-tp-visible-rows: 7; --mlv-tp-item-height: 3rem" />
```

New code that themes the primitive directly should use the `--mlv-scrubber-*` names.

---

## RTL

A vertical strip is on the block axis and never mirrors, so this never came up before. A horizontal one is on the inline axis and does:

- The snap port, the list padding and the centre stripe are logical (`scroll-padding-inline`, `padding-inline`, `inset-inline-start`), so there is no `[dir='rtl']` twin rule.
- `scrollLeft` is physical and is negative throughout an RTL scroller's range. It is converted to a logical offset once, at the boundary, and back again on the programmatic-scroll path — the pattern `.claude/rules/rtl.md` prescribes.
- `@angular/aria`'s `Listbox` injects the CDK `Directionality` to decide which horizontal arrow means _next_. The root-provided instance reports only the **document** direction, so a strip inside a `dir="rtl"` subtree on an otherwise-LTR page would take its keys from one direction and its scroll maths from the other. `mlv-scrubber` therefore **provides** a scope-aware `Directionality` backed by `MlvRtlService.elementDirection(host)`. This is the one sanctioned use of the CDK token in the library and is recorded as such in `.claude/rules/rtl.md` § _The one sanctioned `Directionality` provider_ — the component's own code still goes through `MlvRtlService`, and the provider exists solely for the third party in its subtree.

Nothing in `mlv-time-picker` changes: its columns are vertical.

---

## Not changed

- `MlvTimePicker`'s public API, its geometry at all five densities, its anchored desktop dropdown and its `mobileMode="auto"` full-screen sheet, including the sheet's `--mlv-tp-visible-rows: 7`.
- The drum's behaviour: `@angular/aria` `Listbox` / `Option` in `focusMode="activedescendant"`, `selectionMode="follow"`, wrap, Home/End, type-ahead, the debounced scroll-to-select, and the `Listbox.gotoIndex` re-sync that keeps a following Arrow key moving from the centred value.
- The `MLV_TIME_PICKER_I18N` keys.
- Density: the `--mlv-tp-*` ramp is still declared on `.mlv-time-picker__panel` and still reaches the drum, now through the alias layer.

## Workspace-internal

Relevant only to contributors:

- New Nx project `scrubber` at `libs/core/scrubber`, tagged like its peers, with its own `project.json`, `test` target, `vite.config.mts`, `CLAUDE.md` / `AGENTS.md` symlinks and a `tsconfig.base.json` path mapping for `@malva-ui/core/scrubber`.
- `scrubber` added to the commitlint scope enum.
- `libs/core/time-picker/src/lib/time-picker-column/` is deleted; its specs moved and grew RTL and a11y suites the vertical-only original never needed.
- New docs page at `apps/docs/src/app/pages/scrubber` with vertical, horizontal and custom-item examples.

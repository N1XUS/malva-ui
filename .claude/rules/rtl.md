# Rule: Direction (RTL)

Applies to every `.scss` file, every component or directive with inline-axis behaviour (arrow keys, pointer geometry, overlays, sliding indicators), every public positional API, and every directional icon.

Malva UI mirrors **at runtime** and **scoped**: a `dir="rtl"` attribute on any ancestor flips that subtree, not only `<html dir>`. `dir="auto"` is transparent.

Source of truth — codify, never reinvent:

| Piece                                                                                              | Where                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `MlvRtlService`, `MlvDirection`, `MlvArrowKey`                                                     | `@malva-ui/cdk/utils` (`libs/cdk/utils/src/lib/rtl/rtl.service.ts`)                                                 |
| `--mlv-inline-direction` token                                                                     | `libs/styles/src/lib/theme.scss` § Direction                                                                        |
| `rtl()`, `ltr()`, `margin-inline()`, `padding-inline()`, `inline-distance()`, `translate-inline()` | `libs/styles/src/lib/mixins.scss` (tested by `mixins.spec.mjs`)                                                     |
| Overlay `direction` plumbing                                                                       | `@malva-ui/cdk/overlay`, `MlvPopupService`, `MlvTooltip`, `MlvAutocomplete`, `MlvDialogService`                     |
| Design + audit                                                                                     | `docs/superpowers/specs/2026-08-30-rtl-support-design.md`, `…/2026-07-27-expanded-locale-packs-rtl-audit-design.md` |

Inject `MlvRtlService`. **Never inject CDK `Directionality` directly** — the service owns the document `dir`, the CDK `Directionality` sync and the scoped `[dir]` observer.

---

## Core Model

| Term         | Meaning                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Inline axis  | start → end. Left → right in LTR, right → left in RTL. **Mirrors.**                                            |
| Block axis   | top → bottom. **Never mirrors.** `top`, `bottom`, `ArrowUp`, `ArrowDown` stay as they are.                     |
| **Physical** | `left` / `right`, `clientX`, `DOMRect.left`, `offsetLeft`, `scrollLeft`, `translateX`. Same on screen in both. |
| **Logical**  | `inline-start` / `inline-end`, `start` / `end`, _previous_ / _next_. Follows `dir`.                            |

Every `left` / `right` you write or touch is one of three kinds — **classify before choosing a form**:

| Kind          | Test                                                     | Form                                                                             |
| ------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Semantic**  | means start / end, previous / next                       | logical property · `normalizeArrowKey` · `start` / `end` position                |
| **Physical**  | a screen coordinate, or a physical edge chosen by layout | stays physical **and carries a `// physical: <reason>` comment**                 |
| **Symmetric** | both sides equal (`left: 0; right: 0`)                   | `inset-inline: 0` — already direction-agnostic, just write the logical shorthand |

---

## SCSS

### Logical properties — always

| Physical (forbidden)                                   | Logical (required)                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `margin-left` / `margin-right`                         | `margin-inline-start` / `margin-inline-end`                                |
| `padding-left` / `padding-right`                       | `padding-inline-start` / `padding-inline-end`                              |
| `left` / `right`                                       | `inset-inline-start` / `inset-inline-end` (both sides: `inset-inline`)     |
| `border-left` / `border-right`                         | `border-inline-start` / `border-inline-end`                                |
| `border-top-left-radius` (and the other three corners) | `border-start-start-radius`, `-start-end-`, `-end-start-`, `-end-end-`     |
| `text-align: left` / `right`                           | `text-align: start` / `end`                                                |
| `float: left` / `right`, `clear: left` / `right`       | `float: inline-start` / `inline-end`, `clear: inline-start` / `inline-end` |

`mixins.margin-inline($start, $end)` and `mixins.padding-inline($start, $end)` are sugar for the two logical declarations — the native properties are equally fine. `--mlv-padding-*` pairs are `block inline` and already direction-agnostic; per-side values take `--mlv-spacing-*` (see `bem-scss.md`).

### Properties with no logical form — use the sign token

`transform`, `transform-origin`, `box-shadow` offsets and `background-position` have no logical keywords. `--mlv-inline-direction` is `1` in LTR and `-1` in RTL and is re-declared under every `[dir]`, so it follows a scoped flip at any depth. Multiply the inline component by it instead of duplicating rules under `[dir='rtl']`:

```scss
@use '../../../../styles/src/lib/mixins' as mixins;

.mlv-x {
  // Inline translation that composes with the rest of the transform list.
  transform: translateX(mixins.inline-distance(-0.25rem)) scale(0.98);

  // Sugar for a lone inline translation.
  @include mixins.translate-inline(-100%);

  // Grow from the inline-start edge: 0% in LTR, 100% in RTL.
  transform-origin: calc(50% - 50% * var(--mlv-inline-direction)) center;

  // Shadow cast toward inline-end.
  box-shadow: mixins.inline-distance(0.25rem) 0 0 var(--mlv-border-normal);
}

.mlv-x__chevron {
  // Mirror a directional glyph (see Icons).
  transform: scaleX(var(--mlv-inline-direction));
}
```

`@include mixins.rtl { … }` / `mixins.ltr { … }` (scope to `[dir='rtl'] &` / `[dir='ltr'] &`) are for a visual rule that genuinely differs per direction **and** cannot be expressed as a sign flip. Never for spacing, never as a way to keep a physical declaration.

### Allowed physical CSS — each line carries `// physical: <reason>`

| Case                             | Why it stays physical                                                                                                       | Example                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| JS-fed coordinate                | `offsetLeft` / `getBoundingClientRect()` are physical; CSS that consumes them must be too. The TS side re-measures on flip. | `left: var(--mlv-tab-indicator-left)` (tabs, segmented)            |
| Centering pair                   | `left: 50%` + `translateX(-50%)` is direction-agnostic; converting one half breaks it                                       | popup / tooltip arrow, slider thumb, action-bar centre slot        |
| Collision-resolved overlay arrow | CDK picks the actual physical side after flipping; the arrow follows that side, not the requested one                       | `.mlv-popup--arrow-left`, tooltip `--mlv-tooltip-transform-origin` |
| 2D geometry                      | a canvas / plane where x is a colour or ratio, not reading order                                                            | colour-picker saturation plane, split-pane divider                 |
| Decorative sweep                 | a shimmer that reads the same either way                                                                                    | skeleton / avatar `background-position` keyframes                  |

Anything not in this table is semantic. Do not add a row without a spec or migration note explaining why.

### Do not

- `[dir='rtl'] .mlv-x { margin-left: … }` — a duplicated physical rule. Write the logical property once.
- `direction: rtl` / `unicode-bidi` in component CSS — direction is owned by `dir` attributes and `MlvRtlService`.
- `--mlv-inline-start` / `--mlv-inline-end` — these tokens do not exist. The only direction token is `--mlv-inline-direction`, a sign, not a length.
- `scaleX(-1)` under `mixins.rtl` when `scaleX(var(--mlv-inline-direction))` says the same in one declaration.

---

## TypeScript — Keyboard

Manual arrow handlers switch on `normalizeArrowKey(event)`, never on `event.key === 'ArrowLeft'`. It returns the CDK key-code constants with only the horizontal pair swapped in RTL, `UP_ARROW` / `DOWN_ARROW` unchanged, and `null` for non-arrow keys — so `?? event.key` keeps `Home` / `End` / `Escape` in the same `switch`:

```ts
import { DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService } from '@malva-ui/cdk/utils';

/** @private Mirrors horizontal arrow keys in RTL. */
private readonly _rtlService = inject(MlvRtlService);

protected _onKeydown(event: KeyboardEvent): void {
  switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
    case RIGHT_ARROW: // "next" in both directions
      this._step(1);
      event.preventDefault();
      break;
    case LEFT_ARROW: // "previous" in both directions
      this._step(-1);
      event.preventDefault();
      break;
    case 'Home':
      this._first();
      event.preventDefault();
      break;
  }
}
```

A horizontal `FocusKeyManager` reads raw key codes internally, so it is handed the direction and **rebuilt when it changes** (the stepper pattern):

```ts
effect(() => {
  const items = this._items();
  const direction = this._direction(); // MlvRtlService.elementDirection(host)
  untracked(() => {
    this._keyManager?.destroy();
    this._keyManager = new FocusKeyManager(items)
      .withHorizontalOrientation(direction) // never a literal 'ltr'
      .withWrap()
      .withHomeAndEnd();
  });
});
```

Untouched by direction: vertical-only groups (`MlvFocusableGroupBase` — radio / checkbox / switch groups), text-caret movement inside inputs and the editor, `aria-keyshortcuts` values and any user-facing "Left / Right" copy.

---

## TypeScript — Pointer and Measured Geometry

`clientX`, `DOMRect.left` / `.right`, `offsetLeft` and `scrollLeft` are physical. Convert to a logical progress **once, at the boundary**, using the element's own direction (the slider pattern):

```ts
/** @private Direction applying to this host, following any `[dir]` scope above it. */
private readonly _direction = this._rtlService.elementDirection(inject(ElementRef<HTMLElement>));

// 0% sits at the inline-start edge — the track's right edge in RTL.
const offset = this._direction() === 'rtl' ? rect.right - event.clientX : event.clientX - rect.left;
const percent = clamp((offset / rect.width) * 100, 0, 100);
```

JS-measured indicators (tab underline, segmented pill, drawer / rail resize) keep their CSS physical (`left: var(--mlv-tab-indicator-left)`) and make the measuring effect depend on the direction. Nothing else tells the component to re-measure: mirroring moves children without changing their size, so no `ResizeObserver` fires and no query changes.

```ts
constructor() {
  effect(() => {
    this.activeItem();
    this._direction(); // re-measure when the inline axis flips
    this._measureIndicator();
  });
}
```

Which accessor:

| Need                                                    | Use                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| Direction of **this component** (scoped)                | `elementDirection(host)` — signal; needs an injection context |
| One-off resolution in a service / imperative API        | `resolveDirection(target)`                                    |
| React to flips from imperative code (open overlay)      | `watchDirection(target, onChange)` — returns a teardown       |
| A **document-level** surface with no host (toast stack) | `direction()` / `rtl()`                                       |

---

## Overlays

A CDK overlay pane is portaled to `<body>`; it never inherits the `[dir]` scope its trigger sits in. Every overlay therefore:

1. **Uses `start` / `end` / `center` for `originX` and `overlayX`** — never `'left'` / `'right'`. The connected strategy mirrors those against the pane's `dir`.
2. **Carries `direction` on its config**, resolved from the trigger: `direction: this._rtlService.resolveDirection(origin)`. `MlvOverlayHostBase`, `MlvOverlayServiceBase` (drawer), `MlvDialogService`, `MlvPopupService`, `MlvTooltip` and `MlvAutocomplete` already do this; a new overlay must. Config interfaces expose an optional `direction?: MlvDirection` override for opens without a focused trigger.
3. **Re-mirrors while open** when it is long-lived and imperative — nothing re-parents an open pane, so the strategy would keep resolving `start` / `end` against the direction it opened with:

   ```ts
   cleanups.push(
     this._rtl.watchDirection(config.origin, (direction) => {
       overlayRef.setDirection(direction);
       overlayRef.updatePosition();
     }),
   );
   ```

4. **Treats `offsetX` as physical.** CDK adds `offsetX` as raw pixels without flipping it, so a gap that pushes a `start`-anchored pane away from its trigger in LTR pushes it _into_ the trigger in RTL. Either build the position list with `offsetX * (direction === 'rtl' ? -1 : 1)` from the resolved direction, or express the gap as a logical `margin-inline-*` on the panel class.
5. **Derives the arrow side from the resolved position pair**, not from the requested placement — the visual side is physical once CDK has run collision handling.

---

## Public API

- New inputs, config fields and unions that describe an inline side use **`'start' | 'end'`** (`MlvPopupPositionName` `bottom-start`, `ConnectedPosition`), never `'left' | 'right'`.
- Existing `'left' | 'right'` unions stay for compatibility — `MlvDrawerPosition`, `MlvTooltipPlacement`, the `left-*` / `right-*` `MlvPopupPositionName`s, `MlvPopupArrowEdge`, `MlvTimelineItemDirection`, `MlvColumnAlign`, `MlvPinSide`, `MlvNumberInputControlAlignment`. Their JSDoc **must state which they are**: a _logical alias_ that mirrors in RTL (tooltip `'left'` → `originX: 'start'`; table `'left'` → `text-align: start`) or a _physical edge_ that does not. Never re-interpret one silently; a rename or a semantics change is breaking and goes through `docs/migrations/`.
- Components take **no `direction` / `rtl` input**. The `dir` attribute on an ancestor is the API and `elementDirection(host)` reads it. Overlay configs are the one exception, because the pane is portaled out of scope.
- i18n strings never say "left" / "right" for a logical position; say "start" / "end", "previous" / "next".

---

## Icons

Lucide glyphs do not mirror on their own. Mirror a glyph when it encodes **inline-axis movement or hierarchy**: previous / next chevrons, expand-to-side chevrons (tree, list group, submenu, breadcrumb separator), back arrows, panel open / close, indent / outdent. Do **not** mirror glyphs that encode time or media transport (clock, history, play, fast-forward), a physical alignment (`lucideAlignLeft` driving `text-align: left`), checkmarks, brand marks or symmetric shapes.

```scss
.mlv-breadcrumb__separator {
  transform: scaleX(var(--mlv-inline-direction)); // chevron points toward inline-end
}
```

Prefer this CSS form over swapping `lucideChevronLeft` / `lucideChevronRight` in the template on `rtl()` — one import, no signal, and it follows a scoped `[dir]` for free. Put the mirrored glyph in its own element (`__chevron`, `__separator`) so the transform never touches text.

---

## Testing

Every component with inline-axis behaviour ships RTL specs. `setDirection` is **global state — always reset in `afterEach`**.

```ts
let rtlService: MlvRtlService;

beforeEach(() => {
  rtlService = TestBed.inject(MlvRtlService);
});
afterEach(() => rtlService.setDirection('ltr'));

it('mirrors horizontal arrows and keeps vertical ones in RTL', () => {
  rtlService.setDirection('rtl');
  fixture.detectChanges();

  host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(component.activeIndex()).toBe(1); // ArrowLeft is "next" in RTL

  host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(component.activeIndex()).toBe(1); // vertical unchanged
});

it('follows a [dir] scope on an ancestor while the document stays LTR', () => {
  host.setAttribute('dir', 'rtl');
  expect(rtlService.direction()).toBe('ltr');
  // …assert the mirrored behaviour…
});
```

| Surface           | Assert                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard          | horizontal pair swapped, vertical pair unchanged, `Home` / `End` unchanged                                                                                                                   |
| Pointer           | a `clientX` at the track's right edge maps to `min` in RTL                                                                                                                                   |
| Measured geometry | after `setDirection('rtl')` + `await fixture.whenStable()` the indicator variable re-measures (tabs pattern)                                                                                 |
| Overlay           | `overlayRef.getDirection()` is `'rtl'` for a global flip, for a scoped origin (`origin.setAttribute('dir', 'rtl')`), and after a flip while open (`TestBed.tick()`, `updatePosition` called) |
| SCSS              | mixin output is covered by `libs/styles/src/lib/mixins.spec.mjs`; a component's compiled-CSS spec reads through `stripCssLayersFromText()`                                                   |

Manual check: docs app → preferences popup → **Direction: RTL**, then walk the component page in both directions.

---

## Checklist

- [ ] No physical `margin` / `padding` / `border` / inset / `text-align` / `float` on the inline axis; every remaining physical value carries `// physical: <reason>` and matches the exceptions table.
- [ ] `transform` / `transform-origin` / `box-shadow` inline components go through `inline-distance()` / `--mlv-inline-direction`; no `[dir='rtl']` duplicate rules.
- [ ] Arrow handlers switch on `normalizeArrowKey(event)`; horizontal `FocusKeyManager`s get `withHorizontalOrientation(direction)` and rebuild on change; vertical, caret and `aria-keyshortcuts` untouched.
- [ ] Pointer maths converts `clientX` to inline progress once; measured indicators depend on `elementDirection(host)`.
- [ ] Overlays: `start` / `end` positions, `direction` on the config, `watchDirection` for long-lived panes, `offsetX` sign from the resolved direction.
- [ ] New positional API uses `start` / `end`; existing `left` / `right` JSDoc states logical-alias vs physical-edge.
- [ ] Directional glyphs mirror via `scaleX(var(--mlv-inline-direction))`; time / media / alignment glyphs do not.
- [ ] RTL specs: global flip, scoped `[dir]`, vertical unchanged, overlay direction, `afterEach` reset.

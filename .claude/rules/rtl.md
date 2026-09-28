# Rule: Direction (RTL)

Applies to every `.scss` file, every component or directive with inline-axis behaviour (arrow keys, pointer geometry, overlays, sliding indicators), every public positional API, and every directional icon.

Malva UI mirrors **at runtime** and **scoped**: a `dir="rtl"` attribute on any ancestor flips that subtree, not only `<html dir>`. `dir="auto"` is transparent.

Source of truth — codify, never reinvent:

| Piece                                                                                              | Where                                                                                           |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MlvRtlService`, `MlvDirection`, `MlvArrowKey`                                                     | `@malva-ui/cdk/utils` (`libs/cdk/utils/src/lib/rtl/rtl.service.ts`)                             |
| `--mlv-inline-direction` token                                                                     | `libs/styles/src/lib/theme.scss` § Direction                                                    |
| `rtl()`, `ltr()`, `margin-inline()`, `padding-inline()`, `inline-distance()`, `translate-inline()` | `libs/styles/src/lib/mixins.scss` (tested by `mixins.spec.mjs`)                                 |
| Overlay `direction` plumbing                                                                       | `@malva-ui/cdk/overlay`, `MlvPopupService`, `MlvTooltip`, `MlvAutocomplete`, `MlvDialogService` |
| `mlvMirrorInlineOffsets()` — overlay `offsetX`                                                     | `@malva-ui/cdk/utils` (`libs/cdk/utils/src/lib/rtl/mirror-inline-offsets.ts`)                   |
| `provideMlvScopedDirectionality()` — `@internal`, for `@angular/aria` hosts                        | `@malva-ui/cdk/utils` (`libs/cdk/utils/src/lib/rtl/scoped-directionality.ts`)                   |

Inject `MlvRtlService`. **Never inject CDK `Directionality` directly** — the service owns the document `dir`, the CDK `Directionality` sync and the scoped `[dir]` observer. The one sanctioned exception is _providing_ the token to a third-party pattern, always through `provideMlvScopedDirectionality()`: see _Sanctioned `Directionality` providers_ below.

---

## Core Model

| Term         | Meaning                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Inline axis  | start → end. Left → right in LTR, right → left in RTL. **Mirrors.**                                            |
| Block axis   | top → bottom. **Never mirrors.** `top`, `bottom`, `ArrowUp`, `ArrowDown` stay as they are.                     |
| **Physical** | `left` / `right`, `clientX`, `DOMRect.left`, `offsetLeft`, `scrollLeft`, `translateX`. Same on screen in both. |
| **Logical**  | `inline-start` / `inline-end`, `start` / `end`, _previous_ / _next_. Follows `dir`.                            |

Every `left` / `right` you write or touch is one of three kinds — **classify before choosing a form**:

| Kind          | Test                                                     | Form                                                                                |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Semantic**  | means start / end, previous / next                       | logical property · `normalizeArrowKey(event, direction)` · `start` / `end` position |
| **Physical**  | a screen coordinate, or a physical edge chosen by layout | stays physical **and carries a `// physical: <reason>` comment**                    |
| **Symmetric** | both sides equal (`left: 0; right: 0`)                   | `inset-inline: 0` — already direction-agnostic, just write the logical shorthand    |

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

| Case                             | Why it stays physical                                                                                                                                                        | Example                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| JS-fed coordinate                | `offsetLeft` / `getBoundingClientRect()` are physical; CSS that consumes them must be too. The TS side re-measures on flip.                                                  | `left: var(--mlv-tab-indicator-left)` (tabs, segmented)            |
| Centering pair                   | `left: 50%` + `translateX(-50%)` is direction-agnostic; converting one half breaks it                                                                                        | popup / tooltip arrow, slider thumb, action-bar centre slot        |
| Collision-resolved overlay arrow | CDK picks the actual physical side after flipping; the arrow follows that side, not the requested one                                                                        | `.mlv-popup--arrow-left`, tooltip `--mlv-tooltip-transform-origin` |
| 2D geometry                      | a canvas / plane where x is a colour or ratio, not reading order                                                                                                             | colour-picker saturation plane, split-pane divider                 |
| Decorative sweep                 | a shimmer that reads the same either way                                                                                                                                     | skeleton / avatar `background-position` keyframes                  |
| **Sticky inline inset**          | Safari 26 mispositions a `position: sticky` element in RTL when the inline inset is logical; the physical property works. Chromium fixed the equivalent about a year earlier | a sticky rail or gutter pinned on the inline axis                  |

Anything not in this table is semantic. Do not add a row without a spec or migration note explaining why.

The sticky row is the one exception this rule fights with, so it is guarded
rather than remembered: `libs/styles/src/lib/sticky-inline-inset.spec.mjs`
(a `styles:test` entry) sweeps every stylesheet under `libs/` and fails on a
rule that declares `position: sticky` **and** `inset-inline*`. It compares
within one rule — two rules reaching the same element through different
selectors are past what a static sweep can see, and today the library has no
such pair. Write the physical property with the usual `// physical:` comment
naming this bug. `inset-block-*` is unaffected, which is what every sticky
inset in `mlv-page` actually uses.

### Do not

- `[dir='rtl'] .mlv-x { margin-left: … }` — a duplicated physical rule. Write the logical property once.
- `direction: rtl` / `unicode-bidi` in component CSS — direction is owned by `dir` attributes and `MlvRtlService`.
- `--mlv-inline-start` / `--mlv-inline-end` — these tokens do not exist. The only direction token is `--mlv-inline-direction`, a sign, not a length.
- `scaleX(-1)` under `mixins.rtl` when `scaleX(var(--mlv-inline-direction))` says the same in one declaration.

---

## TypeScript — Keyboard

Manual arrow handlers switch on `normalizeArrowKey(event, direction)`, never on `event.key === 'ArrowLeft'`. It returns the CDK key-code constants with only the horizontal pair swapped in RTL, `UP_ARROW` / `DOWN_ARROW` unchanged, and `null` for non-arrow keys — so `?? event.key` keeps `Home` / `End` / `Escape` in the same `switch`.

**Pass a direction, resolved once.** Direction is scoped, and the second argument is what makes the helper honour that. Without it the helper reads the _document_, and a handler inside a `dir="rtl"` subtree mirrors its layout but not its keys — the two halves of one component disagreeing. This is not an exotic case: CDK stamps `dir` on **every** overlay host, so every pane opened through `MlvPopupService` (menu, calendar, autocomplete, sidebar-group flyout) is a scoped `[dir]` subtree by construction.

The argument is a resolved `MlvDirection`, not an element, because resolving means walking `parentElement` to the nearest explicit `dir` and a keydown handler runs per keystroke. `elementDirection(host)` does that walk once and caches it behind one shared `dir` `MutationObserver`, re-running it only when a `dir` attribute actually changes — so the component resolves in a field initializer and the handler reads the signal.

- The element the direction is resolved **from** is the one the handler **speaks for** — usually the component's own host `ElementRef`, hoisted into a named field so the same element also feeds a horizontal `FocusKeyManager` and any measured geometry. Then no two halves can disagree, and most components already hold the signal for one of those.
- **A component's own host is not always the element it speaks for.** Check where the handler is actually bound before reaching for `_elementRef`: a component that projects its interactive surface through `<ng-template mlvPopupContent>` keeps its host at the declaration site while the surface is portaled into a pane whose `dir` comes from the **trigger** (`resolveDirection(config.origin)`). `MlvMenu` is that case — menus are routinely declared once at page level and triggered from inside a scoped subtree — so it resolves from `event.currentTarget` (the `<mlv-list>` panel, always inside the pane). Resolving from its own host would report the document's direction while the pane it renders into is mirrored: mirrored layout, unmirrored keys, which is the very defect the argument exists to prevent. That panel is re-created per overlay attach and can be attached from triggers in different `[dir]` scopes, so there is no static target to cache against: this is the **one** handler that calls `resolveDirection(panel)` per event, and it says so in a comment.
- **Never `event.target`.** It is the deepest element the key reached, which is not a stable contract; `currentTarget` is the element the listener is bound to, and is only the right answer when that element is inside the mirrored subtree and the component's host is not.
- Omit it **only** in a handler that never matches `LEFT_ARROW` / `RIGHT_ARROW` — a vertical-only group, where mirroring is a no-op either way. Say so in a comment at the call site, so the omission reads as deliberate. Adding a horizontal branch to such a handler means adding the direction with it.

```ts
import { DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService } from '@malva-ui/cdk/utils';

/** @private Mirrors horizontal arrow keys in RTL. */
private readonly _rtlService = inject(MlvRtlService);

/** @private Host element; the scope both the keys and the geometry resolve against. */
private readonly _elementRef = inject(ElementRef<HTMLElement>);

/**
 * @private Direction applying to this host, resolved once and cached behind the
 * shared `dir` observer rather than re-walked on every arrow keypress.
 */
private readonly _direction = this._rtlService.elementDirection(this._elementRef);

protected _onKeydown(event: KeyboardEvent): void {
  switch (
    this._rtlService.normalizeArrowKey(event, this._direction()) ?? event.key
  ) {
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
      .withHorizontalOrientation(direction) // never a literal 'ltr', never the global `direction()`
      .withWrap()
      .withHomeAndEnd();
  });
});
```

Untouched by direction: **vertical-only** groups — `MlvFocusableGroupBase` (which backs the checkbox and switch groups) delegates only `ArrowUp` / `ArrowDown` — text-caret movement inside inputs and the editor, `aria-keyshortcuts` values and any user-facing "Left / Right" copy. Those handlers may call `normalizeArrowKey(event)` without a direction, because a switch that never matches the horizontal pair cannot mirror.

`mlv-radio-group` is **not** in that set despite the name: it does not extend the base and handles all four arrows for WAI-ARIA radiogroup semantics, so it mirrors and passes its own scoped direction.

---

## TypeScript — Pointer and Measured Geometry

`clientX`, `DOMRect.left` / `.right`, `offsetLeft` and `scrollLeft` are physical. Convert to a logical progress **once, at the boundary**, using the element's own direction (the slider pattern):

```ts
/** @private Host element; the one scope every direction-aware half resolves against. */
private readonly _elementRef = inject(ElementRef<HTMLElement>);

/** @private Direction applying to this host, following any `[dir]` scope above it. */
private readonly _direction = this._rtlService.elementDirection(this._elementRef);

// 0% sits at the inline-start edge — the track's right edge in RTL.
const offset = this._direction() === 'rtl' ? rect.right - event.clientX : event.clientX - rect.left;
const percent = clamp((offset / rect.width) * 100, 0, 100);
```

JS-measured indicators (tab underline, segmented pill, rail resize) keep their CSS physical (`left: var(--mlv-tab-indicator-left)`) and make the measuring effect depend on the direction. Nothing else tells the component to re-measure: mirroring moves children without changing their size, so no `ResizeObserver` fires and no query changes.

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

Hoist the host `ElementRef` into a named field, derive **one** `elementDirection()` signal from it, and feed every direction-aware half from that signal — `normalizeArrowKey(event, this._direction())`, `withHorizontalOrientation(this._direction())`, the measuring `effect()`. Two halves reading the same signal cannot disagree; two halves reading different sources is the whole defect class (#127, #147).

| Need                                                    | Use                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Direction of **this component** (scoped)                | `elementDirection(host)` — signal; cached, call in a field initializer |
| One-off resolution in a service / imperative API        | `resolveDirection(target)`                                             |
| React to flips from imperative code (open overlay)      | `watchDirection(target, onChange)` — returns a teardown                |
| A **document-level** surface with no host (toast stack) | `direction()` / `rtl()`                                                |

### Sanctioned `Directionality` providers

The ban above is on **injecting** the CDK token. A component that hosts a
third-party pattern which injects `Directionality` itself **provides** a
scope-aware one, because the root-provided instance reports only the document
direction — so inside a `[dir]` subtree the component's logical CSS, measured
geometry or scroll maths mirror while the pattern's arrow keys do not (#339, the
#127 / #147 class reached through a third party).

The provider is always `provideMlvScopedDirectionality()` from
`@malva-ui/cdk/utils` (`@internal` — exported so core leaves can reach it, not
consumer API). Never hand-roll another factory. It reads **through** to
`elementDirection(host)` (`valueSignal` is a `linkedSignal` over it, not a
signal an effect writes), so a key pressed straight after a flip already sees
the new direction; `change` emits per flip and completes on destroy. It reads
**nothing at construction**: a host inside an `@if` / `@for` / template view
is constructed before its nodes are inserted, and a read then resolves the
detached node to the document direction and caches it under a static `[dir]`
that never changes. `elementDirection()`'s JSDoc carries the same caveat for
every caller.

Every `@angular/aria` pattern the library uses, checked against
`@angular/aria` 22.1.8 (`fesm2022/*.mjs`, `textDirection = inject(Directionality).valueSignal`):

| Host                                | Pattern that injects the token           | Placement       | Scoped spec                                                                         |
| ----------------------------------- | ---------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `mlv-scrubber`                      | `Listbox` (template)                     | `providers`     | `scrubber-rtl.spec.ts` (scoped case)                                                |
| `mlv-tab-group`                     | `TabList` (template)                     | `viewProviders` | `tabs-scoped-direction.spec.ts`                                                     |
| `mlv-toolbar[mlvToolbarRoving]`     | `Toolbar` (host directive)               | `providers`     | `toolbar-widget-scoped-direction.spec.ts`                                           |
| `mlv-tree`                          | `Tree` (template; expand / collapse too) | `viewProviders` | `tree-scoped-direction.spec.ts`                                                     |
| `mlv-list[selectable]`              | `Listbox` (host directive)               | `providers`     | `list-selectable-scoped-direction.spec.ts`                                          |
| `mlv-data-table` (`cellNavigation`) | `Grid`, `GridCell` (template)            | `viewProviders` | `data-table-scoped-direction.spec.ts`                                               |
| `mlv-accordion` — **not needed**    | `AccordionGroup` injects it              | —               | aria pins the group `vertical`; `textDirection` is only read for a horizontal group |

`@angular/aria`'s `Menu` and `Combobox` are unused (`mlv-menu` has its own keyboard
model); `Combobox` does not inject the token. Re-check this table when adding an
`@angular/aria` pattern or upgrading the package.

The rules for adding another:

- **Only when something in the subtree actually injects the token**, and say in
  a comment at the provider which pattern that is.
- **Placement.** `viewProviders` when the pattern sits in the component's own
  template, so projected consumer content keeps what it resolved before. A
  pattern applied as a **host directive** resolves against the node's
  `providers` only — `viewProviders` are invisible to directives on the host
  node itself — so there it must be `providers`.
- **Provide, never inject.** The component's own code keeps using
  `MlvRtlService`; the provider exists solely for the third party in its
  subtree. `MlvRtlService` still owns the document `dir` and the global CDK
  sync, and the provider reads from it rather than being a second source of
  truth.
- **Not CDK's `Dir` directive instead.** `Dir` is `[dir]`-selected and
  standalone, so it exists only where a _consumer_ writes `dir` **and** imports
  it, and it reads only its own input — a `dir` attribute on a plain wrapper, or
  one set by the host page, provides nothing and a later change is not observed.
  The `dir` attribute is this library's direction API, so it has to work without
  the consumer opting into a CDK directive. Where a consumer has imported `Dir`
  anyway, the two providers agree and the nearer one wins.
- **Pin it with a scoped-`[dir]` spec** — a `dir="rtl"` ancestor with the
  document LTR, plus the LTR-island mirror image. A global-flip spec is not
  evidence: `MlvRtlService.setDirection()` writes the root CDK `Directionality`
  too, so the global case passes with the provider removed. Ablate the provider
  and check that exactly the scoped spec goes red.
- **A static scope around an embedded view pins the construction timing.**
  Every spec that flips `[dir]` after the host exists hides a direction read at
  construction, because the flip invalidates the cache.
  `scoped-directionality.spec.ts` pins the mechanism once: it renders the
  provider inside an `@if` under a static `dir="rtl"` and goes red with an
  eager read restored (`tabs-scoped-direction.spec.ts` repeats it end to end).
  A host adds its own static-`@if` spec only when its subtree contains another
  `Directionality` reader — CDK scrolling, drag-drop, an overlay — that could
  read `.value` at construction. `core:test` (`ssr-smoke.spec.ts`) is the
  server half — run it after touching the helper or `resolveDirection`.

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

4. **Treats `offsetX` as physical.** `FlexibleConnectedPositionStrategy` returns it verbatim from `_getOffset()` and applies it as `x += offsetX` and `translateX(${offsetX}px)`, with no `_isRtl()` on that path — unlike `originX` / `overlayX`, which it mirrors. So a gap that pushes a `start`-anchored pane away from its trigger in LTR pushes it _into_ the trigger in RTL, a 2x error. Pass the list through **`mlvMirrorInlineOffsets(positions, direction)`** (`@malva-ui/cdk/utils`) with the direction the pane is created with, and again whenever that direction changes under an open overlay — `MlvPopupService` and `MlvTooltip` are the two call sites (#180). It returns the list by reference when nothing changes, so CDK's identity-based `positionChanges` dedup is not disturbed.
   The alternative — expressing the gap as a logical `margin-inline-*` on the panel — is **not** equivalent and was rejected, but **not** because CDK cannot see it: measured, a margin on the panel inflates the `.cdk-overlay-pane` rect `_getOverlayFit` scores by exactly its own size (the pane is a `box-sizing: border-box` flex container), and `margin-inline-*` mirrors on its own. The real reasons are that the gap belongs to whichever side the **resolved** position put the panel on, and `left-*` / `right-*` are fallback twins in one list — one margin cannot serve both, and a per-position `panelClass` cannot rescue it because `_applyPosition` adds that class _after_ `_getOverlayFit` has already scored the un-margined rect. A symmetric `margin-inline` inflates the pane on both sides, making fit scoring pessimistic and adding a spurious gap to every `top-*` / `bottom-*` entry that wants no inline gap at all. On a popup panel the margin is also a transparent strip **of the pane**, which click-outside dismissal counts as inside.
   Either way the gap belongs to a **whole list**: do not mirror one entry and leave its twin, and never touch `offsetY` — the block axis does not flip.
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

| Surface           | Assert                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard          | horizontal pair swapped, vertical pair unchanged, `Home` / `End` unchanged — asserted under a **scoped** `[dir="rtl"]` ancestor with the document still LTR, plus the LTR-island mirror image |
| Pointer           | a `clientX` at the track's right edge maps to `min` in RTL                                                                                                                                    |
| Measured geometry | after `setDirection('rtl')` + `await fixture.whenStable()` the indicator variable re-measures (tabs pattern)                                                                                  |
| Overlay           | `overlayRef.getDirection()` is `'rtl'` for a global flip, for a scoped origin (`origin.setAttribute('dir', 'rtl')`), and after a flip while open (`TestBed.tick()`, `updatePosition` called)  |
| SCSS              | mixin output is covered by `libs/styles/src/lib/mixins.spec.mjs`; a component's compiled-CSS spec reads through `stripCssLayersFromText()`                                                    |

Manual check: docs app → preferences popup → **Direction: RTL**, then walk the component page in both directions.

---

## Checklist

- [ ] No physical `margin` / `padding` / `border` / inset / `text-align` / `float` on the inline axis; every remaining physical value carries `// physical: <reason>` and matches the exceptions table.
- [ ] `transform` / `transform-origin` / `box-shadow` inline components go through `inline-distance()` / `--mlv-inline-direction`; no `[dir='rtl']` duplicate rules.
- [ ] Arrow handlers switch on `normalizeArrowKey(event, this._direction())` whenever the handler branches on the horizontal pair — one cached `elementDirection()` signal per component, resolved from the element the handler is _bound to_, which is the component's host unless its surface is portaled into an overlay pane (then `resolveDirection(event.currentTarget)` per event, because no static target exists), never `event.target`; horizontal `FocusKeyManager`s get `withHorizontalOrientation()` from the same signal (never the global `direction()`) and rebuild on change; vertical, caret and `aria-keyshortcuts` untouched.
- [ ] Pointer maths converts `clientX` to inline progress once; measured indicators depend on `elementDirection(host)`.
- [ ] CDK `Directionality` is not injected; a host whose subtree runs an `@angular/aria` pattern that injects it provides `provideMlvScopedDirectionality()` (`viewProviders` for a template pattern, `providers` for a host directive), names the pattern in a comment, is listed under _Sanctioned `Directionality` providers_, and is pinned by a scoped-`[dir]` spec that fails when the provider is ablated.
- [ ] Overlays: `start` / `end` positions, `direction` on the config, `watchDirection` for long-lived panes, `offsetX` through `mlvMirrorInlineOffsets()` against the resolved direction (re-applied on every flip, never `offsetY`).
- [ ] New positional API uses `start` / `end`; existing `left` / `right` JSDoc states logical-alias vs physical-edge.
- [ ] Directional glyphs mirror via `scaleX(var(--mlv-inline-direction))`; time / media / alignment glyphs do not.
- [ ] RTL specs: global flip, scoped `[dir]`, vertical unchanged, overlay direction, `afterEach` reset.

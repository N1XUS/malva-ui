---
# Library: density

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Density library (`@malva-ui/cdk/density`) connects the CSS density framework in `@malva-ui/styles` (new theme) to Angular components. It provides a global service, a set of density directives designed to be used as `hostDirectives`, a root directive for CSS cascade propagation, and a bootstrap provider for configuring the default density.

Components may support all five density levels (`tight`, `compact`, `comfortable`, `spacious`, `airy`) or only a restricted subset (e.g. tight + compact + comfortable only). The library provides a separate directive variant for each supported combination, ensuring type-safe inputs and correct fallback behaviour when the global service requests an unsupported density.

---

## Public API

Exported from `libs/cdk/density/src/index.ts`:

| Export                          | Kind                                              | Description                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvDensity`                    | Type                                              | `'tight' \| 'compact' \| 'comfortable' \| 'spacious' \| 'airy'`                                                                                                                                                                                                                       |
| `MLV_DENSITY_ELEMENT`           | `InjectionToken<string>`                          | BEM block name used to generate density modifier classes (e.g. `'button'` → `mlv-button--compact`); read from the directive's **own** element only (#239)                                                                                                                             |
| `MLV_DEFAULT_DENSITY`           | `InjectionToken<MlvDensity>`                      | Bootstrap-time default density; consumed by `MlvDensityService`                                                                                                                                                                                                                       |
| `MLV_DENSITY_CONTEXT`           | `InjectionToken<Signal<MlvDensity \| undefined>>` | The nearest density scope. Provided by **every** density directive (its explicit `mlvDensity`, else the scope it inherited, else `undefined` = no opinion); resolved by every density directive between the explicit input and the service. Widened from `Signal<MlvDensity>` in #364 |
| `MlvDensityContextSource`       | Interface                                         | `{ effectiveDensity: Signal<MlvDensity> }` — what `provideMlvDensityContext` reads                                                                                                                                                                                                    |
| `provideMlvDensity`             | Function                                          | `EnvironmentProviders` factory — call at app bootstrap to set the default density                                                                                                                                                                                                     |
| `provideMlvDensityContext`      | Function                                          | `Provider` factory a container adds next to its density host directive to project its resolved density                                                                                                                                                                                |
| `MlvDensityService`             | Service                                           | Singleton signal-based service; holds the global density state                                                                                                                                                                                                                        |
| `MlvDensityDirective`           | Directive                                         | Supports all five densities; use as `hostDirective`                                                                                                                                                                                                                                   |
| `MlvCompactComfortableDensity`  | Directive                                         | Restricts to tight + compact + comfortable; spacious/airy clamp to comfortable                                                                                                                                                                                                        |
| `MlvComfortableSpaciousDensity` | Directive                                         | Restricts to comfortable + spacious + airy; tight/compact clamp to comfortable                                                                                                                                                                                                        |
| `MlvCompactSpaciousDensity`     | Directive                                         | Restricts to tight + compact + spacious + airy (no comfortable); comfortable clamps to compact                                                                                                                                                                                        |
| `MlvDensityRootDirective`       | Directive                                         | Applies `mlv--{density}` to the host, enabling the CSS cascade for all density-aware descendants                                                                                                                                                                                      |

The shared density-effect factory is private implementation code; only the
tokens, service, providers, and directives above form the supported API.

---

## Tokens

### `MLV_DENSITY_ELEMENT`

```ts
export const MLV_DENSITY_ELEMENT = new InjectionToken<string>('MLV_DENSITY_ELEMENT');
```

**Purpose:** Components that integrate a density directive must provide this token with their BEM block name. The directive reads it at construction time — with `{ self: true }`, so only from its own element — and uses it to build the correct BEM modifier classes. A density directive whose element provides no name (a bare `<div mlvDensity="compact">`, or a host directive without the token) writes the region class `mlv--{density}` while it has an explicit `mlvDensity`, and nothing otherwise; it never borrows an ancestor component's block (#239, pinned by `density-scope.spec.ts`).

**Example:**

```ts
@Component({
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'button' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
export class MlvButton {}
// Applied classes: mlv-button--compact, mlv-button--comfortable, mlv-button--spacious
```

### `MLV_DEFAULT_DENSITY`

```ts
export const MLV_DEFAULT_DENSITY = new InjectionToken<MlvDensity>('MLV_DEFAULT_DENSITY');
```

**Purpose:** Optionally provided at bootstrap via `provideMlvDensity()`. If absent, `MlvDensityService` defaults to `'comfortable'`.

---

## Services

### `MlvDensityService`

**File:** `libs/cdk/density/src/lib/density.service.ts`

**Scope:** `providedIn: 'root'` — singleton

**Properties:**

| Name      | Type                 | Description                              |
| --------- | -------------------- | ---------------------------------------- |
| `density` | `Signal<MlvDensity>` | Current global density; read-only signal |

**Methods:**

| Name         | Signature                       | Description                       |
| ------------ | ------------------------------- | --------------------------------- |
| `setDensity` | `(density: MlvDensity) => void` | Updates the global density signal |

**Usage:**

```ts
private readonly densityService = inject(MlvDensityService);

// Read
const current = this.densityService.density(); // 'comfortable'

// Write
this.densityService.setDensity('compact');
```

---

## Directives

### `MlvDensityDirective`

**File:** `libs/cdk/density/src/lib/density.ts`

**Selector:** `[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="comfortable"], [mlvDensity="spacious"], [mlvDensity="airy"]`

**Supported densities:** all five — tight, compact, comfortable, spacious, airy

**Inputs:**

| Name         | Type                      | Description                                                                                        |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `mlvDensity` | `MlvDensity \| undefined` | Explicit density override; falls back to `MLV_DENSITY_CONTEXT`, then the service, when `undefined` |

**Properties:**

| Name               | Type                 | Description                                       |
| ------------------ | -------------------- | ------------------------------------------------- |
| `effectiveDensity` | `Signal<MlvDensity>` | The resolved density that was applied to the host |

**Usage as hostDirective:**

```ts
@Component({
  selector: 'mlv-button',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'button' }],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
})
export class MlvButton {}
```

```html
<!-- Template usage -->
<mlv-button mlvDensity="compact">Save</mlv-button>
<mlv-button>Follows the nearest density scope, else the service</mlv-button>
```

**Host class.** Written by a host `[class]` binding over a `computed` (no `effect()`, no `Renderer2`): Angular merges it key-wise with the consumer's static `class`, `[class.x]`, `[class]` and the host component's own `[class]` binding, and a change replaces only the previous modifier.

**Scope.** Every density directive provides `MLV_DENSITY_CONTEXT` for its descendants: its explicit `mlvDensity`, else the scope it inherited, else `undefined`. The value is **unclamped** — a restricted directive (`MlvCompactComfortableDensity`) sizes its own host to its nearest supported level but hands the requested level on.

**Selector limit.** The attribute selectors match static values only, so a **bound** `[mlvDensity]` on a plain element matches nothing. Bind it on a component that hosts the directive with the input (`form[mlvForm]`, `fieldset[mlvFieldset]`, `main[mlvPage]`, `mlv-sidebar`, `mlv-checkbox`, `mlv-radio`, …).

---

### `MlvCompactComfortableDensity`

**Selector:** `[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="comfortable"]`

**Supported densities:** tight, compact, comfortable

**Fallback:** When the resolved density (explicit input → ancestor `MLV_DENSITY_CONTEXT` → service) is outside the supported set, it clamps to the nearest supported level via `_findNearest` on the five-level scale — `'spacious'` and `'airy'` both resolve to `'comfortable'`.

**Input type:** `'tight' | 'compact' | 'comfortable' | undefined`

---

### `MlvComfortableSpaciousDensity`

**Selector:** `[mlvDensity="comfortable"], [mlvDensity="spacious"], [mlvDensity="airy"]`

**Supported densities:** comfortable, spacious, airy

**Fallback:** When the resolved density (explicit input → ancestor `MLV_DENSITY_CONTEXT` → service) is outside the supported set, it clamps to the nearest supported level via `_findNearest` on the five-level scale — `'tight'` and `'compact'` both resolve to `'comfortable'`.

**Input type:** `'comfortable' | 'spacious' | 'airy' | undefined`

---

### `MlvCompactSpaciousDensity`

**Selector:** `[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="spacious"], [mlvDensity="airy"]`

**Supported densities:** tight, compact, spacious, airy (skips comfortable)

**Fallback:** When the resolved density (explicit input → ancestor `MLV_DENSITY_CONTEXT` → service) is outside the supported set, it clamps to the nearest supported level via `_findNearest` on the five-level scale. Only `'comfortable'` (index 2) is unsupported, and it resolves to `'compact'`: compact (index 1) and spacious (index 3) are both distance 1 away, and the tie is broken in favour of the first in the supported array.

**Input type:** `'tight' | 'compact' | 'spacious' | 'airy' | undefined`

---

### `MlvDensityRootDirective`

**File:** `libs/cdk/density/src/lib/density-root.ts`

**Selector:** `[mlvDensityRoot]`

**Purpose:** Listens to `MlvDensityService.density()` and applies `mlv--{density}` BEM modifier class to the host element. This activates the CSS density cascade in `@malva-ui/styles` for all density-aware descendants, without needing per-component `[mlvDensity]` inputs.

**Usage:**

```html
<!-- Place once on the layout root or <body> -->
<mlv-page-shell mlvDensityRoot>
  <!-- All density-aware descendants respond to service density via CSS cascade -->
  <mlv-button>Automatically compact when service is compact</mlv-button>
</mlv-page-shell>
```

**CSS cascade interaction:**

`mlvDensityRoot` sets `class="mlv--compact"` (or comfortable/spacious). The SCSS density mixins in `@malva-ui/styles` use:

```scss
[class*='--compact'] &:not([class*='--comfortable'], [class*='--spacious']) {
  // compact styles
}
```

This selector matches descendants of a `mlv--compact` ancestor, unless the element itself has a BEM density modifier. Since #364 every Malva component styled through the mixins stamps one (from its own input, the nearest scope, or the service), so the root class sizes only application markup that carries none. `mlvDensityRoot` is **not** a density scope: it neither reads nor provides `MLV_DENSITY_CONTEXT`, because a root that published the global density would shadow every component-scoped `MlvDensityService` below it.

---

## Density context (ancestor projection)

**File:** `libs/cdk/density/src/lib/density.types.ts` / `density.providers.ts`

Resolution order inside every density directive (`_createDensityState`):
explicit `mlvDensity` input → nearest ancestor `MLV_DENSITY_CONTEXT`
(`inject(..., { optional: true, skipSelf: true })`, skipping `undefined`) →
`MlvDensityService`. Each step is clamped to the directive's supported set.

Nearest scope wins, by DI — never by stylesheet order (#364). Measured in
Chromium on compiled library CSS (`--form-ctrl-height` of an `mlv-input` in
`form[mlvForm] mlvDensity=<inner>` under an `<outer>` service): spacious >
compact 2.25rem, compact > tight 1.75rem, spacious > comfortable 2.75rem,
compact > spacious 3.25rem — the first three used to read 3.25rem / 2.25rem /
3.25rem.

- **Every density directive is a scope** (it provides the context through its
  own `providers`). One with no `mlvDensity` hands on the scope it inherited, or
  `undefined` — so it is transparent, and never shadows a nearer
  component-scoped `MlvDensityService`.
- `provideMlvDensityContext(<its density directive class>)` in a component's
  `providers` **replaces** that pass-through (a component provider beats a host
  directive's) with the container's resolved `effectiveDensity`, service
  included — the container pins what it resolved. `form[mlvForm]`, `mlv-tile`,
  `mlv-action-bar` and `mlv-switch-group` do this; `mlv-drawer-header` provides
  its own pin (`'compact'`).
- `skipSelf` guarantees a directive never reads the context it provides
  (circular otherwise).
- DI follows the **declaration** site. Content-projected children resolve
  through the element injector they are declared in, so
  `<form mlvForm mlvDensity="compact"><button mlvButton>` compacts the button;
  `mlv-popup` and `[mlvAutocomplete]` panels also read the token (after their
  explicit input, before the service), so dropdowns declared inside a scope
  inherit it. But an `<ng-template>` declared **outside** a scope and stamped
  inside it with `ngTemplateOutlet` resolves the declaration site's scope — the
  CSS cascade used to follow the DOM instead (pinned in
  `form-control-wrapper-density.spec.ts`).
- Region-only density (an ancestor `mlv--compact` class with no directive)
  cannot be read from JS, and since #364 it sizes no Malva component either —
  use `[mlvDensity="compact"]`, which is a scope.
- `MlvDensityRootDirective` tracks the service only and is not a scope (see
  above).

---

## Provider Function

### `provideMlvDensity`

**File:** `libs/cdk/density/src/lib/density.providers.ts`

**Returns:** `EnvironmentProviders`

**Usage at bootstrap:**

```ts
// app.config.ts
import { provideMlvDensity } from '@malva-ui/cdk/density';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideMlvDensity('compact'),
  ],
};
```

This sets `MLV_DEFAULT_DENSITY` which `MlvDensityService` reads at construction time. The service initialises its `density` signal to the provided value instead of the default `'comfortable'`.

---

## Internal Helpers (not exported)

### `_createDensityState(mlvDensityFn, supportedDensities)`

Factory called from each directive's field initializers (within an Angular injection context). Injects `MlvDensityService`, `MLV_DENSITY_ELEMENT` (`optional`, `self`) and `MLV_DENSITY_CONTEXT` (`optional`, `skipSelf`). Returns `{ effectiveDensity, hostClass, scope }`, all `computed`.

**Logic:**

1. `effectiveDensity`: if `mlvDensityFn()` returns a value (explicit input), use it when supported, else log a dev-mode warning and fall back to `_findNearest(supportedDensities, explicit)`. Otherwise use the ancestor context's value when it is not `undefined`, else `MlvDensityService.density()` — both clamped via `_findNearest`.
2. `hostClass`: `mlv-{element}--{effective}` when the host provides `MLV_DENSITY_ELEMENT`; else `mlv--{effective}` while there is an explicit input; else `''`. Bound through each directive's host `'[class]': '_hostClass()'`.
3. `scope`: `mlvDensityFn() ?? context?.()`, unclamped — what the directive's own `MLV_DENSITY_CONTEXT` provider hands to its descendants (exposed as the `@internal` `_scopeDensity`).

### `_findNearest(supported, requested)`

Finds the density in `supported` with the minimum absolute index distance from `requested` on the `['tight', 'compact', 'comfortable', 'spacious', 'airy']` scale (index 0–4).

---

## CSS Integration

The density system bridges two mechanisms:

| Mechanism                                | When to use                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **`mlvDensityRoot` + CSS cascade**       | Layout-level density applied to all descendants via `[class*="--compact"]` ancestor selector in SCSS mixins |
| **`MlvDensityDirective` (BEM modifier)** | Per-component density — applies `mlv-{element}--{density}` and overrides the cascade                        |

Both can coexist. The CSS cascade applies to elements without their own BEM density modifier. An element with `mlvDensityRoot`'s cascade AND a component-level BEM modifier will use its own BEM modifier (the SCSS mixin's `:not(...)` condition prevents the cascade from overriding it).

The cascade is **not** proximity-aware — with several matching ancestors the rule compiled last wins — so since #364 every component styled through the mixins carries a density directive and stamps its own modifier. Components that gained one then (none gained a new public input except where listed): `mlv-form-control-wrapper` and `mlv-label` (every text-style control — input, textarea, number-input, select, combobox, tokenizer, pickers, color-picker-popup — sizes through the wrapper), `mlv-checkbox` (+ `mlvDensity` input), `mlv-radio` (+ input), `mlv-list-item`, `main[mlvPage]` (+ input), `mlv-sidebar` (+ input), `mlv-tab-item`, `button[mlvSegmentedItem]`, `fieldset[mlvFieldset]` (+ input). An element selector inside a block (`&__tick`, `> legend`) carries no modifier, so `slider.scss` and `fieldset.scss` key theirs on the block's own modifier. A new component styled with the mixins needs the same wiring.

**Detached overlays (popovers/menus).** CDK overlays portal to `<body>`, outside any `mlvDensityRoot` region, so the cascade never reaches them on its own. `mlv-popup` restores it: its `mlvDensity` input (falling back to the nearest ancestor `MLV_DENSITY_CONTEXT`, then `MlvDensityService`) is stamped as a `mlv--{density}` class on the detached panel, and popup-embedding components (select, combobox, pagination, menu, breadcrumb) expose a forwarding `mlvDensity` input; `[mlvAutocomplete]` does the same on its bare-overlay panel via `mlvAutocompleteDensity`. That class alone no longer sizes the rows — since #364 an `mlv-list-item` stamps its own modifier, which shuts the panel class out — so the same value also travels by DI: `mlv-popup` provides `MLV_DENSITY_CONTEXT` (its `mlvDensity`, else the inherited scope) to the content declared in its `mlvPopupContent` template, `mlv-menu` provides it to projected and data-driven items (projected items resolve through the menu host, not the popup), and `[mlvAutocomplete]` builds its panel portal with a child injector carrying `mlvAutocompleteDensity`. DI follows the **declaration** site, so content declared elsewhere and rendered into a panel follows the scope it was declared in. Limitation: a region-only density (an ancestor class with no matching service/input value) cannot be read from JS — pass the input explicitly in that case.

**SCSS density mixin (from `@malva-ui/styles`):**

```scss
@mixin density-compact($element) {
  [class*='--compact'] &:not([class*='--comfortable'], [class*='--spacious']) {
    @content;
  }
  &[class*='--compact'] {
    @content;
  }
}
```

---

## Dependencies

| Package         | Version   | Role                       |
| --------------- | --------- | -------------------------- |
| `@angular/core` | `^22.0.0` | Signals, DI, host bindings |

---

## File Structure

```
libs/cdk/density/src/
  index.ts                          — public API barrel
  lib/
    density.types.ts                — MlvDensity, MLV_DENSITY_ELEMENT, MLV_DEFAULT_DENSITY, MLV_DENSITY_CONTEXT
    density.providers.ts            — provideMlvDensity(), provideMlvDensityContext(), MlvDensityContextSource
    density.service.ts              — MlvDensityService
    density.ts            — _createDensityState, _findNearest, four directive classes
    density-root.ts       — MlvDensityRootDirective
    density.service.spec.ts         — service unit tests
    density.spec.ts       — directive unit tests (four directive blocks + MLV_DENSITY_CONTEXT)
    density-scope.spec.ts — #364 / #239: nearest scope, transparent scopes, pins, host [class] merge
```

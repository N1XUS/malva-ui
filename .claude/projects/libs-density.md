---
# Library: density

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Density library (`@malva-ui/cdk/density`) connects the CSS density framework in `@malva-ui/styles` (new theme) to Angular components. It provides a global service, a set of density directives designed to be used as `hostDirectives`, a root directive for CSS cascade propagation, and a bootstrap provider for configuring the default density.

Components may support all five density levels (`tight`, `compact`, `comfortable`, `spacious`, `airy`) or only a restricted subset (e.g. tight + compact + comfortable only). The library provides a separate directive variant for each supported combination, ensuring type-safe inputs and correct fallback behaviour when the global service requests an unsupported density.

---

## Public API

Exported from `libs/cdk/density/src/index.ts`:

| Export                          | Kind                                 | Description                                                                                                |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `MlvDensity`                    | Type                                 | `'tight' \| 'compact' \| 'comfortable' \| 'spacious' \| 'airy'`                                            |
| `MLV_DENSITY_ELEMENT`           | `InjectionToken<string>`             | BEM block name used to generate density modifier classes (e.g. `'button'` → `mlv-button--compact`)         |
| `MLV_DEFAULT_DENSITY`           | `InjectionToken<MlvDensity>`         | Bootstrap-time default density; consumed by `MlvDensityService`                                            |
| `MLV_DENSITY_CONTEXT`           | `InjectionToken<Signal<MlvDensity>>` | Ancestor-projected density; resolved by every density directive between the explicit input and the service |
| `MlvDensityContextSource`       | Interface                            | `{ effectiveDensity: Signal<MlvDensity> }` — what `provideMlvDensityContext` reads                         |
| `provideMlvDensity`             | Function                             | `EnvironmentProviders` factory — call at app bootstrap to set the default density                          |
| `provideMlvDensityContext`      | Function                             | `Provider` factory a container adds next to its density host directive to project its resolved density     |
| `MlvDensityService`             | Service                              | Singleton signal-based service; holds the global density state                                             |
| `MlvDensityDirective`           | Directive                            | Supports all five densities; use as `hostDirective`                                                        |
| `MlvCompactComfortableDensity`  | Directive                            | Restricts to tight + compact + comfortable; spacious/airy clamp to comfortable                             |
| `MlvComfortableSpaciousDensity` | Directive                            | Restricts to comfortable + spacious + airy; tight/compact clamp to comfortable                             |
| `MlvCompactSpaciousDensity`     | Directive                            | Restricts to tight + compact + spacious + airy (no comfortable); comfortable clamps to compact             |
| `MlvDensityRootDirective`       | Directive                            | Applies `mlv--{density}` to the host, enabling the CSS cascade for all density-aware descendants           |

The shared density-effect factory is private implementation code; only the
tokens, service, providers, and directives above form the supported API.

---

## Tokens

### `MLV_DENSITY_ELEMENT`

```ts
export const MLV_DENSITY_ELEMENT = new InjectionToken<string>('MLV_DENSITY_ELEMENT');
```

**Purpose:** Components that integrate a density directive must provide this token with their BEM block name. The directive reads it at construction time and uses it to build the correct BEM modifier classes.

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
<mlv-button>Follows service density</mlv-button>
```

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

This selector matches descendants of a `mlv--compact` ancestor, unless the element itself has a BEM density modifier — which is what `MlvDensityDirective` applies when an explicit `[mlvDensity]` input is set.

---

## Density context (ancestor projection)

**File:** `libs/cdk/density/src/lib/density.types.ts` / `density.providers.ts`

Resolution order inside every density directive (`_createDensityEffect`):
explicit `mlvDensity` input → nearest ancestor `MLV_DENSITY_CONTEXT`
(`inject(..., { optional: true, skipSelf: true })`) → `MlvDensityService`.
Each step is clamped to the directive's supported set.

- A container opts in with `provideMlvDensityContext(<its density directive class>)`
  in `providers`, next to the hostDirective. Nothing in the library provided the
  context before `form[mlvForm]`, so existing behaviour is unchanged.
- `skipSelf` guarantees the container's own host directive never reads the
  context it provides (circular otherwise).
- Content-projected children resolve through the element injector of their
  declaration site, so `<form mlvForm mlvDensity="compact"><button mlvButton>`
  compacts the button. `mlv-popup` and `[mlvAutocomplete]` panels also read the
  token (after their explicit input, before the service), so dropdowns declared
  inside a context inherit it.
- Region-only density (an ancestor `mlv--compact` class with no directive/context)
  still cannot be read from JS — unchanged limitation.
- `MlvDensityRootDirective` intentionally tracks the service only: it is the root
  that opens the CSS cascade, so it neither reads nor provides `MLV_DENSITY_CONTEXT`.

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

### `_createDensityEffect(mlvDensityFn, supportedDensities)`

Factory function called from each directive's constructor (within an Angular injection context). Injects `MlvDensityService`, `MLV_DENSITY_ELEMENT`, `MLV_DENSITY_CONTEXT` (`optional`, `skipSelf`), `ElementRef`, and `Renderer2`. Returns a `Signal<MlvDensity>` (the `effectiveDensity`).

**Logic:**

1. If `mlvDensityFn()` returns a non-undefined value (explicit input):
   - If the value is in `supportedDensities`, use it directly.
   - Otherwise, log a dev-mode warning and fall back to `_findNearest(supportedDensities, explicit)`.
2. If no explicit input and an ancestor `MLV_DENSITY_CONTEXT` resolves: use its value, clamped to `supportedDensities` via `_findNearest`.
3. Otherwise: use `MlvDensityService.density()`, clamped the same way.
4. If `MLV_DENSITY_ELEMENT` is provided, sets up a reactive `effect()` that removes all `mlv-{element}--*` classes and adds the active one.

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

**Detached overlays (popovers/menus).** CDK overlays portal to `<body>`, outside any `mlvDensityRoot` region, so the cascade never reaches them on its own. `mlv-popup` restores it: its `mlvDensity` input (falling back to the nearest ancestor `MLV_DENSITY_CONTEXT`, then `MlvDensityService`) is stamped as a `mlv--{density}` class on the detached panel, and popup-embedding components (select, combobox, pagination, menu, breadcrumb) expose a forwarding `mlvDensity` input; `[mlvAutocomplete]` does the same on its bare-overlay panel via `mlvAutocompleteDensity`. Limitation: a region-only density (an ancestor class with no matching service/input value) cannot be read from JS — pass the input explicitly in that case.

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

| Package           | Version   | Role                      |
| ----------------- | --------- | ------------------------- |
| `@angular/core`   | `^22.0.0` | Signals, effects, DI      |
| `@angular/common` | `^22.0.0` | `Renderer2`, `ElementRef` |

---

## File Structure

```
libs/cdk/density/src/
  index.ts                          — public API barrel
  lib/
    density.types.ts                — MlvDensity, MLV_DENSITY_ELEMENT, MLV_DEFAULT_DENSITY, MLV_DENSITY_CONTEXT
    density.providers.ts            — provideMlvDensity(), provideMlvDensityContext(), MlvDensityContextSource
    density.service.ts              — MlvDensityService
    density.ts            — _createDensityEffect, _findNearest, four directive classes
    density-root.ts       — MlvDensityRootDirective
    density.service.spec.ts         — service unit tests
    density.spec.ts       — directive unit tests (four directive blocks + MLV_DENSITY_CONTEXT)
```

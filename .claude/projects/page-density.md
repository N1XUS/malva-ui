# Docs Page: Density

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/density`
- **Component:** `DensityPageComponent` (`apps/docs/src/app/pages/density/index.ts`)

## Overview

Service and directives that connect the CSS density framework to Angular components, enabling compact, comfortable, and spacious layout variants.

## Examples

| #   | Title                                    | What it demonstrates                                                                                             |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Global Density Control                   | Locally provided `MlvDensityService` demonstrates runtime root density without mutating the docs shell           |
| 2   | Per-Component Density via hostDirectives | `MlvDensityDirective` as a `hostDirective` with `MLV_DENSITY_ELEMENT` token for BEM modifier classes             |
| 3   | Overriding Density per Element           | `[mlvDensity]` input overrides the global service value for individual elements                                  |
| 4   | Restricted Density with Fallback         | `MlvCompactComfortableDensity` / `MlvComfortableSpaciousDensity` for components supporting only a density subset |

## Libraries Used

- `@malva-ui/cdk/density` — primary component library for this page

Every interactive example on this page provides its own `MlvDensityService`, keeping its state inside the preview while preserving the same provider pattern applications use at their layout root.

# Docs Page: Home

> **Keep this file up to date.** Whenever the home page content changes, update this document.

---

## Route

- **Path:** `/` (root)
- **Component:** `HomePageComponent` (`apps/docs/src/app/pages/home/home.ts`)

## Overview

Full-width product landing page for Malva UI. The root route intentionally renders outside the documentation shell, so it has its own responsive header, content rhythm, and footer without the component-guide sidebar or table of contents. Its primary hero and final call to action link to `/getting-started`, and the displayed install command is `ng add @malva-ui/core`.

## Notes

This page does **not** use `DocPageComponent`. It is a vibrant, light-first editorial landing template. Section order:

- **Hero** — aurora background (three blurred radial blobs on slow keyframe drift), a rotating headline word (`HERO_WORDS`: finished / accessible / themeable / alive, crossfaded every 2.8s in an inline-grid word slot; the animated slot is `aria-hidden` with a visually-hidden static fallback for screen readers), Get Started / Explore Components actions, the copyable schematic command, and theme-aware codex-generated glass artwork (`/malva-ui-hero-glass-light.webp` on light, `/malva-ui-hero-glass-dark.webp` composited with `mix-blend-mode: screen` on dark) with floating annotation cards on a mouse-only pointer parallax.
- **Component marquee rail** (`docs-home-marquee`) — two infinite, opposite-direction marquee rows of 24 component chip links (icon + label). Each row is a real link track plus an `aria-hidden` ghost track of spans; hover/focus pauses the animation and reduced-motion swaps to two static scrollable rows. The rail grid track is `minmax(0, 100%)` — the max-content marquee rows must not set the section (and page) width.
- **Stat counters band** (`docs-home-stats`) — 80+ components / 14 locales / 6 full showcases / 100% reduced-motion coverage, counting up with a cubic-ease rAF once ≥40% visible; values are seeded at their targets and only zeroed when motion is allowed, so jsdom and reduced-motion render final numbers.
- **Launch planner** product scene (stepper, list, chip, calendar, avatar, button, kbd — unchanged composition).
- **Application composition** — dark, independently themed navigation chrome with a **native page canvas**: a `<section mlvTheme="light">` composing real `mlv-page-header` (`mlvPageTitle` / `mlvPageHeaderDescription` / `mlvPageHeaderActions` templates and an `mlv-page-summary` with three `mlv-page-summary-item`s) and `mlv-page-content` with the two product cards. Not a `main[mlvPage]` — the landing page already owns the sole `main` landmark.
- **Theme split** (`docs-home-theme-split`, deferred) — one card scene stamped twice via `ngTemplateOutlet` into a forced-light and a forced-dark (`mlvTheme` island) layer, the dark layer clipped by `clip-path: inset(... var(--home-theme-split))`. The stage is decorative (`aria-hidden`); the accessible control is an `mlv-slider` (6–94) driving the split custom property. Both scene layers force their theme so the demo reads light|dark under either app theme.
- **Interactive bento grid** (`docs-home-bento`, deferred) — nine live-control tiles (rating, slider mirrored by progress, switches, pin input, segmented, icon toggles, badge/chip wall, avatars + pulsing status indicator), each with an `a mlvLink` header arrow to its docs page.
- **Signal-form scene**, **timeline scene**, and the loading / populated / empty three-state composition (unchanged).
- **Showcase reel** (`docs-home-showcase-reel`, deferred) — horizontal scroll-snap reel of all `SHOWCASES` registry cards using `NgOptimizedImage` route previews (gradient fallback if a `previewAsset` is null), hover lift/tilt, and a Browse-all link to `/showcases`.
- Principle summaries, then the **CTA** with codex aurora artwork (`/malva-ui-cta-aurora.webp`, absolute right, `mix-blend-mode: screen`, left mask fade); the `mlv-copy-to-clipboard` command sits on a translucent scrim pill for contrast over the artwork.
- Footer with brand, tagline, and Docs / Components / Themes / Showcases links.

**Motion system:** `DocsReveal` (`[docsReveal]`, `reveal.ts`) is an IntersectionObserver-driven enter-reveal (opacity + translateY, optional `docsRevealDelay` stagger) applied across sections. It, the word rotation, the marquee, the counters, and the aurora all gate on `IntersectionObserver`/`matchMedia` availability and `prefers-reduced-motion`, so jsdom specs and reduced-motion users get final-state static rendering. The theme/bento/reel sections load under `@defer (on viewport)` with fixed-height placeholders (`__defer-slot`), keeping them out of the initial bundle.

There is no `examples/` directory for this page. The live compositions are part of the landing page itself.

**Assets** (in `apps/docs/public/`, all codex-generated): `malva-ui-hero-glass-light.webp`, `malva-ui-hero-glass-dark.webp`, `malva-ui-cta-aurora.webp`. The dark hero and CTA art carry baked black backgrounds and are composited with `mix-blend-mode: screen`; the light hero art is drawn on flat white. `malva-ui-hero-abstract.png` remains only because the project-workspace showcase uses it.

## Libraries Used

The page dogfoods grouped public imports from `@malva-ui/core/*`: avatar, button, calendar, card, checkbox, chip, copy-to-clipboard, empty-state, form-utils, icon-toggle, input, kbd, layout theme service, link, list, page, pin-input, progress, rating, segmented, select, skeleton, slider, status-indicator, stepper, switch, and timeline. It also uses Angular signal forms, the router, `NgOptimizedImage`, and named Lucide icon directives (plus `LucideDynamicIcon`'s `svg[lucideIcon]` form for the marquee's data-driven icons).

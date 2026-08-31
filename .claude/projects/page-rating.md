---
# Page: rating

> **Keep this file up to date.** Update whenever examples, route, or sidebar configuration change.

---

## Overview

Documentation page for the `mlv-rating` component. Route: `/rating`.

Component class: `RatingPageComponent` — `apps/docs/src/app/pages/rating/index.ts`.

---

## Examples

| #   | Selector                             | Description                                                  |
| --- | ------------------------------------ | ------------------------------------------------------------ |
| 1   | `docs-rating-basic-example`          | 5-star whole-star picker via `ngModel`, shows selected value |
| 2   | `docs-rating-half-star-example`      | `[step]="0.5"` for fractional hover preview and selection    |
| 3   | `docs-rating-readonly-example`       | `[readonly]="true"` with preset values — static display      |
| 4   | `docs-rating-reactive-forms-example` | `[formControl]` with disabled toggle and validation message  |
| 5   | `docs-rating-custom-max-example`     | `[max]="10"` — configurable star count                       |
| 6   | `docs-rating-signal-forms-example`   | `[formField]` value, touched, and schema-disabled state      |

---

## Route

```ts
{
  path: 'rating',
  loadComponent: () =>
    import('./pages/rating/index').then((m) => m.RatingPageComponent),
}
```

## Sidebar

Group: **Forms** — `{ label: 'Rating', link: '/rating', icon: LucideStar }`

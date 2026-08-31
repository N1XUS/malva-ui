# @malva-ui/cdk

Headless infrastructure primitives for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — overlays, density, data sources, accessibility and observer utilities.

Nothing here renders opinionated chrome. These are the behaviour building blocks that `@malva-ui/core` is built on, published separately so you can reuse them in your own components.

## Install

```bash
npm install @malva-ui/cdk
```

Installed automatically by `ng add @malva-ui/core`.

## Entry points

Import from the narrow entry point, never a root barrel.

| Entry point                        | What it gives you                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@malva-ui/cdk/accessibility`      | `MlvClick` (`[mlvClick]`) for keyboard-accessible click events; `MlvTabbableElementService`                    |
| `@malva-ui/cdk/data-source`        | `MlvDataSource` / `MlvArrayDataSource` — sort, filter, search, page and `loading` state                        |
| `@malva-ui/cdk/density`            | `MlvDensityService`, `MlvDensityDirective`, `MlvDensityRootDirective` — compact/comfortable/spacious layouts   |
| `@malva-ui/cdk/floating-container` | `MlvFloatingContainer` (`[mlvFloatingContainer]`) — sticky floating footer with a gradient-masked backdrop     |
| `@malva-ui/cdk/infinite-scroll`    | `MlvInfiniteScroll` (`[mlvInfiniteScroll]`) — `loadMore` near the far edge, listeners outside the Angular zone |
| `@malva-ui/cdk/overlay`            | `MlvOverlayHostBase`, `MlvOverlayServiceBase`, `MlvOverlayRef` — the base for dialogs and drawers              |
| `@malva-ui/cdk/utils`              | `MlvAutofocus`, `MlvSpacer`, `MlvResizeObserverService`, `MlvBreakpointService`, `MlvFade`, `MlvTone`          |

## Quick start

```ts
import { MlvClick } from '@malva-ui/cdk/accessibility';
import { MlvDensityDirective } from '@malva-ui/cdk/density';
import { MlvAutofocus } from '@malva-ui/cdk/utils';
```

```html
<!-- Enter and Space activate it, and it joins the tab order -->
<div [mlvClick]="select()">Selectable row</div>
```

A data source drives paging, sorting and search for `mlv-data-table` and the option controls:

```ts
import { MlvArrayDataSource } from '@malva-ui/cdk/data-source';

// Accepts a plain array or a Signal<T[]>
const source = new MlvArrayDataSource(users);

// `keys` lists the row keys allowed to match; an empty array
// means "match against the source's natural fields"
source.setSearch({ query: 'ada', keys: ['name', 'email'] });
source.setPerPage(25);
```

`source.connect()` returns the resolved slice as a `Signal<T[]>`, and
`source.totalItems()` / `source.loading()` are signals too — so the view
updates without any manual subscription.

## Peer dependencies

`@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `rxjs`.

## Related packages

- [`@malva-ui/core`](https://www.npmjs.com/package/@malva-ui/core) — the component library
- [`@malva-ui/i18n`](https://www.npmjs.com/package/@malva-ui/i18n) — localisation
- [`@malva-ui/editor`](https://www.npmjs.com/package/@malva-ui/editor) — rich-text editor

## License

MIT

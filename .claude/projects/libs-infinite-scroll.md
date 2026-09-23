# @malva-ui/cdk/infinite-scroll

> **Keep this file up to date.** Whenever the directive API, behavior, or styling changes, update this file.

**Path:** `libs/cdk/infinite-scroll`
**Import path:** `@malva-ui/cdk/infinite-scroll` (also re-exported from `@malva-ui/cdk`)

Attribute directive that emits a `loadMore` event when the user scrolls within a configurable threshold of the far edge of a scroll container. Apply it directly to any scrollable element or point it at an external scroll container via the `scrollContainer` input. The directive runs scroll listeners outside the Angular zone and only re-enters the zone to emit the output, so it can be safely attached to fast-scrolling lists.

---

## Public API

| Export                         | Kind      | Description                                            |
| ------------------------------ | --------- | ------------------------------------------------------ |
| `MlvInfiniteScroll`            | Directive | `[mlvInfiniteScroll]` attribute directive              |
| `MlvInfiniteScrollOrientation` | Type      | `'vertical' \| 'horizontal'`                           |
| `MlvInfiniteScrollTrigger`     | Interface | `loadMore` event payload (`{ distance, orientation }`) |

---

## Directive

### `MlvInfiniteScroll`

**File:** `libs/cdk/infinite-scroll/src/lib/infinite-scroll.ts`
**Selector:** `[mlvInfiniteScroll]`
**Exported as:** `mlvInfiniteScroll`

#### Inputs

| Input             | Type                                             | Default      | Description                                                         |
| ----------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------- |
| `threshold`       | `number`                                         | `150`        | Distance in px from the far edge at which `loadMore` fires          |
| `loading`         | `BooleanInput`                                   | `false`      | Suppresses the output while a fetch is in flight                    |
| `hasMore`         | `BooleanInput`                                   | `true`       | Stops the directive from emitting once the data source is exhausted |
| `disabled`        | `BooleanInput`                                   | `false`      | Detaches all listeners                                              |
| `orientation`     | `'vertical' \| 'horizontal'`                     | `'vertical'` | Which axis to measure scroll distance along                         |
| `scrollContainer` | `HTMLElement \| ElementRef<HTMLElement> \| null` | `null`       | Optional external scroll container; defaults to the host element    |

#### Outputs

| Output     | Type                       | Description                                                                |
| ---------- | -------------------------- | -------------------------------------------------------------------------- |
| `loadMore` | `MlvInfiniteScrollTrigger` | Emits with `{ distance, orientation }` when the user crosses the threshold |

#### Public methods

| Method    | Description                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `check()` | Imperatively re-evaluates the scroll position. Call after appending new rows when the content still does not fill the viewport. |

#### Behavior notes

- The scroll listener is attached via `Renderer2.listen` inside `NgZone.runOutsideAngular`. The directive only re-enters the zone to emit `loadMore`, keeping scroll frame budgets clean.
- A `_pendingFire` guard prevents duplicate emissions during a single scroll crossing. Consumers should flip `loading` synchronously in the `loadMore` handler to suppress further emissions until the fetch resolves.
- On first render (`afterNextRender`), the directive checks whether the container is already within threshold and fires immediately — useful when the initial page does not fill the viewport.
- Rebinding is handled via `effect()`: changes to `scrollContainer`, `disabled`, or `orientation` re-attach the listener to the correct element.
- **Horizontal RTL (#308):** the distance to the inline end is `scrollWidth - Math.abs(scrollLeft) - clientWidth`. Per CSSOM View `scrollLeft` is `0` at the inline start in both directions and runs **negative** toward the end of an RTL scroller, so its magnitude is the distance travelled — direction-agnostic, no `[dir]` lookup, identical in LTR. Before #308 an RTL strip read `scrollWidth + |scrollLeft| - clientWidth` at its end and never fired `loadMore`. Pinned by `infinite-scroll.spec.ts` (LTR, global RTL, scoped RTL).
- All cleanup is registered via `DestroyRef.onDestroy`.

---

## Usage

### Standalone scroll container

```html
<div class="feed" mlvInfiniteScroll [threshold]="200" [loading]="isLoading()" [hasMore]="hasMore()" (loadMore)="fetchNextPage()">
  @for (item of items(); track item.id) {
  <app-feed-item [item]="item" />
  } @if (isLoading()) {
  <mlv-loader variant="bar" [indeterminate]="true" />
  }
</div>
```

### External scroll container

```html
<div #scrollHost class="scroll-host">
  <ng-container mlvInfiniteScroll [scrollContainer]="scrollHost" (loadMore)="fetchNextPage()" />
  <!-- rows -->
</div>
```

### Via `hostDirectives`

```ts
@Component({
  selector: 'app-feed',
  hostDirectives: [
    {
      directive: MlvInfiniteScroll,
      inputs: ['threshold', 'loading', 'hasMore', 'disabled', 'orientation', 'scrollContainer'],
      outputs: ['loadMore'],
    },
  ],
})
export class FeedComponent {}
```

---

## Dependencies

| Package         | Version   |
| --------------- | --------- |
| `@angular/core` | `^22.0.0` |
| `@angular/cdk`  | `^22.0.0` |

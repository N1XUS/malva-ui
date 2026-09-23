---
# Library: timeline

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/timeline` provides a vertical timeline component for visualising ordered sequences of events. It is composed of two components (`mlv-timeline`, `mlv-timeline-item`) and two slot directives (`[mlvTimelineItemIcon]`, `[mlvTimelineItemMeta]`).

The timeline renders as an ordered list (`role="list"`) with each item as a `role="listitem"`. Items use a 3-column CSS grid: left content column, centre spine (node circle + connector line), and right content column. The `direction` input on each item controls which column shows the content, enabling alternating left/right layouts. The connector line on the last child is hidden automatically via the CSS `:last-child` selector — no Angular logic required.

---

## Public API

| Export                     | Kind      | Description                                                       |
| -------------------------- | --------- | ----------------------------------------------------------------- | ------------------- | --------- | --------- | -------- | ----------- |
| `MlvTimeline`              | Component | Container — `mlv-timeline`                                        |
| `MlvTimelineItem`          | Component | Single event entry — `mlv-timeline-item`                          |
| `MlvTimelineItemIcon`      | Directive | Template slot for the node icon — `[mlvTimelineItemIcon]`         |
| `MlvTimelineItemMeta`      | Directive | Template slot for metadata badges/chips — `[mlvTimelineItemMeta]` |
| `MlvTimelineItemTone`      | Type      | `MlvTone                                                          | 'default'` (`'info' | 'success' | 'warning' | 'danger' | 'default'`) |
| `MlvTimelineItemDirection` | Type      | `'left'                                                           | 'right'`            |

---

## Components

### `MlvTimeline`

**File:** `libs/core/timeline/src/lib/timeline/timeline.ts`
**Selector:** `mlv-timeline`
**Change Detection:** `OnPush`
**Encapsulation:** `ViewEncapsulation.None`

The container component. Renders as a flex column list (`display: flex; flex-direction: column`). Content-projects `mlv-timeline-item` children directly with `<ng-content />`.

It also queries its projected items (`contentChildren(MlvTimelineItem, { descendants: true })`) to decide whether the timeline is **single-sided** — see below.

#### Automatic single-side collapse

A `mlv-timeline-item` is a three-column grid (`[content-left] [spine] [content-right]`) so items can alternate sides. When **every** projected item shares the same `direction`, the opposite column carries nothing, so the timeline collapses its items to a **two-column** grid instead of reserving `1fr` plus a column gap for an empty track. Since `direction` defaults to `'right'`, a plain timeline collapses by default and its content gets the full width.

- No consumer opt-in — it is driven entirely by the projected items' `direction`.
- Fully reactive: `direction` is a signal input and the item query is a signal, so the modifier follows runtime direction flips and items being added/removed.
- An **empty** timeline gets neither modifier.
- A timeline that **mixes** directions gets neither modifier and keeps the full three-column layout.
- The unused track is _removed_, not zeroed — a `0`-width column would still emit the `1.5rem` column gap and leave a visible dead inset next to the spine.
- The modifier lives on the parent, so a bare `mlv-timeline-item` used **outside** a `mlv-timeline` renders exactly as before (full three-column grid).

#### Host Bindings

| Binding                              | Value                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| `class`                              | `'mlv-timeline'` (static)                                       |
| `role`                               | `'list'` (static)                                               |
| `[class.mlv-timeline--single-left]`  | `_isSingleLeft()` — has items, none of them `direction="right"` |
| `[class.mlv-timeline--single-right]` | `_isSingleRight()` — has items, none of them `direction="left"` |

#### Inputs

None.

#### Outputs

None.

#### Content Children (protected)

| Name     | Type                                                      | Description                                                                 |
| -------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `_items` | `contentChildren(MlvTimelineItem, { descendants: true })` | Projected timeline items; drives the single-side collapse computed signals. |

#### SCSS

BEM block: `.mlv-timeline`

| Class                         | Description                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-timeline`               | Block root; `display: flex; flex-direction: column; list-style: none`                                                                    |
| `.mlv-timeline--single-right` | All items on the right — items become `grid-template-columns: var(--mlv-tli-node-size) 1fr`; spine → column 1, `__col--right` → column 2 |
| `.mlv-timeline--single-left`  | All items on the left — items become `grid-template-columns: 1fr var(--mlv-tli-node-size)`; `__col--left` → column 1, spine → column 2   |

---

### `MlvTimelineItem`

**File:** `libs/core/timeline/src/lib/timeline/timeline-item.ts`
**Selector:** `mlv-timeline-item`
**Change Detection:** `OnPush`
**Encapsulation:** `ViewEncapsulation.None`
**Imports:** `NgTemplateOutlet`

A single event entry rendered in a 3-column CSS grid. The node circle sits in the centre column; content appears in the left or right column depending on `direction()`. The connector line extends below the node and is hidden on `:last-child` via CSS.

A single content column is rendered and moved between grid tracks by the `direction()` class binding, so no empty `role="generic"` column box lands in the accessibility tree. Both children are pinned to an explicit `grid-column`, so placement never depends on DOM order. When the parent `mlv-timeline` is single-sided the grid drops to two tracks; see [Automatic single-side collapse](#automatic-single-side-collapse).

#### Host Bindings

| Binding                                     | Value                            |
| ------------------------------------------- | -------------------------------- |
| `class`                                     | `'mlv-timeline-item'` (static)   |
| `role`                                      | `'listitem'` (static)            |
| `[class]`                                   | `"mlv-timeline-item--" + tone()` |
| `[class.mlv-timeline-item--direction-left]` | `direction() === 'left'`         |

#### Inputs

| Name        | Type                       | Default     | Required | Description                                                                                                          |
| ----------- | -------------------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `title`     | `string`                   | —           | Yes      | Heading text for this timeline event.                                                                                |
| `timestamp` | `string`                   | `''`        | No       | Date/time string rendered in a `<time>` element. Use ISO 8601 for machine-readable precision.                        |
| `tone`      | `MlvTimelineItemTone`      | `'default'` | No       | Accent colour of the node circle.                                                                                    |
| `direction` | `MlvTimelineItemDirection` | `'right'`   | No       | Which column shows the content. `'right'` = node left, content right (default). `'left'` = content left, node right. |

#### Outputs

None.

#### Content Children (protected)

| Name       | Type                                | Description                                                                                                  |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `_iconRef` | `contentChild(MlvTimelineItemIcon)` | Optional icon/avatar template for the node circle. When absent, the node renders as a plain coloured circle. |
| `_metaRef` | `contentChild(MlvTimelineItemMeta)` | Optional metadata template (badges, chips) rendered in the item header.                                      |

#### Template Summary

The template renders exactly **two** children into the grid — one content column and the spine. The column is declared once and _moves_ between grid tracks via a class binding; there is no second, empty column.

1. **Content column** (`.mlv-timeline-item__col`) — always rendered, always populated. It picks up `--left` or `--right` from `direction()`, which pins it to grid column 1 or 3:
   - `.mlv-timeline-item__header`: title span, optional `<time>` timestamp, optional meta slot.
   - `.mlv-timeline-item__description`: default `<ng-content />` for the event description.

2. **Centre spine** (`.mlv-timeline-item__spine`) — always rendered:
   - `.mlv-timeline-item__node-circle`: coloured circle (tone-driven). Renders `_iconRef` template if present (`aria-hidden="true"` on the icon wrapper).
   - `.mlv-timeline-item__connector`: vertical line below the node (`aria-hidden="true"`); hidden on `:last-child`.

The column always precedes the spine in DOM order, so the reading order is content-then-decoration for both directions while CSS grid handles the visual side. Because DOM order is therefore **not** monotonic in column index for `direction="left"`, both children also carry an explicit `grid-row: 1`; without it, sparse auto-placement pushes the spine onto a second implicit row and the node drifts below its own header. The header layout for `direction === 'left'` uses `flex-direction: row-reverse` so the timestamp appears before the title visually.

> The column used to be declared **twice** — once per side, with the inactive one rendered as an empty box — and each copy carried its own `<ng-content />`. Two default-selector `<ng-content />` outlets cannot both receive the projected nodes, so `direction="left"` items silently dropped their description. Declaring the column once fixes that and keeps the accessibility tree free of empty `role="generic"` boxes.

#### SCSS

BEM block: `.mlv-timeline-item`

| Class                                | Description                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `.mlv-timeline-item`                 | Block root; 3-column CSS grid (`1fr <node-size> 1fr`)                            |
| `.mlv-timeline-item__col`            | The single content column wrapper (gains `--left` or `--right`); `grid-row: 1`   |
| `.mlv-timeline-item__col--left`      | Left text column (`grid-column: 1`; `text-align: right`)                         |
| `.mlv-timeline-item__col--right`     | Right text column (`grid-column: 3`; `text-align: left`)                         |
| `.mlv-timeline-item__spine`          | Centre column flex container (`grid-row: 1`; `grid-column: 2`; node + connector) |
| `.mlv-timeline-item__node-circle`    | Coloured circle; size: `--mlv-tli-node-size` (2.5rem)                            |
| `.mlv-timeline-item__node-icon`      | Icon wrapper inside node circle (`aria-hidden`)                                  |
| `.mlv-timeline-item__connector`      | Vertical line; `min-height: --mlv-spacing-8`; hidden on `:last-child`            |
| `.mlv-timeline-item__content`        | Padded content area; `padding-bottom: --mlv-spacing-8`; 0 on `:last-child`       |
| `.mlv-timeline-item__content--left`  | Right-aligns text for left-direction items                                       |
| `.mlv-timeline-item__header`         | Flex row (title + timestamp + meta); `gap: 0.5rem`                               |
| `.mlv-timeline-item__title`          | Semibold heading; `--mlv-font-size-m`                                            |
| `.mlv-timeline-item__timestamp`      | Muted secondary text; `--mlv-typography-ui-s`; `white-space: nowrap`             |
| `.mlv-timeline-item__meta`           | Inline-flex container for badge/chip slots                                       |
| `.mlv-timeline-item__description`    | Secondary-colour body text; `--mlv-font-size-m`                                  |
| `.mlv-timeline-item--default`        | Node colour: `--mlv-border-normal`                                               |
| `.mlv-timeline-item--success`        | Node colour: `--mlv-background-success-1`                                        |
| `.mlv-timeline-item--warning`        | Node colour: `--mlv-background-warning-1`                                        |
| `.mlv-timeline-item--danger`         | Node colour: `--mlv-background-danger-1`                                         |
| `.mlv-timeline-item--info`           | Node colour: `--mlv-background-info-1`                                           |
| `.mlv-timeline-item--direction-left` | Header flex-direction reversed                                                   |

CSS custom properties (component-scoped):

| Variable                    | Default                    | Description                                          |
| --------------------------- | -------------------------- | ---------------------------------------------------- |
| `--mlv-tli-node-bg`         | `var(--mlv-border-normal)` | Node circle background; overridden by tone modifiers |
| `--mlv-tli-node-size`       | `2.5rem`                   | Node circle diameter                                 |
| `--mlv-tli-connector-width` | `0.125rem`                 | Connector line thickness                             |

---

## Directives

### `MlvTimelineItemIcon`

**File:** `libs/core/timeline/src/lib/timeline/timeline-item-icon.ts`
**Selector:** `[mlvTimelineItemIcon]`

Template slot directive used inside `<mlv-timeline-item>` to provide a custom icon or avatar for the node circle. When present, its template replaces the default plain-circle indicator.

**Usage:** wrap content in `<ng-template mlvTimelineItemIcon>`.

| Member        | Type                     | Description                                                                |
| ------------- | ------------------------ | -------------------------------------------------------------------------- |
| `templateRef` | `TemplateRef` (injected) | Template reference rendered inside the node circle via `ngTemplateOutlet`. |

---

### `MlvTimelineItemMeta`

**File:** `libs/core/timeline/src/lib/timeline/timeline-item-meta.ts`
**Selector:** `[mlvTimelineItemMeta]`

Template slot directive for supplementary metadata (badges, chips, status indicators) displayed in the timeline item header alongside the title and timestamp.

**Usage:** wrap content in `<ng-template mlvTimelineItemMeta>`.

| Member        | Type                     | Description                                                                       |
| ------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `templateRef` | `TemplateRef` (injected) | Template reference rendered in `.mlv-timeline-item__meta` via `ngTemplateOutlet`. |

---

## Interfaces & Types

### `MlvTimelineItemTone`

```typescript
type MlvTimelineItemTone = MlvTone | 'default'; // 'info' | 'success' | 'warning' | 'danger' | 'default'
```

Controls the node circle accent colour via BEM modifier and CSS custom property override.

| Value       | Node colour token            | Icon colour token       |
| ----------- | ---------------------------- | ----------------------- |
| `'default'` | `--mlv-border-normal`        | `--mlv-text-primary`    |
| `'success'` | `--mlv-background-success-1` | `--mlv-text-on-success` |
| `'warning'` | `--mlv-background-warning-1` | `--mlv-text-on-warning` |
| `'danger'`  | `--mlv-background-danger-1`  | `--mlv-text-on-danger`  |
| `'info'`    | `--mlv-background-info-1`    | `--mlv-text-on-info`    |

- Each fill carries its own foreground, so an `[mlvTimelineItemIcon]` glyph keeps 3:1 on its node in every theme (`tone-contrast.spec.mjs`).
- #302: every tone used to paint `--mlv-text-primary-on-accent-1` (white) — 1.26:1 on the grey default node.
- The foreground travels in `--mlv-tli-node-color` — **internal, not an override point** (absent from the table above on purpose; may change in a patch). Retheme through the `--mlv-text-on-*` tokens.

### `MlvTimelineItemDirection`

```typescript
type MlvTimelineItemDirection = 'left' | 'right';
```

Controls which column (left or right of the centre spine) shows the event content.

| Value               | Content column | BEM modifier                         |
| ------------------- | -------------- | ------------------------------------ |
| `'right'` (default) | Right column   | (none)                               |
| `'left'`            | Left column    | `.mlv-timeline-item--direction-left` |

Mixing both values within one `mlv-timeline` is what keeps the wide three-column layout. A timeline whose items all share one value collapses to two columns automatically — see [Automatic single-side collapse](#automatic-single-side-collapse).

---

## Usage Examples

### Basic timeline

```html
<mlv-timeline>
  <mlv-timeline-item title="Submitted" timestamp="Mar 24, 2025" tone="info"> Form submitted by the user. </mlv-timeline-item>
  <mlv-timeline-item title="Under Review" timestamp="Mar 25, 2025" tone="warning"> Awaiting manager approval. </mlv-timeline-item>
  <mlv-timeline-item title="Approved" timestamp="Mar 26, 2025" tone="success"> Request approved and completed. </mlv-timeline-item>
</mlv-timeline>
```

### Custom icon in the node circle

```html
<mlv-timeline>
  <mlv-timeline-item title="Deployed" timestamp="2025-03-26T10:00:00" tone="success">
    <ng-template mlvTimelineItemIcon>
      <svg lucideRocket [size]="16" />
    </ng-template>
    Release v2.0.0 was deployed to production.
  </mlv-timeline-item>
  <mlv-timeline-item title="Rolled back" timestamp="2025-03-27T08:30:00" tone="danger">
    <ng-template mlvTimelineItemIcon>
      <svg lucideRotateCcw [size]="16" />
    </ng-template>
    Rollback initiated due to critical bug.
  </mlv-timeline-item>
</mlv-timeline>
```

### Metadata slot (badge/chip in header)

```html
<mlv-timeline>
  <mlv-timeline-item title="Code Review" timestamp="Mar 25, 2025">
    <ng-template mlvTimelineItemMeta>
      <mlv-badge color="warning">Pending</mlv-badge>
    </ng-template>
    Awaiting code review from the team.
  </mlv-timeline-item>
  <mlv-timeline-item title="Merged" timestamp="Mar 26, 2025" tone="success">
    <ng-template mlvTimelineItemMeta>
      <mlv-badge color="success">Done</mlv-badge>
    </ng-template>
    Pull request merged to main.
  </mlv-timeline-item>
</mlv-timeline>
```

### Alternating left/right layout

Mixing `direction` values keeps the full three-column layout. Uniform-direction timelines (including the default, all-`'right'` case) collapse to two columns on their own.

```html
<mlv-timeline>
  <mlv-timeline-item title="Step 1" timestamp="Jan 2025" tone="info" direction="right"> First step content on the right. </mlv-timeline-item>
  <mlv-timeline-item title="Step 2" timestamp="Feb 2025" tone="success" direction="left"> Second step content on the left. </mlv-timeline-item>
  <mlv-timeline-item title="Step 3" timestamp="Mar 2025" tone="warning" direction="right"> Third step content on the right. </mlv-timeline-item>
</mlv-timeline>
```

### Dynamic timeline from data

```typescript
// component.ts
interface TimelineEvent {
  title: string;
  timestamp: string;
  description: string;
  tone: MlvTimelineItemTone;
}

readonly events = signal<TimelineEvent[]>([
  { title: 'Created', timestamp: '2025-01-10', description: 'Issue created.', tone: 'info' },
  { title: 'In Progress', timestamp: '2025-01-12', description: 'Work started.', tone: 'warning' },
  { title: 'Resolved', timestamp: '2025-01-15', description: 'Issue resolved.', tone: 'success' },
]);
```

```html
<mlv-timeline>
  @for (event of events(); track event.timestamp) {
  <mlv-timeline-item [title]="event.title" [timestamp]="event.timestamp" [tone]="event.tone"> {{ event.description }} </mlv-timeline-item>
  }
</mlv-timeline>
```

---

## Dependencies

### Angular / third-party

| Package           | Usage                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@angular/core`   | `Component`, `Directive`, `input`, `contentChild`, `inject`, `TemplateRef`, `ViewEncapsulation`, `ChangeDetectionStrategy` |
| `@angular/common` | `NgTemplateOutlet`                                                                                                         |

### Internal (`@malva-ui/*`)

| Package            | Usage                                                     |
| ------------------ | --------------------------------------------------------- |
| `@malva-ui/styles` | CSS custom properties (`--mlv-*` tokens), `mixins.base()` |

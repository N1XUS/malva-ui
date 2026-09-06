# @malva-ui/taskboard

Kanban board for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — a typed, template-projected `mlv-taskboard` with controlled state, pointer and keyboard moves, WIP limits, swimlanes and virtual columns.

Ships as its own package, not as a `@malva-ui/core` entry point, so applications that never render a board pull in neither the board nor its drag engine.

## Install

```bash
npm install @malva-ui/taskboard
```

## Quick start

The board owns no data. `items` and `columns` are required two-way models: every committed move writes a replacement array back through them.

```ts
import { Component, signal } from '@angular/core';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type { MlvTaskboardColumn } from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

const TICKETS: readonly Ticket[] = [
  { id: 'MLV-101', title: 'Audit the focus ring', status: 'todo' },
  { id: 'MLV-102', title: 'Ship the dark palette', status: 'doing' },
];

@Component({
  selector: 'app-release-board',
  imports: [MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './release-board.html',
})
export class ReleaseBoard {
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'todo', label: 'To do' },
    { id: 'doing', label: 'In progress', wipLimit: 3 },
    { id: 'done', label: 'Done' },
  ]);

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /** Carries `Ticket` into the card template's context; never read at runtime. */
  readonly ticketType = TICKETS[0];
}
```

```html
<mlv-taskboard [(items)]="tickets" [(columns)]="columns" dataKey="id" columnField="status">
  <ng-template mlvTaskboardItemDef [mlvTaskboardItemDefFrom]="ticketType" let-card>
    <strong>{{ card.title }}</strong>
    <small>{{ card.id }}</small>
  </ng-template>
</mlv-taskboard>
```

`dataKey` names the property that identifies a card and `columnField` the property holding its column id. Keys are matched, never coerced: the number `1` and the string `'1'` are different cards.

## Localisation is required

The board injects `MLV_TASKBOARD_I18N` when it is constructed — its labels, keyboard instructions and live-region announcements all come from there. Provide a language pack once at bootstrap:

```ts
import { provideMlvI18n } from '@malva-ui/i18n';

bootstrapApplication(App, {
  providers: [provideMlvI18n({ locale: 'en' })],
});
```

24 taskboard keys ship in every locale pack.

## Features

- **Controlled state** — the board never mutates your arrays; it writes replacements through `items` / `columns`.
- **Policies** — `transitions`, `lockedItemIds`, WIP limits per column, group and swimlane, a synchronous `canDropFn`, and an async `beforeMove` guard that can confirm a move before it commits. Every refusal reports one reason (`locked` → `transition` → `wip` → `policy`).
- **Keyboard parity** — one roving tab stop, `Space` to grab, arrows to aim, `Space` to commit through the same guarded flow a pointer drop enters, `Escape` to cancel; every outcome announced politely.
- **Replaceable chrome** — board header, group header, column header, swimlane, cell content, card, add affordance, empty state and drop indicator are all `ng-template` slots with typed contexts.
- **Selection** — a two-way `ReadonlySet` model with click / `Ctrl`-click / `Shift`-click semantics and `aria-multiselectable` listbox cells.
- **Virtual columns** — `virtualItemSize` puts every cell on a CDK virtual viewport; drop indices are translated back through the rendered window.
- **History, snapshots, export, print** — `undo()`, `redo()`, `snapshot()`, `restore()`, `exportJson()`, `exportCsv()`, `print()`. A `snapshot()` carries the card placement (`items`) as well as the column order, collapse, selection, focus and scroll offsets, so capture → move → `restore()` puts the cards back; the whole restore is **one** undoable command. Card _content_ stays yours — the snapshot holds a frozen copy of the array you already had, and a restore hands it straight back through `items`. `restore()` also accepts a UI-only `MlvTaskboardUiSnapshot`, which leaves the cards untouched, and `exportJson().snapshot` is that UI-only projection so the export never lists the cards twice.
- **Column panels and accents** — a board without swimlanes renders each column as a soft panel with an accent stripe along its top edge; a laned board drops the panels for open bands. `MlvTaskboardColumn.accent` / `MlvTaskboardColumnGroup.accent` take any CSS `<color>` (a `var(--mlv-…)` token is the expected form) and colour the stripe and the group underline.
- **Density and RTL** — `[mlvDensity]` on the board itself; the inline axis mirrors from the `dir` attribute that applies to the host.
- **Server-rendering safe** — the whole grid role tree renders on the server; the drag engine attaches in the browser only.

## Styling and test hooks

Rendered elements carry stable data attributes. The four **identifier** attributes — `data-mlv-taskboard-card-id`, `-column-id`, `-swimlane-id`, `-group-id` — carry the **key token** `` `${typeof key}:${String(key)}` ``, so a card keyed `1` renders `data-mlv-taskboard-card-id="number:1"` and one keyed `'1'` renders `string:1`. Select on the token, not on the bare value.

The remaining four are not key tokens: `data-mlv-taskboard-column-locked` and `data-mlv-taskboard-selected` are `"true"` or absent, `data-mlv-taskboard-drop-state` is `valid` or `invalid` on the container the drag is hovering, and `data-mlv-taskboard-wip="at-limit"` marks a built-in column header's count pill that has reached its column's limit.

## Peer dependencies

`@angular/cdk`, `@angular/common`, `@angular/core`, `@malva-ui/cdk`, `@malva-ui/i18n`. Pointer dragging uses the package's own `sortablejs` dependency — you neither install nor import it.

## Documentation

Live examples and the full API: the **Taskboard** page of the Malva UI documentation site (`/taskboard`).

## Testing

```bash
yarn nx test taskboard
```

## Related packages

- [`@malva-ui/core`](https://www.npmjs.com/package/@malva-ui/core) — the component library
- [`@malva-ui/cdk`](https://www.npmjs.com/package/@malva-ui/cdk) — headless primitives
- [`@malva-ui/i18n`](https://www.npmjs.com/package/@malva-ui/i18n) — localisation

## License

MIT

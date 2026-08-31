# @malva-ui/core/filter

`mlv-filter` provides compact option or free-form condition editing, while
`mlv-smart-filter-bar` composes metadata-defined fields with search, query
execution, refresh, collapse, and staged filter visibility management.

```html
<mlv-smart-filter-bar [definitions]="definitions" [(filters)]="filters" (execute)="loadResults($event)" />
```

Conditions are backend-neutral. Execution and refresh emit deeply cloned
snapshots, including nested option values. Multiple conditions use OR unless a
definition overrides `conditionStrategy`.

Required fields remain visible and block execution while empty. Fields with
applied conditions also remain visible until cleared, preventing hidden query
state. The available-filter manager is modal and focus-trapped. Built-in
actions, validation, operators, strategies, summaries, and accessible names use
the active Malva UI language pack.

Run `yarn nx test core-filter` to execute the focused unit and accessibility
tests.

# Library: taskboard

## Overview

`@malva-ui/taskboard` is a standalone, publishable Angular Kanban board package. It is never a `@malva-ui/core` secondary entry point.

## Package contract

- Public import: `@malva-ui/taskboard`.
- Runtime drag support uses package-private `sortablejs`; consumers do not import it.
- Peer dependencies: Angular CDK/common/core, `@malva-ui/cdk`, and `@malva-ui/i18n`.
- Run its suite with `yarn nx test taskboard`.

## Interaction contract

- Pointer/touch drags never reorder the DOM: both SortableJS adapters answer `onMove` with `false` and commit an immutable replacement collection instead.
- Card drops run the pure move engine, then the optional `beforeMove` guard (sync or async). Every non-committing outcome leaves `items` referentially unchanged and emits `moveCancelled` with a concrete reason.
- Column headers reorder by pointer: locked columns keep their absolute index, `canReorderColumnFn` may veto an order, and a moved column adopts its new neighbours' `groupId`.
- Group headers render as contiguous runs of consecutive columns sharing a `groupId`; an ungrouped run renders as an unlabeled spacer.

## Documentation obligations

Keep the public API, controlled-state behavior, projection contexts, accessibility, SSR, virtual-rendering constraints, and every user-facing i18n string documented and tested as the package evolves. Update this file, the root indexes, and package metadata with any package-level change.

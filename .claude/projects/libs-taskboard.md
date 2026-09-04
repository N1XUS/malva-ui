# Library: taskboard

## Overview

`@malva-ui/taskboard` is a standalone, publishable Angular Kanban board package. It is never a `@malva-ui/core` secondary entry point.

## Package contract

- Public import: `@malva-ui/taskboard`.
- Runtime drag support uses package-private `sortablejs`; consumers do not import it.
- Peer dependencies: Angular CDK/common/core, `@malva-ui/cdk`, and `@malva-ui/i18n`.
- Run its suite with `yarn nx test taskboard`.

## Documentation obligations

Keep the public API, controlled-state behavior, projection contexts, accessibility, SSR, virtual-rendering constraints, and every user-facing i18n string documented and tested as the package evolves. Update this file, the root indexes, and package metadata with any package-level change.

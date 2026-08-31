---
name: nx_daemon_restart
description: When Nx fails with "Could not find project", restart the daemon with `yarn nx reset` instead of retrying the command
type: feedback
---

When Nx fails with "Could not find project" even though `nx show project <name>` returns valid config, restart the Nx daemon with `yarn nx reset` before retrying.

**Why:** The daemon caches project graph data and can miss newly scaffolded projects. `nx reset` clears both cache and daemon state, after which the project is discoverable.

**How to apply:** Any time `nx run <project>:build` (or any target) errors with "Could not find project", run `yarn nx reset` first, then retry the original command.
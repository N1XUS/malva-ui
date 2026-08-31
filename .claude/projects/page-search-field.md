---

# Docs page: Search Field

Path: `apps/docs/src/app/pages/search-field`

The page documents `@malva-ui/core/search-field` with separate live, submit, loading-feedback, and overlay-search examples (`examples = [1, 2, 3, 4]`). Examples must import the public secondary entry point, default-export their standalone example component, and show the committed `search` output rather than presenting every keystroke as a completed search. The loading example presents both trigger modes because live loading remains editable while submit loading blocks duplicate activation.

Example 4 covers overlay search and shows both triggers side by side — `presentation="icon"` (circular button, implies `overlay`) and `overlay` on the default field presentation — sharing one committed-query readout so it is visible that both route through the same `search` output.

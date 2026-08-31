# Tile compound tree design QA

## Visual source and capture setup

| Item                       | Value                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Selected structure source  | `/var/folders/27/ms8zcbzj6yv93jsr83w6hl800000gn/T/codex-clipboard-42e67281-fadd-45a1-8b3c-429096e808ba.png` |
| Source dimensions          | 918 × 633 px                                                                                                |
| Final resting capture      | `/private/tmp/tile-task-final/resting-918x633.png`                                                          |
| Implementation dimensions  | 918 × 633 px                                                                                                |
| Browser viewport           | 918 × 633 CSS px at DPR 1                                                                                   |
| Responsive capture         | `/private/tmp/tile-task-final/narrow-650x633.png`, 650 × 633 px                                             |
| Tile density               | Comfortable                                                                                                 |
| Publication switch density | Compact                                                                                                     |
| Full comparison            | `/private/tmp/tile-task-final/comparison-918x633.png`                                                       |
| Focused comparison         | `/private/tmp/tile-task-6-evidence/comparison-focused.png`                                                  |

The full-view and focused comparisons were inspected together. The implementation retains the selected source's bordered nested surfaces, clear parent-to-child hierarchy, mixed grid structure, generous empty container space, and restrained neutral treatment. Product-specific titles, Lucide metadata, summaries, and actions make the final example intentionally denser than the generic source while preserving its hierarchy and visual rhythm.

## Visual measurements

| Check                             | Measured result                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| Root layout at reference viewport | Two columns, each 330 px wide                                               |
| Root layout at 650 px             | One column, 508 px wide                                                     |
| Deepest nested leaves at 650 px   | One column, 400 px wide                                                     |
| Active source footprint           | 294 × 113.5 px at x 181, y 277.34; opacity 0; no transform or start reflow  |
| Pointer-following fallback        | 294 × 113.5 px at x 116.99, y 305.81; fixed to body; opacity 0.8            |
| Fallback elevation                | `0 20px 25px rgba(0, 0, 0, 0.1), 0 8px 10px rgba(0, 0, 0, 0.04)`            |
| Edit and Trash targets            | 40 × 40 px                                                                  |
| Trash glyph                       | 24.5 px Lucide Trash2, circular transparent button                          |
| Drag handle                       | 44 px target with 16 px Lucide grip glyph                                   |
| Compact switch                    | 48 × 29 px host, 40 × 24 px track                                           |
| Motion tokens                     | Normal 200 ms; fast 100 ms; strong easing `cubic-bezier(0.77, 0, 0.175, 1)` |

The moving fallback remained fully inside the viewport including its shadow. It was not clipped by a tile or grid ancestor. The source footprint kept its exact geometry, siblings did not stretch, and measured Sortable FLIP displacement moved both siblings by 100 px before settling. The library's reduced-motion path uses an instant zero-duration Sortable animation; its compiled style and runtime-option regressions pass because the selected in-app Browser exposes no motion-emulation capability.

## Interaction evidence

| Scenario                      | Result and evidence                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-row forward and reverse  | Passed. Header order changed from `hero, intro` to `intro, hero` and back with all nine global IDs preserved. Reordered evidence: `/private/tmp/tile-task-final/reordered.png`.                                                                                                                                                                |
| Container away and back       | Passed. Moving a root container away and returning it restored the exact original cell and index.                                                                                                                                                                                                                                              |
| Cross-level accepted move     | Passed. Launch campaign moved from Header to the deepest Media row: Header `intro`; Media `image, cta, hero`; all nine IDs preserved.                                                                                                                                                                                                          |
| Row into leaf-owning target   | Passed rejection. Model and direct-parent DOM order stayed unchanged.                                                                                                                                                                                                                                                                          |
| Self and descendant target    | Passed rejection. Content stack could not enter its descendant empty row; model and DOM stayed unchanged.                                                                                                                                                                                                                                      |
| Nested target precedence      | Passed. The Media row won over its containing ancestors for the accepted leaf move.                                                                                                                                                                                                                                                            |
| Drag start and motion         | Passed. No start reflow; empty static footprint; moving translucent shadowed fallback; continuous sibling displacement; no snap or layout break. Active evidence: `/private/tmp/tile-task-final/dragging-918x633.png`.                                                                                                                         |
| Restricted feedback           | Passed. Full red dashed target border and visible `Restricted` label remained readable during the row drag. Evidence: `/private/tmp/tile-task-final/restricted-drag.png`.                                                                                                                                                                      |
| Controls and drag isolation   | Passed. Edit opened the `Rename Launch campaign` textbox and Escape closed it; the compact publication Switch toggled checked to unchecked; circular Trash removed Hero immutably and left Header with `intro-text`. Fresh reload restored the demo. No action started a drag, no close or X action is rendered, and the console stayed clean. |
| Handle hover                  | Passed. All handles rest at opacity 0; only the hovered tile handle becomes opacity 1; tile backgrounds remain white.                                                                                                                                                                                                                          |
| Responsive fallback           | Passed. Root and deepest nested grids fall back to one column without horizontal overflow. Evidence: `/private/tmp/tile-task-final/narrow-650x633.png`.                                                                                                                                                                                        |
| Narrow closable compatibility | Passed. The library's closable-only X remains vertically aligned with its title, with a measured center delta of 0. Evidence: `/private/tmp/tile-task-final/closable-aligned.png`.                                                                                                                                                             |
| Console                       | Passed. No Angular errors, uncaught exceptions, or leftover drag artifacts across the matrix.                                                                                                                                                                                                                                                  |

## QA history and issue closure

| Severity | Finding                                                                                           | Resolution and verification                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Earlier nested drag attempts could corrupt projected consumer wrappers and lose rendered nodes.   | Core compound dragging moved to SortableJS ownership; forward, reverse, cross-level, away-and-back, and rejected live paths now preserve every global ID and direct-parent order. |
| P1       | Initial Sortable motion reordered correctly but siblings snapped with no observed FLIP transform. | Runtime direction handling was corrected. Live diagnostics measured 200 ms animation and 100 px transforms on both affected siblings.                                             |
| P1       | The first ghost treatment left an opaque source-like tile and unclear drag roles.                 | The source footprint is now invisible and stable; a single translucent, shadowed fallback follows the pointer with identical geometry.                                            |
| P1       | Earlier narrow headers could displace the closable-only X from the title row.                     | The responsive tile header keeps the close action aligned while crowded custom action groups wrap independently.                                                                  |
| P2       | The first compound example squeezed title, metadata, summary, and controls into one row.          | Only the title remains in the header. Lucide type metadata and summary occupy a normal body block before inherited nested tiles.                                                  |
| P2       | The original docs-only builder duplicated DnD layout behavior and produced a tiny or broken grid. | The example now uses one public root `[(tree)]`, inherited nested `mlv-tiles`, public mutation methods, and only a content-level 20 rem grid minimum.                             |

No unresolved P0, P1, or P2 visual findings remain in the selected full-view or focused-region comparison.

final result: passed

# Core data and algorithm performance remediation — design

Date: 2026-08-27
Status: approved
Scope: data-heavy production TypeScript under `libs/core`

## Problem

Several core components derive small visible results by repeatedly scanning or copying much larger inputs. The most consequential cases are calendar availability, chat message labels and live IDs, recursive data-table flattening, pagination, smart-filter definition lookup, token insertion, tile-tree removal, and slider tick generation. Degenerate inputs can turn linear work into quadratic work or allocate DOM proportional to an effectively unbounded numeric range.

## Goals

- Replace confirmed quadratic paths with linear or constant-size algorithms.
- Cache stable derived data at the closest signal boundary.
- Bound work and DOM size for consumer-controlled ranges.
- Preserve comparator semantics, input order, emitted values, keyboard behavior, and public APIs.
- Require evidence before applying lower-priority fast paths.

## Non-goals

- No data-table virtualization redesign.
- No new pagination, filter, select, tokenizer, tile, or slider API.
- No comparator contract changes.
- No approximate user-visible values.

## 1. Calendar availability index

Affected implementation: `libs/core/calendar/src/lib/calendar/calendar.ts`.

Create a computed availability index keyed by normalized `min`, `max`, disabled-date rules, and the current month/year view inputs. The default min/max-only case uses interval arithmetic and never iterates every date. Custom disabled-date logic populates the smallest view-specific bitmap or set needed by month, year, and navigation controls, once per dependency change.

Template-facing availability methods become constant-time lookups. Navigation, year cells, and month cells reuse the same index rather than calling `_hasSelectableDateInRange` independently.

### Tests

- Existing min/max, disabled-date, leap-year, and navigation behavior remains identical.
- One dependency revision performs one bounded availability build regardless of change-detection reads.
- Min/max-only ranges use the analytic path with no day-by-day scan.

## 2. Chat derived-state caches

Affected implementation: `libs/core/chat/src/lib/chat/chat.ts`.

- Replace the cumulative live-message ID collection with the set of IDs currently animating. Remove IDs when animation completes, a message leaves the window, or the component is destroyed.
- Build a computed message-label map for the current rendered window, users, locale, and delivery status. Template reads become O(1) and reformat only when one of those dependencies changes.

The order and text of messages, author labels, timestamps, statuses, and live announcements remain unchanged.

### Tests

- The live-ID set returns to empty after animations and never grows across replaced message windows.
- Repeated template reads reuse formatted labels.
- Locale, user, status, or message changes rebuild the label map once; subsequent template reads reuse it.

## 3. Linear data-table flattening

Affected implementation: `libs/core/data-table/src/lib/data-table/data-table-layout.ts`.

Replace recursive array spreading/concatenation with a single accumulator or iterative depth-first traversal. Preserve preorder, depth, parent metadata, expansion rules, and row identity. The algorithm must be O(N) time and O(N) result storage for N visible rows, without an intermediate array per subtree.

### Tests

- Flat, balanced, and deeply nested trees produce the exact existing row order and metadata.
- A degenerate chain records one append per row and no recursive concatenation.

## 4. Constant-size pagination

Affected implementation: `libs/core/pagination/src/lib/pagination/pagination.service.ts`.

Compute the visible page buttons and ellipses directly from `currentPage`, `pageCount`, and the configured sibling/boundary window. Do not allocate `[1..pageCount]`. The returned visible model remains bounded by the UI window and is O(1) with respect to total page count.

### Tests

- Exhaustive parity against the current algorithm for a practical matrix of small page counts and current pages.
- A billion-page input returns the bounded visible model without a proportional allocation.

## 5. Smart-filter lookup indexes

Affected implementation: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts` and its template.

Create computed maps for definition-by-key and definition rank. Build any repeated row/view model once per relevant signal change. Definition resolution in template helpers becomes O(1). Sorting or rebuilding active filters uses the rank map or a direct ordered rebuild, making the path O(D + F) for D definitions and F active filters.

### Tests

- Unknown keys, hidden definitions, duplicate/invalid active filters, and definition reordering preserve existing behavior.
- Lookup and ordering operation counts grow linearly.

## 6. Tokenizer bulk insertion

Affected implementation: `libs/core/tokenizer/src/lib/tokenizer/tokenizer.ts`.

For duplicate-disallowed mode, seed a `Set` with existing token identities and update it while accepting the incoming batch. For duplicate-allowed mode, append the batch directly without searching either collection. Preserve the current normalization, equality identity, event order, maximum-token behavior, and rejected-token semantics.

### Tests

- Mixed existing, duplicate-in-batch, accepted, and rejected tokens match current results and events.
- Duplicate-allowed insertion performs no membership scan.
- Duplicate-disallowed insertion performs one identity lookup per candidate.

## 7. Tile-tree operation snapshot

Affected implementation: `libs/core/tile/src/lib/tile-tree-coordinator.ts`, `tiles.ts`, and `tile-tree-state.ts`.

Build one operation-local index/snapshot for remove and move operations containing node, parent, child index, descendant relation, and lock/acceptance facts. Reuse it through validation and immutable mutation. Remove duplicate lock checks and repeated full-tree searches. Registration gains a direct ID map while preserving duplicate-ID diagnostics and lifecycle cleanup.

An operation is O(N) to build the snapshot plus O(depth) immutable reconstruction, instead of several O(N) walks. Structural sharing and emitted root/move values remain unchanged.

### Tests

- Remove and cross-tree move preserve the exact immutable result and untouched branch references.
- Locked, missing, duplicate, self, and descendant targets retain current rejection behavior.
- A spy/operation counter verifies one tree indexing pass per operation.

## 8. Bounded slider ticks

Affected implementation: `libs/core/slider/src/lib/slider/slider.ts`, template, and styles.

Replace the per-step tick array and one-element-per-tick DOM with a CSS repeating gradient driven by a computed percentage interval. Horizontal and vertical tracks use orientation-specific gradients. The component validates finite positive range/step values and exposes only private CSS custom properties; it never loops over `(max - min) / step`.

This keeps a visual tick at every representable step without allocating Angular views. When ticks are denser than device pixels they naturally merge visually, which is the browser-equivalent of the current overlapping elements. Ticks remain decorative and `aria-hidden`; value snapping, thumbs, forms, and keyboard behavior are unchanged.

### Tests

- Horizontal and vertical tick spacing match representative integer and fractional ranges.
- Invalid/non-positive steps disable ticks exactly as today.
- An extremely small positive step performs constant work and creates no repeated tick elements.
- Endpoints, fill, thumb values, and accessibility attributes are unchanged.

## 9. Evidence-gated candidates

Implement only when a focused regression test or benchmark proves material repeated work:

- `libs/core/combobox/src/lib/combobox/combobox.ts` and `libs/core/select/src/lib/select/select.ts`: identity-map fast path for the default comparator, with the generic comparator retaining the current scan.
- `libs/core/dropdown/src/lib/option-matcher.ts` and `reconciliation.ts`: normalize once and use identity sets/maps only when default equality is active.
- `libs/core/data-table/src/lib/data-table/data-table-layout.ts` and `data-table.ts`: split static column metadata from live widths during resize.
- `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.ts`: cache normalized names per item revision.
- `MlvSelect.displayValue`: cache only if measurement shows repeated formatting within the same state revision.

Evidence must include the custom-comparator fallback in correctness tests. Candidates without evidence remain unchanged.

## Compatibility and documentation

- Public types, values, ordering, emitted events, selectors, and forms behavior remain unchanged.
- Slider tick rendering changes internally from repeated elements to a decorative background; no public styling hook currently guarantees individual tick elements.
- Update each affected library's `CLAUDE.md`/`AGENTS.md` with the algorithm and invalidation guarantees.

## Verification

- Run affected projects' `test`, `typecheck`, and `lint` targets through Nx.
- Add operation-count tests for linear algorithms and bounded-output tests for pagination/slider.
- Run targeted integration tests for calendar navigation, chat announcements, filter ordering, tile moves, tokenizer events, and slider forms/keyboard behavior.

## Acceptance criteria

- Confirmed P2 algorithms meet their stated O(N), O(log N), or O(1)-output bounds.
- A consumer-controlled page count or slider step cannot cause proportional allocation of an unbounded array/DOM list.
- Existing visible values, event sequences, and custom comparator behavior remain compatible.
- Every implemented change has a deterministic regression test.

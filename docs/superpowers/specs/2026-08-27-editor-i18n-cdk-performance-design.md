# Editor, i18n, and CDK performance remediation — design

Date: 2026-08-27
Status: approved
Scope: production TypeScript under `libs/editor`, `libs/i18n`, and the affected `libs/cdk` data-source utilities

## Problem

The libraries are functionally correct, but several hot paths do work in proportion to the entire document, block list, or transport event stream. Long AI responses can create thousands of editor transactions, block-handle pointer movement can repeatedly rescan all blocks, selection-only transactions can recompute document statistics, upload progress can enter Angular for every network callback, and identical concurrent translation requests can repeat the same provider call.

The fixes must reduce worst-case work without changing public APIs, editor output, translation results, upload semantics, or accessibility behavior.

## Goals

- Bound AI streaming transactions and active decorations independently of response length.
- Make block-handle pointer processing one indexed document pass plus logarithmic lookup per frame.
- Avoid full-document status scans on selection-only transactions.
- Coalesce upload progress while preserving an immediate terminal state.
- Deduplicate identical in-flight AI translation requests.
- Admit lower-priority cache and lookup changes only when a regression test or benchmark demonstrates a material improvement.

## Non-goals

- No editor feature redesign or visible toolbar changes.
- No changes to AI prompts, generated content, translation cache keys, or upload provider contracts.
- No public API changes.
- No speculative cache with unbounded retention.
- No timing-sensitive unit assertions; tests use operation counts and deterministic schedulers.

## 1. AI streaming

Affected implementation: `libs/editor/src/lib/ai/editor-ai-stream.ts`.

### Adaptive reveal batches

Streaming keeps the current progressive reveal for short answers. For longer answers, the batch size becomes `max(currentBatchSize, ceil(remainingCharacters / targetRemainingFrames))`. The private frame budget is 300 scheduled reveals per response; it is not a public input.

This changes the work from one editor transaction per small fixed character group to a bounded number of reveal transactions. A 10,000-character response must complete in no more than 300 scheduled reveal frames, while short responses retain the existing small-batch cadence.

### Bounded decorations

Only the currently changing streamed range is decorated. Previously committed streamed text is represented by document content, not by a growing list of decorations rebuilt on every frame. Completion and cancellation remove all transient stream decorations.

### Correctness requirements

- The final editor document is byte-for-byte identical to the complete response.
- Cancellation commits only the revealed prefix and leaves no transient decoration.
- Selection mapping and transaction metadata remain unchanged.
- Error handling and undo grouping remain compatible with the current behavior.

### Tests

- A deterministic scheduler verifies short-response batching and the long-response frame ceiling.
- Decoration count remains constant as a long response advances.
- Completion, cancellation, and error paths leave no decoration behind.
- The reconstructed final document matches the response for ASCII, whitespace, and multi-code-unit text.

## 2. Block-handle hit testing and drag lookup

Affected implementation: `libs/editor/src/lib/extensions/editor-block-handle.ts`.

For each relevant editor-view revision, build one ordered table containing the block position, node identity, and vertical bounds normalized to the editor's scroll coordinate space. Pointer movement is coalesced to one `requestAnimationFrame`; that frame normalizes the latest pointer coordinate, performs a binary search over the ordered bounds, and updates the handle only when the resolved block changes.

The table is invalidated when the document changes, the editor view remaps nodes, or geometry can change through resize. Ordinary scrolling changes only coordinate normalization and does not rebuild every block bound. Drag start reuses the current table. DOM measurement remains outside Angular and read phases complete before any style write.

This replaces repeated `nodesBetween`/DOM scans during hover and drag with O(n) indexing per invalidation and O(log n) lookup per processed frame.

### Tests

- Multiple pointer events in one frame perform one lookup.
- Lookup returns the correct first, middle, last, and out-of-bounds block.
- A document transaction and a geometry invalidation rebuild the table exactly once before the next lookup.
- Drag behavior, drop position, and handle visibility remain unchanged.

## 3. Editor status caching

Affected implementation: `libs/editor/src/lib/status/editor-status.ts` and the transaction wiring in `libs/editor/src/lib/editor/editor.ts`.

Maintain a monotonically increasing internal content revision that advances only when `transaction.docChanged` is true. Character and word counts are cached by that revision. Selection-only transactions may update selection-dependent status but must reuse the cached document statistics.

### Tests

- Repeated selection changes do not invoke the document scan again.
- A document-changing transaction invalidates the cache once and publishes updated counts.
- Empty documents, whitespace, Unicode text, and existing word-count semantics remain covered.

## 4. Upload progress coalescing

Affected implementation: `libs/editor/src/lib/upload/editor-image-upload-coordinator.ts` and `libs/editor/src/lib/extensions/editor-upload-placeholder.ts`.

Progress is normalized and rounded before publication. Repeated callbacks that resolve to the same visible percentage are ignored. Non-terminal changes are coalesced to at most one placeholder transaction per animation frame. Success, failure, cancellation, and 100% progress flush synchronously before placeholder teardown so the final observable state cannot be lost.

Pending frames are cancelled when the upload or editor is destroyed.

### Tests

- A burst of transport callbacks creates at most one non-terminal update per frame.
- Repeated values in the same integer bucket create no update.
- Terminal progress, success, failure, and cancellation flush and clean up deterministically.

## 5. Concurrent AI translation deduplication

Affected implementation: `libs/i18n/src/lib/ai/ai-translation.service.ts`.

Add a private in-flight promise map using the existing resolved cache identity: locale, message key, source text, and any provider-affecting options already represented by the service. Identical concurrent misses share one promise. Successful resolution continues through the existing completed-result cache. Failure always evicts the in-flight entry so a later request can retry.

### Tests

- Concurrent identical misses call the provider once and resolve all callers.
- Different locale, key, source, or provider-affecting options do not collide.
- A rejected request is evicted and the next request retries.

## 6. Evidence-gated candidates

These findings are lower priority or workload-dependent and are implemented only if a focused benchmark/regression test proves the current path performs repeated avoidable work:

- `libs/cdk/data-source/src/lib/array-data-source.ts`: precompile normalized filters and use `Set` membership for multi-value filters.
- `libs/editor/src/lib/editor-toolbar-context.ts` and `libs/editor/src/lib/toolbar/editor-toolbar-widget.ts`: share one computed ordered/enabled widget list instead of sorting independently in consumers.
- `libs/editor/src/lib/ai/editor-ai-context.ts`: confirm full-document serialization occurs once per AI action; add a context budget only if profiling proves repeated or excessive serialization.
- `libs/editor/src/lib/extensions/editor-block-handle.ts`: replace whole-style drag-ghost copying with a stable property allowlist only if browser profiling shows it is material.
- `libs/i18n/src/lib/i18n-resolver.service.ts`: add a bounded LRU only if dynamic ICU templates can grow the cache beyond a stable application vocabulary.

Evidence tests must compare operation counts or allocations with fixed inputs. Any candidate without evidence remains unchanged and is reported as such.

## Compatibility and documentation

- Public exports, selectors, inputs, outputs, providers, and result shapes remain unchanged.
- Scheduler and cache constants stay private.
- Update the relevant `libs/*/CLAUDE.md` files with the new internal lifecycle and caching guarantees as required by the repository rules.

## Verification

- Run each affected project's `test`, `typecheck`, and `lint` targets through Nx.
- Run editor integration tests covering streaming, upload placeholders, block drag, and status.
- Run i18n tests with a fake provider that records calls.
- Add deterministic operation-count regression tests for every implemented optimization; wall-clock benchmarks are informational only.

## Acceptance criteria

- All confirmed P2 items in this specification are fixed with regression coverage.
- Long AI streams have bounded reveal transactions and constant active decoration count.
- Pointer bursts, upload bursts, and selection-only transactions do not multiply work.
- Concurrent identical translations share exactly one provider request.
- No public API or observable result changes.

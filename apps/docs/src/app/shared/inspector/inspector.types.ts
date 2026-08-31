/**
 * A single observable event emitted by a component under E2E observation.
 * Surfaced in the DOM by `<docs-inspector>` so Playwright can assert it.
 */
export interface InspectorEvent {
  /** Event name, e.g. 'selectionChange', 'open', 'close'. */
  readonly name: string;
  /** Optional payload serialised as JSON in the inspector output. */
  readonly payload?: unknown;
}

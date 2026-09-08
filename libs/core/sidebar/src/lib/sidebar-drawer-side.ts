/**
 * Which edge an `'offcanvas'` sidebar's drawer slides from.
 *
 * Logical, not physical: `'start'` is the left edge in LTR and the right one in
 * RTL. `mlv-sidebar` resolves it against the direction in force at its own
 * host, so a `dir="rtl"` on any ancestor mirrors the drawer with the layout.
 */
export type MlvSidebarDrawerSide = 'start' | 'end';

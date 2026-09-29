// Internal: never re-exported from the entry point's barrel.

/** @internal Outer frame type: a y-protocols sync message. */
export const MLV_EDITOR_COLLABORATION_FRAME_SYNC = 0;

/** @internal Outer frame type: an awareness update. */
export const MLV_EDITOR_COLLABORATION_FRAME_AWARENESS = 1;

/** @internal Outer frame type: auth (ignored on receive, never sent). */
export const MLV_EDITOR_COLLABORATION_FRAME_AUTH = 2;

/** @internal Outer frame type: a request for every known awareness state. */
export const MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS = 3;

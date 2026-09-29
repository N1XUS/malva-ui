// Public surface of `@malva-ui/editor/collaboration`. Every module listed
// here exports public API only; internal helpers (session, binder, schema
// guard, anchors, frame and metadata constants, palette helpers) live in
// modules this barrel never names. `collaboration-barrel.spec.ts` pins it.
export * from './lib/collaboration';
export * from './lib/collaboration-colors';
export * from './lib/collaboration-seed';
export * from './lib/collaboration-transport';
export * from './lib/collaboration.types';
export * from './lib/editor-presence/editor-presence';

/** Categories used to filter the showcase catalog. */
export type ShowcaseCategory =
  | 'workspaces'
  | 'communication'
  | 'data'
  | 'content'
  | 'settings';

/** A full-size product composition available from the showcase catalog. */
export interface ShowcaseDefinition {
  /** Stable URL segment below `/showcases`. */
  readonly slug: string;
  /** Human-readable catalog and route title. */
  readonly title: string;
  /** Outcome-focused explanation of the composition. */
  readonly summary: string;
  /** Catalog category used by the segmented filter. */
  readonly category: ShowcaseCategory;
  /** Canonical documentation route paths represented by the composition. */
  readonly componentNames: readonly string[];
  /** Captured route preview, populated after the composition is implemented. */
  readonly previewAsset: string | null;
  /** Lazy loader for the final route component. */
  readonly loadComponent: () => Promise<unknown>;
}

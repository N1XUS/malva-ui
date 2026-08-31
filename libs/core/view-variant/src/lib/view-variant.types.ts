/** Ownership scope of a saved view. */
export type MlvViewVariantScope = 'system' | 'team' | 'personal';

/** User action available for a saved view. */
export type MlvViewVariantAction =
  | 'create'
  | 'clone'
  | 'update'
  | 'rename'
  | 'delete'
  | 'share';

/** Actions a consumer may offer for one saved view. */
export interface MlvViewVariantCapabilities {
  /** Whether the view can be copied into a new saved view. */
  readonly clone: boolean;
  /** Whether the view state can be replaced. */
  readonly update: boolean;
  /** Whether the view name can be changed. */
  readonly rename: boolean;
  /** Whether the view can be removed. */
  readonly delete: boolean;
  /** Whether the view can be shared with another scope. */
  readonly share: boolean;
}

/** A named, consumer-owned snapshot of durable view state. */
export interface MlvViewVariant<TState> {
  /** Stable identifier for the saved view. */
  readonly id: string;
  /** User-visible saved-view name. */
  readonly name: string;
  /** Ownership scope that controls where the view appears. */
  readonly scope: MlvViewVariantScope;
  /** Durable state captured by the consumer. */
  readonly state: TState;
  /** Actions allowed for this particular saved view. */
  readonly capabilities: MlvViewVariantCapabilities;
  /** Whether the consumer considers this view protected from editing. */
  readonly locked?: boolean;
  /** Optional result count associated with the view. */
  readonly resultCount?: number;
  /** Optional human-readable owner label. */
  readonly ownerLabel?: string;
  /** Optional optimistic-concurrency or persistence revision. */
  readonly revision?: string | number;
  /** Optional timestamp describing the latest update. */
  readonly updatedAt?: Date | string;
}

/** An action that is currently processing for a saved view. */
export interface MlvViewVariantBusyAction {
  /** Action currently in progress. */
  readonly action: MlvViewVariantAction;
  /** Optional identifier of the saved view being acted on. */
  readonly variantId?: string;
}

/** A consumer request to persist a new personal or team saved view. */
export interface MlvViewVariantCreateRequest<TState> {
  /** User-visible name for the new saved view. */
  readonly name: string;
  /** Scope for the new saved view; consumers cannot create system views. */
  readonly scope: Exclude<MlvViewVariantScope, 'system'>;
  /** Durable state to persist in the new saved view. */
  readonly state: TState;
  /** Optional saved-view identifier from which this request was created. */
  readonly sourceId?: string;
}

/** User-visible labels for saved-view scope groups. */
export interface MlvViewVariantGroupLabels {
  /** Label for system-owned saved views. */
  readonly system: string;
  /** Label for team-owned saved views. */
  readonly team: string;
  /** Label for personally owned saved views. */
  readonly personal: string;
}

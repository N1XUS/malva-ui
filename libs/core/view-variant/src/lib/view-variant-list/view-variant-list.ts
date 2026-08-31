import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LucideEllipsis, LucideLockKeyhole, LucidePlus } from '@lucide/angular';
import { normalizeForMatch } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import type {
  MlvViewVariant,
  MlvViewVariantBusyAction,
  MlvViewVariantGroupLabels,
  MlvViewVariantScope,
} from '../view-variant.types';

/** One labelled, scope-specific group rendered by {@link MlvViewVariantList}. */
interface MlvViewVariantListGroup<TState> {
  readonly scope: MlvViewVariantScope;
  readonly label: string;
  readonly variants: readonly MlvViewVariant<TState>[];
}

const DEFAULT_GROUP_LABELS: MlvViewVariantGroupLabels = {
  system: 'System',
  team: 'Team',
  personal: 'My views',
};

/**
 * Controlled searchable navigation for generic, consumer-owned saved views.
 *
 * The host owns persistence, authorization, dirty-state confirmation, and
 * error recovery. This component emits the requested interactions only.
 */
@Component({
  selector: 'mlv-view-variant-list',
  imports: [
    MlvButton,
    MlvInput,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    LucideEllipsis,
    LucideLockKeyhole,
    LucidePlus,
  ],
  templateUrl: './view-variant-list.html',
  styleUrl: './view-variant-list.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-view-variant-list',
  },
})
export class MlvViewVariantList<TState> {
  /** Saved variants to group and filter locally. */
  readonly variants = input.required<readonly MlvViewVariant<TState>[]>();

  /** Active saved-view identifier, controlled by the host. */
  readonly activeId = model<string | null>(null);

  /**
   * Leaves `activeId` unchanged after a selection request so the host can
   * accept or reject the request before updating the controlled model.
   *
   * The default is false, preserving optimistic selection for simple hosts.
   */
  readonly deferSelection = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Local, diacritic-insensitive view-name search query. */
  readonly query = model('');

  /** Whether the host permits creating a saved view. */
  readonly canCreate = input(false);

  /** Allowed target scopes for creating a view; system views are never creatable. */
  readonly createScopes = input<
    readonly Exclude<MlvViewVariantScope, 'system'>[]
  >(['personal']);

  /** Labels for the fixed System, Team, and Personal group order. */
  readonly groupLabels = input<MlvViewVariantGroupLabels>(DEFAULT_GROUP_LABELS);

  /** Operation currently pending in the host, if any. */
  readonly busyAction = input<MlvViewVariantBusyAction | null>(null);

  /** Recoverable host-supplied error for the navigation surface. */
  readonly errorMessage = input<string | null>(null);

  /** Emits when the user selects a saved view. */
  readonly variantSelect = output<MlvViewVariant<TState>>();

  /** Emits the allowed scope requested for a newly created view. */
  readonly createRequest = output<Exclude<MlvViewVariantScope, 'system'>>();

  /** Emits the saved view the user wants renamed. */
  readonly renameRequest = output<MlvViewVariant<TState>>();

  /** Emits the saved view the user wants deleted. */
  readonly deleteRequest = output<MlvViewVariant<TState>>();

  /** Emits the saved view the user wants shared. */
  readonly shareRequest = output<MlvViewVariant<TState>>();

  /** Emits when the user asks the host to retry an error. */
  readonly retryRequest = output<void>();

  /** Emits when the user dismisses the displayed host error. */
  readonly dismissError = output<void>();

  /** @protected Fixed-order, query-filtered groups that have at least one item. */
  protected readonly _groups = computed<
    readonly MlvViewVariantListGroup<TState>[]
  >(() => {
    const query = normalizeForMatch(this.query().trim());
    const matches = (variant: MlvViewVariant<TState>): boolean =>
      !query || normalizeForMatch(variant.name).includes(query);
    const labels = this.groupLabels();
    const variants = this.variants();

    const groups: readonly Pick<
      MlvViewVariantListGroup<TState>,
      'scope' | 'label'
    >[] = [
      { scope: 'system', label: labels.system },
      { scope: 'team', label: labels.team },
      { scope: 'personal', label: labels.personal },
    ];

    return groups
      .map(
        (group): MlvViewVariantListGroup<TState> => ({
          ...group,
          variants: variants.filter(
            (variant) => variant.scope === group.scope && matches(variant),
          ),
        }),
      )
      .filter((group) => group.variants.length > 0);
  });

  /** @protected Whether the configured creation scopes allow a New view action. */
  protected readonly _canCreate = computed(
    () => this.canCreate() && this.createScopes().length > 0,
  );

  /** @protected True when the New view action is pending. */
  protected readonly _isCreating = computed(
    () => this.busyAction()?.action === 'create',
  );

  /** @protected Emits selection, then writes active-id unless host acceptance is deferred. */
  protected _select(variant: MlvViewVariant<TState>): void {
    if (this._isVariantBusy(variant.id) || variant.id === this.activeId()) {
      return;
    }
    this.variantSelect.emit(variant);
    if (!this.deferSelection()) this.activeId.set(variant.id);
  }

  /** @protected Emits one of the host-supported creation scopes when available. */
  protected _create(scope: Exclude<MlvViewVariantScope, 'system'>): void {
    if (!this._canCreate() || this._isCreating()) return;
    this.createRequest.emit(scope);
  }

  /** @protected Emits a permitted item action unless that exact operation is busy. */
  protected _requestAction(
    action: 'rename' | 'delete' | 'share',
    variant: MlvViewVariant<TState>,
  ): void {
    if (this._isActionBusy(action, variant.id)) return;
    switch (action) {
      case 'rename':
        this.renameRequest.emit(variant);
        return;
      case 'delete':
        this.deleteRequest.emit(variant);
        return;
      case 'share':
        this.shareRequest.emit(variant);
    }
  }

  /** @protected Whether an item is the controlled active view. */
  protected _isActive(variant: MlvViewVariant<TState>): boolean {
    return variant.id === this.activeId();
  }

  /** @protected True when a specific item action is waiting for the host. */
  protected _isActionBusy(
    action: MlvViewVariantBusyAction['action'],
    variantId?: string,
  ): boolean {
    const busy = this.busyAction();
    return (
      busy?.action === action &&
      (busy.variantId === undefined || busy.variantId === variantId)
    );
  }

  /** @protected True when any operation targeting this saved view is pending. */
  protected _isVariantBusy(variantId: string): boolean {
    const busy = this.busyAction();
    return !!busy && busy.variantId === variantId;
  }
}

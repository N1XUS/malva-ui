import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideChevronDown,
  LucideDownload,
  LucideMenu,
  LucidePlus,
  LucideX,
} from '@lucide/angular';
import {
  MlvButton,
  MlvButtonIcon,
  MlvButtonSplit,
} from '@malva-ui/core/button';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  MlvDataTable,
  MlvDataTableCell,
  MlvDataTableNoData,
  MlvDataTableToolbarActions,
  type MlvDataTablePresentationState,
} from '@malva-ui/core/data-table';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';
import {
  MlvSmartFilterBar,
  mlvFilterExpressionToFields,
  mlvFilterFieldsToExpression,
  mlvMatchesFilterExpression,
  type MlvFilterExpression,
  type MlvFilterFieldState,
} from '@malva-ui/core/filter';
import {
  MlvPage,
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageHeader,
  MlvPageHeaderActions,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvSidebar, MlvSidebarTrigger } from '@malva-ui/core/sidebar';
import {
  MlvViewVariantList,
  MlvViewVariantStatus,
  mlvViewStateEqual,
  type MlvViewVariant,
  type MlvViewVariantBusyAction,
  type MlvViewVariantScope,
} from '@malva-ui/core/view-variant';
import { runShowcaseOperation } from '../../shared/showcase-async';
import {
  ACCOUNT_COLUMNS,
  ACCOUNT_VIEW_VARIANTS,
  ACCOUNTS,
  AT_RISK_FILTERS,
  AT_RISK_VIEW,
  DEFAULT_TABLE_STATE,
  FILTER_DEFINITIONS,
  type Account,
  type AccountsViewState,
} from './data-operations.data';

function cloneTableState(
  state: MlvDataTablePresentationState,
): MlvDataTablePresentationState {
  return {
    ...state,
    visibleColumnKeys: [...state.visibleColumnKeys],
    pinnedStartColumnKeys: [...state.pinnedStartColumnKeys],
    pinnedEndColumnKeys: [...state.pinnedEndColumnKeys],
    columnWidths: { ...state.columnWidths },
    sort: state.sort ? { ...state.sort } : null,
  };
}

/** Normalization omits transient UI state and freezes snapshot ordering. */
export function normalizeAccountsViewState(
  state: AccountsViewState,
): AccountsViewState {
  return {
    search: state.search.trim().toLocaleLowerCase(),
    filterExpression: state.filterExpression,
    table: cloneTableState(state.table),
  };
}

@Component({
  selector: 'docs-data-operations-showcase',
  imports: [
    CurrencyPipe,
    DatePipe,
    MlvAvatar,
    MlvButton,
    MlvButtonIcon,
    MlvButtonSplit,
    MlvDataTable,
    MlvDataTableCell,
    MlvDataTableNoData,
    MlvDataTableToolbarActions,
    MlvStatusIndicator,
    MlvDialog,
    MlvDialogBody,
    MlvDialogClose,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvDialogTemplate,
    MlvPage,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvPageHeader,
    MlvPageHeaderActions,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageTitle,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvSidebar,
    MlvSidebarTrigger,
    MlvSmartFilterBar,
    MlvViewVariantList,
    MlvViewVariantStatus,
    LucideChevronDown,
    LucideDownload,
    LucideMenu,
    LucidePlus,
    LucideX,
  ],
  templateUrl: './data-operations.html',
  styleUrl: './data-operations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataOperationsShowcaseComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _table = viewChild(MlvDataTable);
  private readonly _variantIds = new Set(
    ACCOUNT_VIEW_VARIANTS.map((variant) => variant.id),
  );
  private _retry: (() => void) | null = null;
  private _pendingCreate: {
    readonly scope: Exclude<MlvViewVariantScope, 'system'>;
    readonly afterPersist?: () => void;
  } | null = null;

  readonly accounts = signal<Account[]>([...ACCOUNTS]);
  readonly columns = ACCOUNT_COLUMNS;
  readonly filterDefinitions = FILTER_DEFINITIONS;
  readonly variants = signal<readonly MlvViewVariant<AccountsViewState>[]>(
    ACCOUNT_VIEW_VARIANTS,
  );
  readonly activeId = signal(
    this._resolveViewId(this._route.snapshot.queryParamMap.get('view')),
  );
  readonly viewQuery = signal('');
  readonly search = signal('');
  readonly filterFields =
    signal<readonly MlvFilterFieldState[]>(AT_RISK_FILTERS);
  readonly filterExpression = signal<MlvFilterExpression>(
    AT_RISK_VIEW.state.filterExpression,
  );
  readonly tableState = signal<MlvDataTablePresentationState>(
    cloneTableState(DEFAULT_TABLE_STATE),
  );
  readonly baselineState = signal<AccountsViewState>(AT_RISK_VIEW.state);
  readonly selectedAccount = signal<Account | null>(null);
  readonly busyAction = signal<MlvViewVariantBusyAction | null>(null);
  readonly operationError = signal<string | null>(null);
  readonly failNextOperation = signal(false);
  readonly pendingVariantId = signal<string | null>(null);
  readonly confirmDiscard = signal(false);
  readonly createDialogOpen = signal(false);
  readonly exportStatus = signal('');
  readonly activeVariant = computed(
    () =>
      this.variants().find((variant) => variant.id === this.activeId()) ?? null,
  );
  readonly canCreateView = computed(() => true);
  readonly workingState = computed<AccountsViewState>(() => ({
    search: this.search(),
    filterExpression: this.filterExpression(),
    table: this.tableState(),
  }));
  readonly dirty = computed(
    () =>
      !mlvViewStateEqual(
        this.baselineState(),
        this.workingState(),
        normalizeAccountsViewState,
      ),
  );
  readonly expressionFilteredAccounts = computed(() => {
    const expression = this.filterExpression();
    return this.accounts().filter((account) =>
      mlvMatchesFilterExpression(
        account,
        expression,
        (row, key) => row[key as keyof Account],
      ),
    );
  });

  constructor() {
    if (this._route.snapshot.queryParamMap.get('view') !== this.activeId())
      this._writeViewToUrl(this.activeId());
    this._loadVariant(this.activeId());
    this._route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = this._resolveViewId(params.get('view'));
      if (params.get('view') !== id) this._writeViewToUrl(id);
      if (id !== this.activeId()) this._loadVariant(id);
    });
  }

  requestVariantSelection(
    variant: Pick<MlvViewVariant<AccountsViewState>, 'id'>,
  ): void {
    if (variant.id === this.activeId()) return;
    if (!this.dirty()) {
      this.selectVariant(variant.id);
      return;
    }
    this.pendingVariantId.set(variant.id);
    this.confirmDiscard.set(true);
  }

  confirmDiscardChanges(): void {
    const next = this.pendingVariantId();
    this.pendingVariantId.set(null);
    this.confirmDiscard.set(false);
    if (next) this.selectVariant(next);
  }
  savePendingAsNewView(): void {
    const next = this.pendingVariantId();
    this.pendingVariantId.set(null);
    this.confirmDiscard.set(false);
    this.createView('personal', () => next && this.selectVariant(next));
  }
  cancelDiscardChanges(): void {
    this.pendingVariantId.set(null);
    this.confirmDiscard.set(false);
  }
  selectVariant(id: string): void {
    const resolved = this._resolveViewId(id);
    this._loadVariant(resolved);
    this._writeViewToUrl(resolved);
  }

  createView(
    scope: Exclude<MlvViewVariantScope, 'system'>,
    afterPersist?: () => void,
  ): void {
    this._pendingCreate = afterPersist ? { scope, afterPersist } : { scope };
    this.createDialogOpen.set(true);
  }

  cancelCreateView(): void {
    this._pendingCreate = null;
    this.createDialogOpen.set(false);
  }

  confirmCreateView(): void {
    const request = this._pendingCreate;
    if (!request) return;
    this._pendingCreate = null;
    this.createDialogOpen.set(false);
    const source = this.activeVariant();
    const originId = this.activeId();
    const ordinal =
      this.variants().filter((variant) => variant.id.startsWith('custom-view'))
        .length + 1;
    const view: MlvViewVariant<AccountsViewState> = {
      id: `custom-view-${ordinal}`,
      name: source ? `${source.name} view` : 'Untitled view',
      scope: request.scope,
      capabilities: {
        clone: false,
        update: true,
        rename: false,
        delete: false,
        share: false,
      },
      resultCount:
        this._table()?.totalItems() ?? this.expressionFilteredAccounts().length,
      state: normalizeAccountsViewState(this.workingState()),
    };
    this._persist(
      'create',
      originId,
      () => {
        this.variants.update((items) => [...items, view]);
        if (this.activeId() === originId) {
          this._loadVariant(view.id);
          this._writeViewToUrl(view.id);
          request.afterPersist?.();
        }
      },
      `View “${view.name}” could not be created.`,
    );
  }

  duplicateActiveView(): void {
    const source = this.activeVariant();
    if (!source?.capabilities.clone) return;
    const copy: MlvViewVariant<AccountsViewState> = {
      ...source,
      id: `${source.id}-copy`,
      name: `${source.name} copy`,
      scope: 'personal',
      locked: false,
      capabilities: {
        clone: false,
        update: true,
        rename: false,
        delete: false,
        share: false,
      },
      state: normalizeAccountsViewState(this.workingState()),
      updatedAt: 'Just now',
    };
    this._persist(
      'clone',
      source.id,
      () => {
        this.variants.update((items) => [
          ...items.filter((item) => item.id !== copy.id),
          copy,
        ]);
        if (this.activeId() === source.id) {
          this._loadVariant(copy.id);
          this._writeViewToUrl(copy.id);
        }
      },
      `View “${source.name}” could not be duplicated.`,
    );
  }

  updateActiveView(): void {
    const source = this.activeVariant();
    if (!source?.capabilities.update || !this.dirty()) return;
    const updated = {
      ...source,
      state: normalizeAccountsViewState(this.workingState()),
      updatedAt: 'Just now',
    };
    this._persist(
      'update',
      source.id,
      () => {
        this.variants.update((items) =>
          items.map((item) => (item.id === source.id ? updated : item)),
        );
        if (this.activeId() === source.id)
          this.baselineState.set(updated.state);
      },
      `View “${source.name}” could not be updated.`,
    );
  }

  resetWorkingState(): void {
    this._loadState(this.baselineState());
  }
  createAccount(): void {
    const number = this.accounts().length + 1;
    const account: Account = {
      id: `new-account-${number}`,
      name: `New account ${number}`,
      owner: 'Alina Pop',
      plan: 'Growth',
      arr: 0,
      health: 'Watch',
      renewalDate: '2027-09-01',
      renewalDays: 377,
      lastActivity: 'Just now',
    };
    this.accounts.update((items) => [...items, account]);
    this.exportStatus.set(`Added ${account.name}.`);
  }
  importAccounts(): void {
    const account: Account = {
      id: `imported-account-${this.accounts().length + 1}`,
      name: `Imported account ${this.accounts().length + 1}`,
      owner: 'Mara Ionescu',
      plan: 'Enterprise',
      arr: 184000,
      health: 'Healthy',
      renewalDate: '2027-08-14',
      renewalDays: 359,
      lastActivity: 'Imported just now',
    };
    this.accounts.update((items) => [...items, account]);
    this.exportStatus.set(`Imported ${account.name}.`);
  }

  applyFilterFields(fields: readonly MlvFilterFieldState[]): void {
    this.filterFields.set(fields);
    this.filterExpression.set(mlvFilterFieldsToExpression(fields));
  }

  clearFilters(): void {
    const fields: readonly MlvFilterFieldState[] = [];
    this.filterFields.set(fields);
    this.filterExpression.set(mlvFilterFieldsToExpression(fields));
    this.exportStatus.set('Cleared account filters.');
  }
  healthTone(health: Account['health']): 'danger' | 'warning' | 'success' {
    return health === 'At risk'
      ? 'danger'
      : health === 'Watch'
        ? 'warning'
        : 'success';
  }
  onPresentationStateChange(state: MlvDataTablePresentationState): void {
    this.tableState.set(cloneTableState(state));
  }
  openAccount(row: Record<string, unknown>): void {
    const id = typeof row['id'] === 'string' ? row['id'] : null;
    this.selectedAccount.set(
      this.accounts().find((account) => account.id === id) ?? null,
    );
  }

  onDetailsOpenedChange(opened: boolean): void {
    if (!opened) this.selectedAccount.set(null);
  }
  exportAccounts(): void {
    this.exportStatus.set(
      `Prepared ${this._table()?.totalItems() ?? this.expressionFilteredAccounts().length} accounts for export.`,
    );
  }
  retryOperation(): void {
    this._retry?.();
  }

  private _persist(
    action: MlvViewVariantBusyAction['action'],
    variantId: string,
    succeed: () => void,
    error: string,
  ): void {
    const originId = variantId;
    this.busyAction.set({ action, variantId: originId });
    this.operationError.set(null);
    const retry = () => {
      if (this.activeId() === originId)
        this._persist(action, originId, succeed, error);
    };
    this._retry = retry;
    const fail = this.failNextOperation();
    this.failNextOperation.set(false);
    void runShowcaseOperation(succeed, { fail }).then((result) => {
      if (this.busyAction()?.variantId === originId) this.busyAction.set(null);
      if (!result.ok) {
        if (this.activeId() === originId) this.operationError.set(error);
        return;
      }
      if (this.activeId() === originId) this.operationError.set(null);
      if (this._retry === retry) this._retry = null;
    });
  }
  private _loadVariant(id: string): void {
    const variant =
      this.variants().find((item) => item.id === id) ?? AT_RISK_VIEW;
    this.activeId.set(variant.id);
    this.baselineState.set(normalizeAccountsViewState(variant.state));
    this._loadState(variant.state);
  }
  private _loadState(state: AccountsViewState): void {
    this.search.set(state.search);
    this._loadExpression(state.filterExpression);
    const table = cloneTableState(state.table);
    this.tableState.set(table);
    queueMicrotask(() => {
      if (!this._destroyRef.destroyed) {
        this._table()?.applyPresentationState(table);
      }
    });
  }
  private _loadExpression(expression: MlvFilterExpression): void {
    const fields = mlvFilterExpressionToFields(expression);
    if (fields === null) {
      throw new Error(
        'The selected account view cannot be represented by the query filter bar.',
      );
    }
    this.filterExpression.set(expression);
    this.filterFields.set(fields);
  }
  private _resolveViewId(candidate: string | null): string {
    return candidate &&
      (this._variantIds.has(candidate) ||
        this.variants().some((view) => view.id === candidate))
      ? candidate
      : 'at-risk';
  }
  private _writeViewToUrl(view: string): void {
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

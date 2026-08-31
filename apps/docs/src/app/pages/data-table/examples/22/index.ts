import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import {
  MlvDataTable,
  type MlvDataTableColumn,
  type MlvDataTablePresentationState,
} from '@malva-ui/core/data-table';
import { MlvButton } from '@malva-ui/core/button';

interface RenewalAccount {
  account: string;
  owner: string;
  renewalDate: string;
  renewalRisk: 'At risk' | 'Watch' | 'On track';
  arr: string;
  segment: string;
}

const INITIAL_PRESENTATION: MlvDataTablePresentationState = {
  sort: null,
  visibleColumnKeys: [
    'account',
    'owner',
    'renewalDate',
    'renewalRisk',
    'arr',
    'segment',
  ],
  pinnedStartColumnKeys: ['account'],
  pinnedEndColumnKeys: [],
  columnWidths: {},
  perPage: 10,
};

@Component({
  selector: 'docs-data-table-presentation-state-example',
  imports: [MlvButton, MlvDataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class PresentationStateExampleComponent {
  private readonly _table = viewChild.required(MlvDataTable);
  private readonly _capturedPresentation =
    signal<MlvDataTablePresentationState | null>(null);

  readonly rows: RenewalAccount[] = [
    {
      account: 'Northstar Health',
      owner: 'Alina Pop',
      renewalDate: '2026-09-12',
      renewalRisk: 'At risk',
      arr: '$184,000',
      segment: 'Enterprise',
    },
    {
      account: 'Harbor Freight',
      owner: 'Mihai Ionescu',
      renewalDate: '2026-09-18',
      renewalRisk: 'Watch',
      arr: '$96,000',
      segment: 'Commercial',
    },
    {
      account: 'Cobalt Studio',
      owner: 'Sofia Marin',
      renewalDate: '2026-09-26',
      renewalRisk: 'On track',
      arr: '$54,000',
      segment: 'Growth',
    },
    {
      account: 'Aster Logistics',
      owner: 'Alina Pop',
      renewalDate: '2026-10-03',
      renewalRisk: 'Watch',
      arr: '$128,000',
      segment: 'Enterprise',
    },
  ];

  readonly columns: MlvDataTableColumn<RenewalAccount>[] = [
    {
      key: 'account',
      title: 'Account',
      sortable: true,
      pinned: true,
      pinSide: 'left',
      width: '220px',
    },
    { key: 'owner', title: 'Owner', hideable: true, width: '170px' },
    {
      key: 'renewalDate',
      title: 'Renewal date',
      sortable: true,
      hideable: true,
      width: '160px',
    },
    {
      key: 'renewalRisk',
      title: 'Renewal risk',
      hideable: true,
      width: '150px',
    },
    {
      key: 'arr',
      title: 'ARR',
      hideable: true,
      align: 'right',
      width: '140px',
    },
    { key: 'segment', title: 'Segment', hideable: true, width: '150px' },
  ];

  readonly hasCapturedPresentation = computed(
    () => this._capturedPresentation() !== null,
  );
  readonly status = signal('Capture the current table presentation to begin.');

  capturePresentation(): void {
    this._capturedPresentation.set(this._table().getPresentationState());
    this.status.set('Captured the current presentation.');
  }

  showRenewalReview(): void {
    this._table().applyPresentationState({
      sort: { key: 'renewalDate', direction: 'asc' },
      visibleColumnKeys: ['account', 'renewalDate', 'renewalRisk', 'arr'],
      pinnedStartColumnKeys: ['account'],
      pinnedEndColumnKeys: [],
    });
    this.status.set('Applied the renewal-review presentation.');
  }

  applyCapturedPresentation(): void {
    const presentation = this._capturedPresentation();
    if (!presentation) return;
    this._table().applyPresentationState(presentation);
    this.status.set('Reapplied the captured presentation.');
  }

  resetPresentation(): void {
    this._table().applyPresentationState(INITIAL_PRESENTATION);
    this.status.set('Reset the presentation to the example default.');
  }
}

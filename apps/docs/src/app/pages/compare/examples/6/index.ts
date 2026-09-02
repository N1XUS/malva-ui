import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCompare } from '@malva-ui/core/compare';

interface LineItem {
  label: string;
  amount: string;
}

@Component({
  selector: 'docs-compare-content-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare, MlvButton],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareContentExampleComponent {
  readonly position = signal(50);

  readonly items: readonly LineItem[] = [
    { label: 'Studio plan · 12 seats', amount: '€1,140.00' },
    { label: 'Additional storage · 2 TB', amount: '€48.00' },
    { label: 'Priority support', amount: '€120.00' },
    { label: 'VAT 20%', amount: '€261.60' },
  ];

  readonly total = '€1,569.60';
}

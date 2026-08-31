import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MlvDateRangePicker } from '@malva-ui/core/date-range-picker';
import type { MlvDateRangePickerValue } from '@malva-ui/core/date-range-picker';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-date-range-picker-reactive-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDateRangePicker, ReactiveFormsModule, MlvButton],
  templateUrl: './index.html',
})
export default class DateRangePickerReactiveFormsExampleComponent {
  readonly form = new FormGroup({
    dateRange: new FormControl<MlvDateRangePickerValue | null>(null, [
      Validators.required,
    ]),
    destination: new FormControl<string>('Paris'),
  });

  readonly submitted = signal(false);

  readonly summaryLines = computed(() => {
    if (!this.submitted()) return [];
    const { dateRange, destination } = this.form.value;
    const fmt = (d: Date | null | undefined) =>
      d
        ? d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'not set';
    return [
      `Destination: ${destination ?? '—'}`,
      `Check-in:    ${fmt(dateRange?.start)}`,
      `Check-out:   ${fmt(dateRange?.end)}`,
    ];
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitted.set(true);
  }

  reset(): void {
    this.form.reset();
    this.submitted.set(false);
  }
}

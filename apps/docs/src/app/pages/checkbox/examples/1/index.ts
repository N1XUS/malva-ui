import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { DocsInspectorComponent } from '../../../../shared';
import type { InspectorEvent } from '../../../../shared';

@Component({
  selector: 'docs-checkbox-basic-example',
  imports: [MlvCheckbox, ReactiveFormsModule, DocsInspectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class CheckboxBasicExampleComponent {
  /** Reactive form control bound to the checkbox. */
  readonly form = new FormControl(false);

  /** Recorded inspector events. */
  readonly events = signal<InspectorEvent[]>([]);

  /** Record an event into the inspector log. */
  protected _record(name: string, payload?: unknown): void {
    this.events.update((xs) => [...xs, { name, payload }]);
  }
}

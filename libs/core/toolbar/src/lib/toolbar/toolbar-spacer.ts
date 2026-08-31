import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'mlv-toolbar-spacer',
  template: '',
  styles: `
    .mlv-toolbar-spacer {
      flex: 1 1 auto;
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-toolbar-spacer',
  },
})
export class MlvToolbarSpacer {}

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

@Component({
  selector: 'docs-scrollbar-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrollbar],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ScrollbarVerticalExampleComponent {}

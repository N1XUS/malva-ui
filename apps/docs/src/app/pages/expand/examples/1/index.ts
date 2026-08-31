import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvExpand } from '@malva-ui/core/expand';
import { LucideChevronDown } from '@lucide/angular';

@Component({
  selector: 'docs-expand-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvExpand, LucideChevronDown],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ExpandBasicExampleComponent {}

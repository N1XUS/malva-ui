import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTabGroup,
  MlvTab,
  MlvTabDef,
  MlvTabContentDef,
} from '@malva-ui/core/tabs';

@Component({
  selector: 'docs-tabs-vertical-example',
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TabsVerticalExampleComponent {
  readonly activeTab = signal('general');
}

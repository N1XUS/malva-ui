import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTabGroup,
  MlvTab,
  MlvTabDef,
  MlvTabContentDef,
} from '@malva-ui/core/tabs';
import { MlvButton } from '@malva-ui/core/button';
import { MlvClick } from '@malva-ui/cdk/accessibility';

@Component({
  selector: 'docs-tabs-overflow-example',
  imports: [
    MlvTabGroup,
    MlvTab,
    MlvTabDef,
    MlvTabContentDef,
    MlvButton,
    MlvClick,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TabsOverflowExampleComponent {
  readonly activeTab = signal('tab-1');
  readonly containerWidth = signal(400);

  readonly manyTabs = Array.from({ length: 8 }, (_, i) => ({
    id: `tab-${i + 1}`,
    label: `Tab ${i + 1}`,
  }));

  resize(): void {
    this.containerWidth.update((value) => (value === 800 ? 400 : 800));
  }
}

import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTabGroup,
  MlvTab,
  MlvTabDef,
  MlvTabContentDef,
} from '@malva-ui/core/tabs';

@Component({
  selector: 'docs-tabs-nested-example',
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TabsNestedExampleComponent {
  readonly outerTab = signal('frontend');
  readonly innerFrontendTab = signal('angular');
}

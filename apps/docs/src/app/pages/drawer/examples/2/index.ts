import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerHeader,
  MlvDrawerBody,
  MlvDrawerFooter,
} from '@malva-ui/core/drawer';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-drawer-bottom-sheet-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDrawerFooter,
    MlvButton,
  ],
  templateUrl: './index.html',
})
export default class DrawerBottomSheetExampleComponent {
  readonly showSheet = signal(false);
  readonly snapPoints = [40, 80, 100];
}

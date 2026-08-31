import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerHeader,
  DrawerBodyDirective,
  MlvDrawerFooter,
} from '@malva-ui/core/drawer';
import { MlvButton } from '@malva-ui/core/button';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'docs-drawer-bottom-sheet-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    DrawerBodyDirective,
    MlvDrawerFooter,
    MlvButton,
    LucideX,
  ],
  templateUrl: './index.html',
})
export default class DrawerBottomSheetExampleComponent {
  readonly showSheet = signal(false);
  readonly snapPoints = [40, 80, 100];
}

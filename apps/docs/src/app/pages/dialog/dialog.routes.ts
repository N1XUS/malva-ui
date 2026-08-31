import type { Routes } from '@angular/router';
import { mlvGenerateRoutableDialogRoute } from '@malva-ui/core/dialog';

import { EditDialogContentComponent } from './examples/6/index';

export const dialogChildRoutes: Routes = [
  mlvGenerateRoutableDialogRoute(EditDialogContentComponent, {
    path: 'edit',
    size: 's',
  }),
];

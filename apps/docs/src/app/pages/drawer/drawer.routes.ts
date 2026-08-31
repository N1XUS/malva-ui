import type { Routes } from '@angular/router';
import { mlvGenerateRoutableDrawerRoute } from '@malva-ui/core/drawer';

import { DetailsDrawerContentComponent } from './examples/3/index';

export const drawerChildRoutes: Routes = [
  mlvGenerateRoutableDrawerRoute(DetailsDrawerContentComponent, {
    path: 'details',
    position: 'right',
    size: '400px',
  }),
];

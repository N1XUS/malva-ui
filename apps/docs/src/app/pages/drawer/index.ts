import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
      [meta]="meta"
      [examples]="exampleArray"
      header="drawer"
    />
    <router-outlet />`,
})
export class DrawerPageComponent {
  exampleArray = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Drawer',
    description: 'Slide-out panel for supplementary content and forms.',
  };
}

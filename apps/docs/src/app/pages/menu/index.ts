import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="menu"
  />`,
})
export class MenuPageComponent {
  exampleArray = new Array(8).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Menu',
    description:
      'Dropdown action menus with keyboard navigation, grouped items, separators, and nested submenus with triangle pointer tracking to prevent accidental closure on diagonal mouse movement.',
  };
}

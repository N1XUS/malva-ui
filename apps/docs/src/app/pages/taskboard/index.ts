import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="taskboard"
  />`,
})
export class TaskboardPageComponent {
  readonly meta: DocPageMeta = {
    title: 'Taskboard',
    description:
      'Typed, controlled Kanban board from the standalone @malva-ui/taskboard package. Projected card templates, column groups and swimlanes, WIP limits, transition and permission policies, multi-select, a full keyboard drag model, virtual cells, and undo/snapshot/export/print.',
  };

  readonly examples = new Array(8).fill(0).map((_, index) => index + 1);
}

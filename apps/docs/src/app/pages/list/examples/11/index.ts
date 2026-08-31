import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  MlvList,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemSelectable,
  MlvListItemTitle,
  MlvListSelectable,
} from '@malva-ui/core/list';

interface Teammate {
  id: string;
  name: string;
  role: string;
}

@Component({
  selector: 'docs-list-assign-owner-example',
  imports: [
    MlvAvatar,
    MlvList,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemSelectable,
    MlvListItemTitle,
    MlvListSelectable,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListAssignOwnerExampleComponent {
  protected readonly teammates: Teammate[] = [
    { id: 'marcus', name: 'Marcus Reid', role: 'Frontend engineer' },
    { id: 'priya', name: 'Priya Natarajan', role: 'Product manager' },
    { id: 'amelia', name: 'Amelia Chen', role: 'Design lead' },
    { id: 'sana', name: 'Sana Al-Rashid', role: 'Backend engineer' },
  ];

  protected readonly selected = signal<string[]>(['priya']);

  protected readonly selectedTeammate = computed(() =>
    this.teammates.find((teammate) => teammate.id === this.selected()[0]),
  );
}

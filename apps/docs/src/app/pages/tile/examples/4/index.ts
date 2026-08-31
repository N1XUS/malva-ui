import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideClock } from '@lucide/angular';
import {
  MlvTile,
  MlvTileHeader,
  MlvTiles,
  type MlvTileNodeWithChildren,
  type MlvTileTone,
} from '@malva-ui/core/tile';

interface TileDragProps {
  title: string;
  body: string;
  showsTimeIcon?: boolean;
  tone: MlvTileTone;
  disabled: boolean;
}

@Component({
  selector: 'docs-tile-sortable-example',
  imports: [MlvTile, MlvTileHeader, MlvTiles, LucideClock],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'docs-tile-sortable-example',
  },
})
export default class TileSortableExampleComponent {
  readonly list = signal<MlvTileNodeWithChildren<TileDragProps>>({
    id: 'dashboard',
    acceptsChildren: true,
    props: {
      title: 'Dashboard',
      body: 'Sortable summary tiles',
      tone: 'default',
      disabled: false,
    },
    children: [
      {
        id: 'design-review',
        acceptsChildren: false,
        props: {
          title: 'Design review',
          body: 'Today at 10:30',
          showsTimeIcon: true,
          tone: 'info',
          disabled: false,
        },
      },
      {
        id: 'release-checklist',
        acceptsChildren: false,
        props: {
          title: 'Release checklist',
          body: '4 of 6 items complete',
          tone: 'success',
          disabled: false,
        },
      },
      {
        id: 'open-questions',
        acceptsChildren: false,
        props: {
          title: 'Open questions',
          body: '3 decisions pending',
          tone: 'warning',
          disabled: false,
        },
      },
      {
        id: 'team-availability',
        acceptsChildren: false,
        props: {
          title: 'Team availability',
          body: 'Pinned to this dashboard',
          tone: 'default',
          disabled: true,
        },
      },
      {
        id: 'recent-files',
        acceptsChildren: false,
        props: {
          title: 'Recent files',
          body: '12 documents',
          tone: 'default',
          disabled: false,
        },
      },
    ],
  });
}

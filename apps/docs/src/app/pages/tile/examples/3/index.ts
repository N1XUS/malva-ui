import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvTile, MlvTileHeader } from '@malva-ui/core/tile';

@Component({
  selector: 'docs-tile-closable-example',
  imports: [MlvTile, MlvTileHeader],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class TileClosableExampleComponent {
  readonly tiles = signal([
    {
      id: 1,
      title: 'Draft saved',
      body: 'Brand refresh was saved to your drafts.',
    },
    {
      id: 2,
      title: 'Maintenance window',
      body: 'Saturday, 02:00–04:00 UTC.',
    },
    {
      id: 3,
      title: 'Review ready',
      body: 'Landing page copy is ready for review.',
    },
  ]);

  readonly closingIds = signal<Set<number>>(new Set());

  close(id: number): void {
    this.closingIds.update((s) => new Set([...s, id]));
    setTimeout(() => {
      this.tiles.update((t) => t.filter((tile) => tile.id !== id));
      this.closingIds.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 200);
  }
}

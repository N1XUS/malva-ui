import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideArchive, LucideStar, LucideTrash2 } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvSwipeActionsSide } from '@malva-ui/core/swipe-actions';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

@Component({
  selector: 'docs-swipe-actions-controlled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    MlvButton,
    LucideArchive,
    LucideStar,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsControlledExampleComponent {
  /** Two-way bound side; `null` while the row rests on its content. */
  readonly opened = signal<MlvSwipeActionsSide | null>(null);

  /** Every settled state the row reported, newest first. */
  readonly log = signal<string[]>([]);

  /** Writes the model from outside; the row scrolls there and settles silently. */
  reveal(side: MlvSwipeActionsSide | null): void {
    this.opened.set(side);
    this._record(`opened.set(${side === null ? 'null' : `'${side}'`})`);
  }

  /** Fires only for changes the row makes itself, never for a value written to it. */
  onOpened(side: MlvSwipeActionsSide | null): void {
    this._record(`openedChange → ${side ?? 'null'}`);
  }

  act(action: string): void {
    this._record(`${action} activated`);
  }

  private _record(entry: string): void {
    this.log.update((entries) => [entry, ...entries].slice(0, 6));
  }
}

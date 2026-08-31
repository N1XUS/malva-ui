import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDialogService } from '@malva-ui/core/dialog';

@Component({
  selector: 'docs-dialog-confirm-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class DialogConfirmExampleComponent {
  private readonly _dialogService = inject(MlvDialogService);

  /**
   * `takeUntilDestroyed()` outside a field initializer needs the ref passed
   * explicitly — it is not in an injection context inside a method.
   */
  private readonly _destroyRef = inject(DestroyRef);

  readonly lastAnswer = signal<string>('No confirmation requested yet.');

  publish(): void {
    this._dialogService
      .confirm({
        title: 'Publish release notes?',
        message: 'Everyone in the workspace will be notified immediately.',
        confirmLabel: 'Publish',
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((confirmed) =>
        this.lastAnswer.set(
          confirmed ? 'Publish: confirmed' : 'Publish: cancelled',
        ),
      );
  }

  deleteProject(): void {
    this._dialogService
      .confirm({
        title: 'Delete “Website redesign”?',
        message:
          'The project and all of its 42 tasks are removed. This cannot be undone.',
        confirmLabel: 'Delete project',
        destructive: true,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((confirmed) =>
        this.lastAnswer.set(
          confirmed ? 'Delete: confirmed' : 'Delete: cancelled',
        ),
      );
  }
}

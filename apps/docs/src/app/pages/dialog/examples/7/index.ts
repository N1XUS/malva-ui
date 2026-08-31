import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  DIALOG_DATA,
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogService,
  type MlvDialogRef,
  type MlvDialogTemplateContext,
} from '@malva-ui/core/dialog';

interface ProjectDialogData {
  projectName: string;
  owner: string;
}

@Component({
  selector: 'docs-project-dialog-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  template: `
    <mlv-dialog>
      <mlv-dialog-header />
      <mlv-dialog-body>
        <p>
          This component received its data through
          <code>DIALOG_DATA</code>. The project owner is {{ data.owner }}.
        </p>
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
        <button mlvButton mlvDialogClose="approved">Approve</button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
export class ProjectDialogContentComponent {
  readonly data = inject(DIALOG_DATA) as ProjectDialogData;
}

@Component({
  selector: 'docs-dialog-programmatic-content-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
  ],
  templateUrl: './index.html',
})
export default class DialogProgrammaticContentExampleComponent {
  private readonly _dialogService = inject(MlvDialogService);
  private _activeRef: MlvDialogRef<string, unknown> | MlvDialogRef | null =
    null;

  openString(): void {
    this._track(
      this._dialogService.open('Your workspace settings have been saved.', {
        size: 's',
        title: 'Settings saved',
      }),
    );
  }

  openTemplate(
    template: TemplateRef<MlvDialogTemplateContext<string, ProjectDialogData>>,
  ): void {
    this._track(
      this._dialogService.open<string, ProjectDialogData>(template, {
        size: 's',
        title: 'Website redesign',
        data: { projectName: 'Website redesign', owner: 'Mina Park' },
      }),
    );
  }

  openComponent(): void {
    this._track(
      this._dialogService.open<string, ProjectDialogData>(
        ProjectDialogContentComponent,
        {
          size: 's',
          title: 'Mobile app launch',
          data: { projectName: 'Mobile app launch', owner: 'Alex Chen' },
        },
      ),
    );
  }

  closeActive(): void {
    this._activeRef?.close();
    this._activeRef = null;
  }

  /**
   * Holds the newly opened dialog and drops it again once it closes — however
   * it was dismissed — so `closeActive()` never calls a disposed ref.
   */
  private _track(ref: MlvDialogRef<string, unknown> | MlvDialogRef): void {
    this._activeRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this._activeRef === ref) {
        this._activeRef = null;
      }
    });
  }
}

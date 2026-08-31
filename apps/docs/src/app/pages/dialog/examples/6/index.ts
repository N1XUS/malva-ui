import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
} from '@malva-ui/core/dialog';

/**
 * Dialog content opened via the routable dialog pattern. Renders the dialog
 * surface and parts itself; `[mlvDialogClose]` closes it, and `ActivatedRoute`
 * is available for route params.
 */
@Component({
  selector: 'docs-edit-dialog-content',
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
      <mlv-dialog-header title="Edit User" />
      <mlv-dialog-body>
        <p>
          This dialog was opened by navigating to the
          <code>/dialog/edit</code> child route. The URL in the browser bar
          changed when it opened.
        </p>
        <p>
          When dismissed, the router navigates back to
          <code>/dialog</code> automatically.
        </p>
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
        <button mlvButton mlvDialogClose="saved">Save</button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
export class EditDialogContentComponent {
  readonly route = inject(ActivatedRoute);
}

@Component({
  selector: 'docs-dialog-routable-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, RouterLink],
  templateUrl: './index.html',
})
export default class DialogRoutableExampleComponent {}

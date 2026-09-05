import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  MlvDrawerRef,
  MlvDrawerHeader,
  MlvDrawerBody,
  MlvDrawerFooter,
} from '@malva-ui/core/drawer';
import { MlvButton } from '@malva-ui/core/button';
import { MlvToolbar, MlvToolbarSpacer } from '@malva-ui/core/toolbar';

/**
 * Drawer content opened via routable drawer pattern.
 * Uses library directives for header/body/footer — no manual HTML needed.
 * Injects MlvDrawerRef to close itself and ActivatedRoute for route params.
 */
@Component({
  selector: 'docs-details-drawer-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDrawerFooter,
    MlvToolbar,
    MlvToolbarSpacer,
  ],
  template: `
    <mlv-drawer-header title="User Details" />
    <div mlvDrawerBody>
      <p>
        This drawer was opened by navigating to the
        <code>/drawer/details</code> child route. The URL in the browser bar
        changed when it opened.
      </p>
      <p>
        When dismissed, the router navigates back to
        <code>/drawer</code> automatically.
      </p>
    </div>
    <div mlvDrawerFooter>
      <mlv-toolbar>
        <mlv-toolbar-spacer />
        <button mlvButton (click)="ref.close()">Close</button>
      </mlv-toolbar>
    </div>
  `,
})
export class DetailsDrawerContentComponent {
  readonly ref = inject<MlvDrawerRef<string>>(MlvDrawerRef);
  readonly route = inject(ActivatedRoute);
}

@Component({
  selector: 'docs-drawer-routable-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, RouterLink],
  templateUrl: './index.html',
})
export default class DrawerRoutableExampleComponent {}

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { LucideZap } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  PLAYGROUND_PEERS,
  PLAYGROUND_VERSIONS,
} from '../../../generated/playground-versions';
import { createPlaygroundProject } from './playground-project';
import type { PlaygroundSourceFile } from './playground-project';
import { submitPlaygroundProject } from './playground-submit';

/**
 * The "Open in StackBlitz" affordance shown under a docs example.
 *
 * Rendered by `docs-example-container`, which is the single call site every
 * example already flows through, so one component reaches all 474 of them.
 *
 * It renders **nothing** for an example that cannot be lifted out of the docs
 * app — five of them import docs-local code, which is not published. A button
 * that opened a project failing to compile would be worse than no button, and
 * the check is derived from the source rather than a list, so an example that
 * becomes non-portable loses its button on the same commit.
 */
@Component({
  selector: 'docs-open-in-playground',
  imports: [MlvButton, MlvButtonIcon, LucideZap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (project(); as playground) {
      <button
        type="button"
        class="open-in-playground"
        mlvButton
        variant="transparent"
        (click)="open()"
      >
        <svg mlvButtonIcon lucideZap [size]="16" aria-hidden="true"></svg>
        Open in StackBlitz
      </button>
    }
  `,
  styles: `
    .open-in-playground {
      margin: var(--mlv-spacing-2);
    }
  `,
})
export class OpenInPlaygroundComponent {
  /**
   * The example's resolved source files, as `docs-example-container` holds
   * them. Empty until the dynamic text imports settle, which is why the button
   * appears a tick after the preview.
   */
  readonly files = input<readonly PlaygroundSourceFile[]>([]);

  /** The documentation page's heading, used to title the generated project. */
  readonly heading = input<string>('');

  /** @private The document the hidden POST form is built in. */
  private readonly _document = inject(DOCUMENT);

  /**
   * @protected The project payload for this example, or `null` when it cannot
   * be built. Bound by the template to decide whether the button exists at all.
   */
  protected readonly project = computed(
    () =>
      createPlaygroundProject({
        files: this.files(),
        versions: PLAYGROUND_VERSIONS,
        peers: PLAYGROUND_PEERS,
        title: this._title(),
        description:
          'A runnable copy of an example from the Malva UI documentation.',
      }).project,
  );

  /** @private The generated project's title. */
  private readonly _title = computed(() => {
    const heading = this.heading().trim();
    return heading ? `Malva UI — ${heading}` : 'Malva UI example';
  });

  /**
   * @protected Opens the example on StackBlitz. Called from the click handler
   * only, because the form submission has to be inside a user gesture.
   */
  protected open(): void {
    const project = this.project();
    if (project) submitPlaygroundProject(project, this._document);
  }
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideSparkles } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvFileUpload,
  MlvFileUploadAction,
  type MlvUploadedFile,
} from '@malva-ui/core/file-upload';

/**
 * Stand-in artwork for the seeded value. Inline SVG keeps the example
 * self-contained — a real edit form would point `previewUrl` at the stored
 * image's URL instead.
 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>" +
  "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='rgb(124,92,255)'/>" +
  "<stop offset='1' stop-color='rgb(0,194,178)'/></linearGradient></defs>" +
  "<rect width='640' height='400' fill='url(%23g)'/>" +
  "<circle cx='140' cy='110' r='52' fill='rgb(255,255,255)' fill-opacity='0.35'/>" +
  "<path d='M0 300 L180 190 L330 300 L470 210 L640 320 L640 400 L0 400 Z' " +
  "fill='rgb(255,255,255)' fill-opacity='0.25'/></svg>";

@Component({
  selector: 'docs-file-upload-cover-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload, MlvFileUploadAction, MlvButton, LucideSparkles],
  templateUrl: './index.html',
})
export default class DocsFileUploadCoverExampleComponent {
  /**
   * Edit-mode seed: an already-stored image. `previewUrl` is what puts the
   * control into cover state — the `File` is only a placeholder for a value
   * that never went through the picker.
   */
  readonly cover = signal<MlvUploadedFile[]>([
    {
      id: 'seed-cover',
      file: new File([], 'campaign-hero.svg', { type: 'image/svg+xml' }),
      name: 'campaign-hero.svg',
      size: 0,
      previewUrl: PLACEHOLDER_IMAGE,
      state: 'success',
    },
  ]);

  /** Starts empty, so it shows the normal drop zone until an image is chosen. */
  readonly empty = signal<MlvUploadedFile[]>([]);

  /** Last projected toolbar action the user triggered. */
  readonly lastAction = signal('none yet');

  /** Records a projected toolbar action instead of opening the file picker. */
  onExtraAction(label: string): void {
    this.lastAction.set(label);
  }
}

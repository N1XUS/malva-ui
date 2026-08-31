import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvChip } from '@malva-ui/core/chip';

@Component({
  selector: 'docs-chip-closable-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChip],
  templateUrl: './index.html',
})
export default class ChipClosableExampleComponent {
  readonly tags = signal<string[]>([
    'Angular',
    'TypeScript',
    'SCSS',
    'Malva UI',
    'Nx',
  ]);

  removeTag(tag: string): void {
    this.tags.update((items) => items.filter((t) => t !== tag));
  }
}

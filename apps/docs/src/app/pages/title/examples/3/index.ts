import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-editable-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, MlvTitle],
  templateUrl: './index.html',
})
export default class TitleEditableExampleComponent {
  readonly headline = signal<string | null>('Roadmap for Q2');
}

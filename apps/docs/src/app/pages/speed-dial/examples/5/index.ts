import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideBold,
  LucideHighlighter,
  LucideItalic,
  LucideUnderline,
  provideLucideIcons,
} from '@lucide/angular';
import { MlvSpeedDial } from '@malva-ui/core/speed-dial';
import type { MlvSpeedDialItem } from '@malva-ui/core/speed-dial';

@Component({
  selector: 'docs-speed-dial-hover-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSpeedDial],
  providers: [
    provideLucideIcons(
      LucideBold,
      LucideHighlighter,
      LucideItalic,
      LucideUnderline,
    ),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SpeedDialHoverExampleComponent {
  readonly formatting: MlvSpeedDialItem[] = [
    { label: 'Bold', icon: 'bold' },
    { label: 'Italic', icon: 'italic' },
    { label: 'Underline', icon: 'underline' },
    { label: 'Highlight', icon: 'highlighter' },
  ];
}

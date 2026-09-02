import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideCamera,
  LucideFile,
  LucideImage,
  LucideLink,
  LucideMic,
  LucideVideo,
  provideLucideIcons,
} from '@lucide/angular';
import { MlvSpeedDial } from '@malva-ui/core/speed-dial';
import type { MlvSpeedDialItem } from '@malva-ui/core/speed-dial';

@Component({
  selector: 'docs-speed-dial-radial-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSpeedDial],
  providers: [
    provideLucideIcons(
      LucideCamera,
      LucideFile,
      LucideImage,
      LucideLink,
      LucideMic,
      LucideVideo,
    ),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SpeedDialRadialExampleComponent {
  readonly attachments: MlvSpeedDialItem[] = [
    { label: 'Photo', icon: 'camera' },
    { label: 'Image', icon: 'image' },
    { label: 'Video', icon: 'video' },
    { label: 'Audio', icon: 'mic' },
    { label: 'File', icon: 'file' },
    { label: 'Link', icon: 'link' },
  ];

  readonly few = this.attachments.slice(0, 4);
  readonly three = this.attachments.slice(0, 3);
}

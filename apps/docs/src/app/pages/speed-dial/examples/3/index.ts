import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  LucideLink,
  LucideMail,
  LucideMessageCircle,
  LucideQrCode,
  LucideRss,
  LucideShare2,
  provideLucideIcons,
} from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvSpeedDial,
  MlvSpeedDialTriggerIcon,
} from '@malva-ui/core/speed-dial';
import type { MlvSpeedDialItem } from '@malva-ui/core/speed-dial';

@Component({
  selector: 'docs-speed-dial-mask-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSpeedDial, MlvSpeedDialTriggerIcon, MlvButton, LucideShare2],
  providers: [
    provideLucideIcons(
      LucideLink,
      LucideMail,
      LucideMessageCircle,
      LucideQrCode,
      LucideRss,
    ),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SpeedDialMaskExampleComponent {
  readonly opened = signal(false);

  readonly channels: MlvSpeedDialItem[] = [
    { label: 'Email', icon: 'mail' },
    { label: 'Message', icon: 'message-circle' },
    { label: 'Copy link', icon: 'link' },
    { label: 'QR code', icon: 'qr-code' },
    { label: 'RSS feed', icon: 'rss', disabled: true },
  ];
}

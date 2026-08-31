import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LucideIconInput } from '@lucide/angular';
import {
  LucideAppWindow,
  LucideBellRing,
  LucideCalendarDays,
  LucideCircleUserRound,
  LucideDynamicIcon,
  LucideFolderOpen,
  LucideGitCommitVertical,
  LucideListChevronsUpDown,
  LucideListOrdered,
  LucideLoaderCircle,
  LucideMessageSquareText,
  LucideMessagesSquare,
  LucideNetwork,
  LucidePanelRightOpen,
  LucideRectangleEllipsis,
  LucideScrollText,
  LucideSearch,
  LucideSlidersHorizontal,
  LucideSquareMenu,
  LucideSquareMousePointer,
  LucideStar,
  LucideTable,
  LucideTag,
  LucideTextCursorInput,
  LucideToggleRight,
} from '@lucide/angular';

interface MarqueeEntry {
  readonly label: string;
  readonly icon: LucideIconInput;
  readonly route: string;
}

const ROW_ONE: MarqueeEntry[] = [
  { label: 'Button', icon: LucideSquareMousePointer, route: '/button' },
  { label: 'Input', icon: LucideTextCursorInput, route: '/input' },
  { label: 'Select', icon: LucideListChevronsUpDown, route: '/select' },
  { label: 'Combobox', icon: LucideSearch, route: '/combobox' },
  { label: 'Data table', icon: LucideTable, route: '/data-table' },
  { label: 'Dialog', icon: LucideAppWindow, route: '/dialog' },
  { label: 'Calendar', icon: LucideCalendarDays, route: '/calendar' },
  { label: 'Stepper', icon: LucideListOrdered, route: '/stepper' },
  { label: 'Menu', icon: LucideSquareMenu, route: '/menu' },
  { label: 'Tabs', icon: LucideFolderOpen, route: '/tabs' },
  { label: 'Chat', icon: LucideMessagesSquare, route: '/chat' },
  { label: 'Editor', icon: LucideScrollText, route: '/editor' },
];

const ROW_TWO: MarqueeEntry[] = [
  { label: 'Switch', icon: LucideToggleRight, route: '/switch' },
  { label: 'Slider', icon: LucideSlidersHorizontal, route: '/slider' },
  { label: 'Rating', icon: LucideStar, route: '/rating' },
  { label: 'Progress', icon: LucideLoaderCircle, route: '/progress' },
  { label: 'Toast', icon: LucideBellRing, route: '/toast' },
  { label: 'Tooltip', icon: LucideMessageSquareText, route: '/tooltip' },
  { label: 'Timeline', icon: LucideGitCommitVertical, route: '/timeline' },
  { label: 'Avatar', icon: LucideCircleUserRound, route: '/avatar' },
  { label: 'Chip', icon: LucideTag, route: '/chip' },
  { label: 'Pin input', icon: LucideRectangleEllipsis, route: '/pin-input' },
  { label: 'Drawer', icon: LucidePanelRightOpen, route: '/drawer' },
  { label: 'Tree', icon: LucideNetwork, route: '/tree' },
];

/**
 * Infinite dual-direction marquee of component links for the landing page.
 * The animated duplicate tracks are decorative (`aria-hidden`, spans instead
 * of anchors); reduced-motion users get two static, scrollable rows instead.
 */
@Component({
  selector: 'docs-home-marquee',
  templateUrl: './home-marquee.html',
  styleUrl: './home-marquee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideDynamicIcon],
})
export class HomeMarqueeComponent {
  protected readonly rows = [
    { entries: ROW_ONE, reverse: false },
    { entries: ROW_TWO, reverse: true },
  ];
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAnimatedPresence } from '@malva-ui/cdk/utils';

type Tab = 'overview' | 'settings' | 'logs';

/**
 * Example: animating tab panel transitions with animated presence.
 * Each tab panel mounts/unmounts with an animation when switching.
 */
@Component({
  selector: 'docs-animated-presence-tabs-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAnimatedPresence],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class AnimatedPresenceTabsExampleComponent {
  readonly activeTab = signal<Tab>('overview');

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
    { id: 'logs', label: 'Logs' },
  ];

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  isActive(tab: Tab): boolean {
    return this.activeTab() === tab;
  }
}

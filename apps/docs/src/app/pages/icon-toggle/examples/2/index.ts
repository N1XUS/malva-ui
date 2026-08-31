import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { LucideStar } from '@lucide/angular';

interface DocsThread {
  id: string;
  subject: string;
  starred: boolean;
}

@Component({
  selector: 'docs-icon-toggle-tone-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvIconToggle, LucideStar],
  templateUrl: './index.html',
})
export default class IconToggleToneExampleComponent {
  // One-way [pressed] + an explicit handler, matching the exhibit-B
  // replacement pattern (visual-language spec §7 Recipe B): the fixture
  // stays the single source of truth and the toggle never writes its own
  // model behind the caller's back.
  readonly threads = signal<DocsThread[]>([
    { id: 't1', subject: 'Renewal quote follow-up', starred: true },
    { id: 't2', subject: 'Password reset not working', starred: false },
    { id: 't3', subject: 'Feature request: dark mode', starred: false },
  ]);

  toggleStar(id: string): void {
    this.threads.update((threads) =>
      threads.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t)),
    );
  }
}

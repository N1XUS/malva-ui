import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { InspectorService } from './inspector.service';
import type { InspectorEvent } from './inspector.types';

/**
 * Observability panel for docs examples. Renders a JSON dump of the current
 * value, a list of recorded events, and arbitrary metadata. Hidden by default;
 * visible when the Playwright fixture has set `window.__MLV_E2E__ = true` or
 * when `forceVisible` is true (for interactive docs experimentation).
 */
@Component({
  selector: 'docs-inspector',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'docs-inspector',
    '[attr.data-testid]': '"inspector"',
  },
  template: `
    @if (visible()) {
      <div>
        <span class="docs-inspector__label">value</span>
        <pre class="docs-inspector__value" data-testid="inspector-value">{{
          value() | json
        }}</pre>
      </div>
      <div>
        <span class="docs-inspector__label">events</span>
        <ul class="docs-inspector__events" data-testid="inspector-events">
          @for (e of events(); track $index) {
            <li [attr.data-event]="e.name">
              {{ e.name }}: {{ e.payload | json }}
            </li>
          }
        </ul>
      </div>
      <div>
        <span class="docs-inspector__label">meta</span>
        <pre class="docs-inspector__meta" data-testid="inspector-meta">{{
          meta() | json
        }}</pre>
      </div>
    }
  `,
  styleUrl: './inspector.component.scss',
})
export class DocsInspectorComponent {
  /** Current component value — typically a reactive form value or signal snapshot. */
  readonly value = input<unknown>(null);
  /** Event log recorded by the example component from `(output)` emissions. */
  readonly events = input<readonly InspectorEvent[]>([]);
  /** Freeform metadata — disabled state, open/closed, validation status, etc. */
  readonly meta = input<Record<string, unknown>>({});
  /** Opt-in override to render the panel even outside E2E mode. */
  readonly forceVisible = input<boolean>(false);

  /** @private Reads the runtime E2E flag. */
  private readonly _svc = inject(InspectorService);

  /** @protected True when the panel should render. */
  protected readonly visible = computed(
    () => this.forceVisible() || this._svc.isE2e(),
  );
}

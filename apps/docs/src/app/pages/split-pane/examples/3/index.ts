import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';

@Component({
  selector: 'docs-split-pane-three-panel-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane style="height: 240px;">
      <mlv-split-pane-panel [size]="20" [minSize]="10">
        <div
          style="padding: 0.75rem; height: 100%; box-sizing: border-box; background: var(--mlv-background-neutral-2);"
        >
          <strong style="font-size: var(--mlv-typography-body-s-size);"
            >Explorer</strong
          >
          <ul
            style="margin: 0.5rem 0 0; padding-left: 1rem; font-size: var(--mlv-typography-body-s-size); color: var(--mlv-text-secondary); list-style: disc;"
          >
            <li>src/</li>
            <li>tests/</li>
            <li>package.json</li>
          </ul>
        </div>
      </mlv-split-pane-panel>
      <mlv-split-pane-panel>
        <div
          style="padding: 0.75rem; height: 100%; box-sizing: border-box; font-family: monospace; font-size: var(--mlv-typography-body-s-size); color: var(--mlv-text-secondary);"
        >
          <strong
            style="font-family: var(--mlv-typography-family-text); color: var(--mlv-text-primary);"
            >Editor</strong
          >
          <p style="margin: 0.5rem 0 0;">// main content area</p>
        </div>
      </mlv-split-pane-panel>
      <mlv-split-pane-panel [size]="25" [minSize]="10">
        <div
          style="padding: 0.75rem; height: 100%; box-sizing: border-box; background: var(--mlv-background-neutral-2);"
        >
          <strong style="font-size: var(--mlv-typography-body-s-size);"
            >Properties</strong
          >
          <p
            style="margin: 0.5rem 0 0; font-size: var(--mlv-typography-body-s-size); color: var(--mlv-text-secondary);"
          >
            Inspector panel
          </p>
        </div>
      </mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
export default class SplitPaneThreePanelExampleComponent {}

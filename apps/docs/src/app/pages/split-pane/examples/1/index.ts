import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';

@Component({
  selector: 'docs-split-pane-horizontal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane style="height: 200px;">
      <mlv-split-pane-panel [size]="30">
        <div style="padding: 1rem; height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 0.5rem;">Left Pane</h4>
          <p
            style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin: 0;"
          >
            Drag the handle or use arrow keys.
          </p>
        </div>
      </mlv-split-pane-panel>
      <mlv-split-pane-panel>
        <div style="padding: 1rem; height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 0.5rem;">Right Pane</h4>
          <p
            style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin: 0;"
          >
            Auto-sized — takes the remaining space.
          </p>
        </div>
      </mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
export default class SplitPaneHorizontalExampleComponent {}

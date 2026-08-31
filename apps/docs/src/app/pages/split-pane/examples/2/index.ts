import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';

@Component({
  selector: 'docs-split-pane-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane orientation="vertical" style="height: 260px;">
      <mlv-split-pane-panel [size]="40">
        <div style="padding: 1rem; height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 0.5rem;">Top Pane</h4>
          <p
            style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin: 0;"
          >
            Drag the horizontal handle to resize vertically.
          </p>
        </div>
      </mlv-split-pane-panel>
      <mlv-split-pane-panel>
        <div style="padding: 1rem; height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 0.5rem;">Bottom Pane</h4>
          <p
            style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin: 0;"
          >
            Fills the remaining vertical space.
          </p>
        </div>
      </mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
export default class SplitPaneVerticalExampleComponent {}

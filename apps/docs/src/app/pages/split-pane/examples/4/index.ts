import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';

@Component({
  selector: 'docs-split-pane-nested-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane style="height: 260px;">
      <mlv-split-pane-panel [size]="25" [minSize]="15">
        <!-- Nested vertical split inside the left panel -->
        <mlv-split-pane orientation="vertical" style="height: 100%;">
          <mlv-split-pane-panel [size]="55">
            <div
              style="padding: 0.75rem; height: 100%; box-sizing: border-box; background: var(--mlv-background-neutral-2);"
            >
              <strong style="font-size: var(--mlv-typography-body-s-size);"
                >Files</strong
              >
            </div>
          </mlv-split-pane-panel>
          <mlv-split-pane-panel>
            <div
              style="padding: 0.75rem; height: 100%; box-sizing: border-box; background: var(--mlv-background-neutral-2);"
            >
              <strong style="font-size: var(--mlv-typography-body-s-size);"
                >Output</strong
              >
              <p
                style="margin: 0.25rem 0 0; font-size: var(--mlv-typography-body-s-size); color: var(--mlv-text-secondary);"
              >
                Build complete.
              </p>
            </div>
          </mlv-split-pane-panel>
        </mlv-split-pane>
      </mlv-split-pane-panel>
      <mlv-split-pane-panel>
        <div style="padding: 1rem; height: 100%; box-sizing: border-box;">
          <strong>Editor</strong>
          <p
            style="margin: 0.5rem 0 0; color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
          >
            Nested split pane on the left, inside the outer horizontal split.
          </p>
        </div>
      </mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
export default class SplitPaneNestedExampleComponent {}

import { Component, ErrorHandler, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvButton } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvTextarea } from '@malva-ui/core/textarea';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvCombobox } from '@malva-ui/core/combobox';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvCalendar } from '@malva-ui/core/calendar';
import { MlvDayPicker } from '@malva-ui/core/day-picker';
import { MlvTimePicker } from '@malva-ui/core/time-picker';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';
import { MlvTree } from '@malva-ui/core/tree';
import { MlvSlider } from '@malva-ui/core/slider';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

/**
 * Server-rendering smoke test for the components most likely to reach for a
 * browser global.
 *
 * `@malva-ui/core` is published for applications that may render on the
 * server, and `@angular/platform-server` is a workspace dependency, but until
 * now only `@malva-ui/editor` asserted anything about SSR. The failure mode is
 * silent at build time and fatal at runtime: a component that measures,
 * observes, or listens during construction throws on the server and takes the
 * whole page down with it.
 *
 * These components were chosen because each one owns a measurement, observer,
 * or document-level listener in the browser — the paths that have to stay
 * behind an `afterNextRender` / `isPlatformBrowser` guard.
 */
@Component({
  selector: 'mlv-ssr-host',
  imports: [
    MlvButton,
    MlvInput,
    MlvTextarea,
    MlvSelect,
    MlvCombobox,
    MlvTabGroup,
    MlvTab,
    MlvTabDef,
    MlvTabContentDef,
    MlvCalendar,
    MlvDayPicker,
    MlvTimePicker,
    MlvSplitPane,
    MlvSplitPanePanel,
    MlvTree,
    MlvSlider,
    MlvScrollbar,
    MlvAccordion,
    MlvAccordionItem,
    MlvSegmented,
    MlvSegmentedItem,
  ],
  template: `
    <button mlvButton>Save</button>
    <mlv-input label="Name" />
    <mlv-textarea label="Bio" autoResize [minRows]="2" [maxRows]="6" />
    <mlv-select label="Fruit" [options]="fruits()" />
    <mlv-combobox label="Fruit" [options]="fruits()" />

    <mlv-tab-group>
      <mlv-tab value="one">
        <ng-template mlvTabDef>One</ng-template>
        <ng-template mlvTabContent>First panel</ng-template>
      </mlv-tab>
      <mlv-tab value="two">
        <ng-template mlvTabDef>Two</ng-template>
        <ng-template mlvTabContent>Second panel</ng-template>
      </mlv-tab>
    </mlv-tab-group>

    <mlv-accordion>
      <mlv-accordion-item>Body</mlv-accordion-item>
    </mlv-accordion>

    <mlv-segmented>
      <button mlvSegmentedItem value="day">Day</button>
      <button mlvSegmentedItem value="week">Week</button>
    </mlv-segmented>

    <mlv-calendar />
    <mlv-day-picker label="Date" />
    <mlv-time-picker label="Time" />
    <mlv-slider [min]="0" [max]="10" />
    <mlv-tree [nodes]="treeNodes()" />
    <mlv-scrollbar><p>Scrollable</p></mlv-scrollbar>

    <mlv-split-pane style="height: 200px">
      <mlv-split-pane-panel [size]="30">Left</mlv-split-pane-panel>
      <mlv-split-pane-panel>Right</mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
class SsrHost {
  readonly fruits = signal(['Apple', 'Banana']);
  readonly treeNodes = signal([{ id: '1', label: 'Root' }]);
}

const render = (): Promise<string> =>
  renderApplication(
    (context) =>
      bootstrapApplication(
        SsrHost,
        { providers: [provideMlvI18nTesting()] },
        context,
      ),
    { document: '<mlv-ssr-host></mlv-ssr-host>', url: '/' },
  );

/**
 * Renders the same host, collecting everything that reaches the `ErrorHandler`
 * instead of letting Angular swallow it.
 *
 * Markup alone does not prove SSR safety. Angular routes an exception thrown
 * inside an `effect` to the `ErrorHandler` and carries on rendering, so a
 * component that reaches for a browser global during server rendering still
 * produces perfectly good markup while logging an error on every request.
 */
const renderCollectingErrors = async (): Promise<unknown[]> => {
  const errors: unknown[] = [];
  await renderApplication(
    (context) =>
      bootstrapApplication(
        SsrHost,
        {
          providers: [
            provideMlvI18nTesting(),
            {
              provide: ErrorHandler,
              useValue: {
                handleError: (error: unknown) => errors.push(error),
              },
            },
          ],
        },
        context,
      ),
    { document: '<mlv-ssr-host></mlv-ssr-host>', url: '/' },
  );
  return errors;
};

describe('@malva-ui/core SSR safety', () => {
  it('server-renders the measurement- and observer-heavy components', async () => {
    const html = await render();

    // Each assertion is one component proving it produced server markup rather
    // than throwing during construction.
    for (const selector of [
      'mlv-input',
      'mlv-textarea',
      'mlv-select',
      'mlv-combobox',
      'mlv-tab-group',
      'mlv-accordion',
      'mlv-segmented',
      'mlv-calendar',
      'mlv-day-picker',
      'mlv-time-picker',
      'mlv-slider',
      'mlv-tree',
      'mlv-scrollbar',
      'mlv-split-pane',
    ]) {
      expect(html, `${selector} did not server-render`).toContain(
        `<${selector}`,
      );
    }
  });

  it('server-renders without any component reaching a browser global', async () => {
    const errors = await renderCollectingErrors();

    // `mlv-textarea[autoResize]` measured itself from a `value` effect, which
    // Angular runs during server-side change detection too. It called
    // `getComputedStyle` there and threw on every render — silently, because
    // the markup still came out intact.
    expect(
      errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual([]);
  });

  it('renders no overlay markup on the server', async () => {
    const html = await render();

    // Overlays attach to the document body from a browser-only code path. Any
    // of these in the server payload means an overlay was created during SSR.
    expect(html).not.toContain('cdk-overlay-container');
    expect(html).not.toContain('cdk-overlay-backdrop');
  });
});

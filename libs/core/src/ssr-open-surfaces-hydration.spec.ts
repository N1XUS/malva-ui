import {
  type ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
} from '@angular/core';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import {
  provideServerRendering,
  renderApplication,
} from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvAnimatedPresence } from '@malva-ui/cdk/utils';
import { MlvDrawer, MlvDrawerContent } from '@malva-ui/core/drawer';
import { MlvSearchField } from '@malva-ui/core/search-field';

/**
 * #337, the client half. `ssr-smoke.spec.ts` checks the server payload of
 * surfaces that start **open**; this drives the real round trip —
 * `renderApplication` with `provideClientHydration()`, then
 * `bootstrapApplication` over that markup in jsdom — because the defect lived
 * between the two halves. Before #337 the server built the drawer's and the
 * search overlay's CDK overlays into the payload (a view `effect()` runs during
 * server change detection) and `*mlvAnimatedPresence` scheduled a frame
 * against a server element, so the client hit
 * `NG0500: During hydration Angular expected <mlv-search-field> but found <p>`
 * and an uncaught `getComputedStyle` `TypeError`. Now the server renders both
 * hosts closed, and the claimed hosts must still open on the client.
 */

@Component({
  selector: 'mlv-ssr-open-surfaces-hydration-host',
  imports: [MlvDrawer, MlvDrawerContent, MlvSearchField, MlvAnimatedPresence],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer id="open-drawer" ariaLabel="Open filters" [opened]="true">
      <ng-template mlvDrawerContent>
        <p id="open-drawer-content">Open drawer content</p>
      </ng-template>
    </mlv-drawer>
    <mlv-search-field
      id="open-search"
      overlay
      ariaLabel="Search everything"
      [opened]="true"
    />
    <p *mlvAnimatedPresence="true" id="presence">Shown</p>
  `,
})
class OpenSurfacesHydrationHost {}

const HOST_SELECTOR = 'mlv-ssr-open-surfaces-hydration-host';

/**
 * `renderApplication` installs domino's DOM classes on `globalThis`, after
 * which jsdom rejects its own nodes. `setup-restore-dom-globals.js` puts them
 * back around every test, but these render and hydrate inside one test, so
 * they put them back between the halves from the same snapshot
 * (`tooltip-ssr.spec.ts` does the same).
 */
const restoreJsdomGlobals = (): void => {
  const pristine = (globalThis as Record<symbol, unknown>)[
    Symbol.for('mlv.pristineDomGlobals')
  ] as Map<string, unknown> | undefined;
  if (!pristine) {
    throw new Error(
      'setup-restore-dom-globals.js did not record the pristine jsdom classes',
    );
  }
  for (const [name, value] of pristine) {
    (globalThis as Record<string, unknown>)[name] = value;
  }
};

const collectingErrorHandler = (problems: string[]) => ({
  provide: ErrorHandler,
  useValue: {
    handleError: (error: unknown) =>
      problems.push(error instanceof Error ? error.message : String(error)),
  },
});

const renderOnServer = async (): Promise<{
  html: string;
  problems: string[];
}> => {
  const problems: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) =>
    problems.push(args.map(String).join(' '));
  try {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          OpenSurfacesHydrationHost,
          {
            providers: [
              provideServerRendering(),
              provideClientHydration(),
              provideMlvI18nTesting(),
              collectingErrorHandler(problems),
            ],
          },
          context,
        ),
      {
        document: `<html><head></head><body><${HOST_SELECTOR}></${HOST_SELECTOR}></body></html>`,
        url: '/',
      },
    );
    return { html, problems };
  } finally {
    console.error = consoleError;
    restoreJsdomGlobals();
  }
};

interface HydratedClient {
  readonly appRef: ApplicationRef;
  readonly problems: string[];
  /** The drawer host as parsed from the server markup, before any app code ran. */
  readonly serverDrawer: Element | null;
  /** The search-field host as parsed from the server markup. */
  readonly serverSearch: Element | null;
}

const hydrateOnClient = async (serverHtml: string): Promise<HydratedClient> => {
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/.exec(serverHtml)?.[1] ?? '';
  const serverDrawer = document.getElementById('open-drawer');
  const serverSearch = document.getElementById('open-search');
  const problems: string[] = [];
  const consoleError = console.error;
  const consoleWarn = console.warn;
  const consoleLog = console.log;
  console.error = (...args: unknown[]) =>
    problems.push(args.map(String).join(' '));
  console.warn = (...args: unknown[]) =>
    problems.push(args.map(String).join(' '));
  // Dev-mode hydration prints its stats through `console.log`; not a problem.
  console.log = () => undefined;
  try {
    const appRef = await bootstrapApplication(OpenSurfacesHydrationHost, {
      providers: [
        provideClientHydration(),
        provideMlvI18nTesting(),
        collectingErrorHandler(problems),
      ],
    });
    await appRef.whenStable();
    return { appRef, problems, serverDrawer, serverSearch };
  } finally {
    console.error = consoleError;
    console.warn = consoleWarn;
    console.log = consoleLog;
  }
};

describe('Open overlay surfaces across hydration (#337)', () => {
  let client: HydratedClient | undefined;

  afterEach(() => {
    client?.appRef.destroy();
    client = undefined;
    document.body.innerHTML = '';
  });

  it('server-renders the open hosts closed, with no overlay in the payload', async () => {
    const { html, problems } = await renderOnServer();
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(problems).toEqual([]);
    expect(parsed.getElementById('open-drawer')).not.toBeNull();
    expect(parsed.getElementById('open-search')).not.toBeNull();
    expect(parsed.getElementById('presence')?.className ?? null).toBe('');
    expect(html).not.toContain('cdk-overlay-container');
    expect(html).not.toContain('Open drawer content');
  });

  it('claims the server hosts and opens both overlays on the client', async () => {
    const { html } = await renderOnServer();
    client = await hydrateOnClient(html);

    expect(client.problems).toEqual([]);
    // The client claimed the server's nodes rather than rendering new ones.
    expect(document.getElementById('open-drawer') === client.serverDrawer).toBe(
      true,
    );
    expect(document.getElementById('open-search') === client.serverSearch).toBe(
      true,
    );

    const container = document.querySelector('.cdk-overlay-container');
    // The drawer's template now lives in a client-built overlay pane.
    expect(
      container?.querySelector('#open-drawer-content')?.textContent?.trim() ??
        null,
    ).toBe('Open drawer content');
    // The search field's overlay is open too.
    expect(
      container?.querySelectorAll('.mlv-search-field__overlay').length ?? 0,
    ).toBe(1);
    expect(
      document
        .getElementById('open-search')
        ?.querySelector('[aria-expanded]')
        ?.getAttribute('aria-expanded') ?? null,
    ).toBe('true');
    expect(container?.querySelectorAll('.cdk-overlay-pane').length ?? 0).toBe(
      2,
    );
  });
});

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
import { MlvTooltip } from './tooltip';

/**
 * #321. The tooltip describes its host from init (D12), through CDK's
 * `AriaDescriber`, whose message element lives in a container on `<body>` and
 * whose ids carry a per-process counter. Registering on the server would ship
 * an id the client never renders: the client claims the host with the server's
 * `aria-describedby` intact, removes the server's container on its first
 * `describe()`, and appends its own id — leaving the server's dangling
 * (`aria-valid-attr-value`). Measured with a plain `effect()` in its place: a
 * host with no `aria-describedby` of its own hydrated as
 * `cdk-describedby-message-ng-1-3 cdk-describedby-message-ng-5-7`, the first
 * naming nothing. A host with a **static** `aria-describedby` hid it, because
 * hydration re-applies the static attribute and wipes the server's id — which
 * is why `#bare` is here. So the server writes nothing and the hydrating
 * client registers the description. These specs drive the real round trip
 * (`renderApplication` with `provideClientHydration()`, then
 * `bootstrapApplication` over that markup in jsdom), because the defect would
 * live exactly between the two halves.
 */

@Component({
  selector: 'mlv-tooltip-ssr-host',
  imports: [MlvTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span id="rules">At least 12 characters</span>
    <button
      id="described"
      aria-describedby="rules"
      mlvTooltip="Use a passphrase"
    >
      Password
    </button>
    <button id="bare" mlvTooltip="Bare hint">Bare</button>
    <button id="empty" [mlvTooltip]="''">Empty</button>
  `,
})
class TooltipSsrHost {}

/**
 * `renderApplication` installs domino's DOM classes on `globalThis`, after
 * which jsdom rejects its own nodes. `setup-restore-dom-globals.js` puts them
 * back around every test, but these render and hydrate inside one test, so
 * they put them back between the halves from the same snapshot
 * (`button-ssr.spec.ts` does the same).
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
    handleError: (error: unknown) => problems.push(String(error)),
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
          TooltipSsrHost,
          {
            providers: [
              provideServerRendering(),
              provideClientHydration(),
              collectingErrorHandler(problems),
            ],
          },
          context,
        ),
      {
        document:
          '<html><head></head><body><mlv-tooltip-ssr-host></mlv-tooltip-ssr-host></body></html>',
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
  /** The described host as parsed from the server markup, before any app code ran. */
  readonly serverHost: Element | null;
}

const hydrateOnClient = async (serverHtml: string): Promise<HydratedClient> => {
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/.exec(serverHtml)?.[1] ?? '';
  const serverHost = document.getElementById('described');
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
    const appRef = await bootstrapApplication(TooltipSsrHost, {
      providers: [provideClientHydration(), collectingErrorHandler(problems)],
    });
    await appRef.whenStable();
    return { appRef, problems, serverHost };
  } finally {
    console.error = consoleError;
    console.warn = consoleWarn;
    console.log = consoleLog;
  }
};

/** Each `aria-describedby` id of an element, resolved to its text or `<missing id>`. */
const describedBy = (root: Document, id: string): string[] =>
  (root.getElementById(id)?.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (ref) =>
        root.getElementById(ref)?.textContent?.trim() ?? `<missing ${ref}>`,
    );

describe('MlvTooltip description across hydration', () => {
  let client: HydratedClient | undefined;

  afterEach(() => {
    client?.appRef.destroy();
    client = undefined;
    document.body.innerHTML = '';
  });

  it('server-renders only the host’s own aria-describedby, and no description container', async () => {
    const { html, problems } = await renderOnServer();
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(problems).toEqual([]);
    expect(
      parsed.getElementById('described')?.getAttribute('aria-describedby'),
    ).toBe('rules');
    expect(
      parsed.getElementById('bare')?.hasAttribute('aria-describedby'),
    ).toBe(false);
    expect(
      parsed.getElementById('empty')?.hasAttribute('aria-describedby'),
    ).toBe(false);
    expect(html).not.toContain('cdk-describedby');
  });

  it('describes the claimed host once hydrated, every id resolving', async () => {
    const { html } = await renderOnServer();
    client = await hydrateOnClient(html);

    expect(client.problems).toEqual([]);
    // The client claimed the server's node rather than rendering a new one.
    expect(document.getElementById('described') === client.serverHost).toBe(
      true,
    );
    expect(describedBy(document, 'described')).toEqual([
      'At least 12 characters',
      'Use a passphrase',
    ]);
    expect(describedBy(document, 'bare')).toEqual(['Bare hint']);
    expect(
      document.getElementById('empty')?.hasAttribute('aria-describedby'),
    ).toBe(false);
  });
});

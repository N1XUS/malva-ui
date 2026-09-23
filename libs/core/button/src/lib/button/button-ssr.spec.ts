import {
  type ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import {
  provideServerRendering,
  renderApplication,
} from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvButton } from './button';

/**
 * #460 review F1. A disabled `a[mlvButton]` leaves the tab order through a
 * `tabindex="-1"` the component writes itself, and the server writes it too.
 * When the server renders an anchor disabled and the hydrating client does not
 * — `[disabled]="!isBrowser"`, a login state only the browser knows — the
 * client claims the server's node, `tabindex="-1"` included, and nothing but
 * the component knows the attribute is its own. These specs drive a real round
 * trip (`renderApplication` with `provideClientHydration()`, then
 * `bootstrapApplication` over that markup in jsdom), because the defect lives
 * exactly between the two halves and a `TestBed` fixture has no server half to
 * disagree with.
 *
 * `loading` alone writes no `-1` since #324 — a loading anchor keeps its tab
 * stop — but it still writes the `aria-disabled="true"` the client reads as
 * the server's mark, which the `loading-bound` and `loading-both-bound`
 * residuals below pin.
 */

@Component({
  selector: 'button-ssr-host',
  imports: [MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a id="disabled" mlvButton href="/a" [disabled]="serverOnly">A</a>
    <a id="loading" mlvButton href="/b" [loading]="serverOnly">B</a>
    <a id="authored" mlvButton href="/c" tabindex="0" [disabled]="serverOnly"
      >C</a
    >
    <a id="both" mlvButton href="/d" [disabled]="inertOnBothSides()">D</a>
    <a id="bound" mlvButton href="/e" [attr.tabindex]="-1">E</a>
    <a
      id="static-aria"
      mlvButton
      href="/f"
      aria-disabled="true"
      [attr.tabindex]="-1"
      >F</a
    >
    <a
      id="static-aria-server"
      mlvButton
      href="/g"
      aria-disabled="true"
      [disabled]="serverOnly"
      >G</a
    >
    <a
      id="disabled-loading"
      mlvButton
      href="/h"
      [disabled]="serverOnly"
      [loading]="serverOnly"
      >H</a
    >
    <a
      id="loading-bound"
      mlvButton
      href="/i"
      [attr.tabindex]="-1"
      [loading]="serverOnly"
      >I</a
    >
    <a id="loading-both" mlvButton href="/j" [loading]="loadingOnBothSides()"
      >J</a
    >
    <a
      id="loading-both-bound"
      mlvButton
      href="/k"
      [attr.tabindex]="-1"
      [loading]="loadingOnBothSides()"
      >K</a
    >
  `,
})
class ButtonSsrHost {
  /** Inert on the server only — the divergence hydration has to reconcile. */
  readonly serverOnly = isPlatformServer(inject(PLATFORM_ID));

  /** Inert on the server and on the client's first render. */
  readonly inertOnBothSides = signal(true);

  /** Loading on the server and on the client's first render. */
  readonly loadingOnBothSides = signal(true);
}

/**
 * `renderApplication` installs domino's DOM classes on `globalThis`, after
 * which jsdom rejects its own nodes. `setup-restore-dom-globals.js` puts them
 * back around every test, but these render and hydrate inside one test, so
 * they put them back between the halves from the same snapshot
 * (`select-ssr.spec.ts` does the same).
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
          ButtonSsrHost,
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
        document:
          '<html><head></head><body><button-ssr-host></button-ssr-host></body></html>',
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
  readonly host: ButtonSsrHost;
  readonly problems: string[];
  /** The anchors as parsed from the server markup, before any app code ran. */
  readonly serverNodes: ReadonlyMap<string, Element | null>;
}

const ANCHOR_IDS = [
  'disabled',
  'loading',
  'authored',
  'both',
  'bound',
  'static-aria',
  'static-aria-server',
  'disabled-loading',
  'loading-bound',
  'loading-both',
  'loading-both-bound',
];

const hydrateOnClient = async (serverHtml: string): Promise<HydratedClient> => {
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/.exec(serverHtml)?.[1] ?? '';
  const serverNodes = new Map(
    ANCHOR_IDS.map((id) => [id, document.getElementById(id)] as const),
  );
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
    const appRef = await bootstrapApplication(ButtonSsrHost, {
      providers: [
        provideClientHydration(),
        provideMlvI18nTesting(),
        collectingErrorHandler(problems),
      ],
    });
    await appRef.whenStable();
    return {
      appRef,
      host: appRef.components[0].instance as ButtonSsrHost,
      problems,
      serverNodes,
    };
  } finally {
    console.error = consoleError;
    console.warn = consoleWarn;
    console.log = consoleLog;
  }
};

/** `tabindex` and `aria-disabled` of each anchor, one comparable string per anchor. */
const snapshot = (root: ParentNode): string[] =>
  ANCHOR_IDS.map((id) => {
    const anchor = root.querySelector(`#${id}`);
    return `${id}: tabindex=${anchor?.getAttribute('tabindex')} aria-disabled=${anchor?.getAttribute('aria-disabled')}`;
  });

describe('MlvButton anchor tabindex across hydration', () => {
  let client: HydratedClient | undefined;

  afterEach(() => {
    client?.appRef.destroy();
    client = undefined;
    document.body.innerHTML = '';
  });

  it('server-renders every disabled anchor out of the tab order and a loading one in it', async () => {
    const { html, problems } = await renderOnServer();
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(problems).toEqual([]);
    expect(snapshot(parsed)).toEqual([
      'disabled: tabindex=-1 aria-disabled=true',
      // #324: loading alone is announced, not taken out of the tab order.
      'loading: tabindex=null aria-disabled=true',
      'authored: tabindex=-1 aria-disabled=true',
      'both: tabindex=-1 aria-disabled=true',
      'bound: tabindex=-1 aria-disabled=null',
      // The host binding removes a static `aria-disabled` while not inert.
      'static-aria: tabindex=-1 aria-disabled=null',
      'static-aria-server: tabindex=-1 aria-disabled=true',
      'disabled-loading: tabindex=-1 aria-disabled=true',
      // The `-1` is the consumer's binding; the component wrote none.
      'loading-bound: tabindex=-1 aria-disabled=true',
      'loading-both: tabindex=null aria-disabled=true',
      // The consumer's binding again.
      'loading-both-bound: tabindex=-1 aria-disabled=true',
    ]);
  });

  it('takes back the tabindex the server wrote when the client is not inert — the anchor returns to the tab order', async () => {
    const { html } = await renderOnServer();
    client = await hydrateOnClient(html);

    expect(client.problems).toEqual([]);
    // The client claimed the server's nodes rather than rendering new ones.
    for (const id of ANCHOR_IDS) {
      expect(document.getElementById(id) === client.serverNodes.get(id)).toBe(
        true,
      );
    }
    expect(snapshot(document)).toEqual([
      'disabled: tabindex=null aria-disabled=null',
      'loading: tabindex=null aria-disabled=null',
      'authored: tabindex=0 aria-disabled=null',
      'both: tabindex=-1 aria-disabled=true',
      // Never inert on either side: the `-1` is the consumer's own binding.
      'bound: tabindex=-1 aria-disabled=null',
      // Never inert either. Hydration re-applies the static
      // `aria-disabled="true"` to the claimed node before the component is
      // constructed, so what the component reads is not the server's markup
      // (where the host binding had removed it): a static attribute must not
      // pass for the server's own "rendered inert" mark.
      'static-aria: tabindex=-1 aria-disabled=null',
      // DOCUMENTED RESIDUAL, pinned so it cannot change unnoticed: inert on the
      // server only, but with the same static `aria-disabled`, so the claimed
      // node is indistinguishable from `static-aria` above (`aria-disabled`
      // re-applied, `-1`, no static `tabindex`) and the client leaves the
      // server's `-1` on an enabled link. The right answer is
      // `tabindex=null`; this line goes red on purpose once the seed can tell
      // a bound `-1` from the server's (migration § 2, "not taken back").
      'static-aria-server: tabindex=-1 aria-disabled=null',
      // Disabled and loading on the server: the `-1` is the component's and is
      // taken back like `disabled` above.
      'disabled-loading: tabindex=null aria-disabled=null',
      // DOCUMENTED RESIDUAL (#324), pinned so it cannot change unnoticed:
      // loading on the server only, beside a consumer-bound `-1`. `loading`
      // writes `aria-disabled="true"` and no `-1`, so the claimed node carries
      // the same mark as `disabled-loading` above and the client takes the
      // consumer's `-1` away. The right answer is `tabindex=-1`; the two
      // nodes differ in nothing hydration leaves on them, and leaving a server
      // `-1` on an enabled link Tab never reaches is the worse error.
      // Unchanged by #324: the server wrote `-1` for loading too, and the
      // client removed it the same way on its first render that was neither
      // disabled nor loading (#460's bound-`tabindex` residual).
      'loading-bound: tabindex=null aria-disabled=null',
      // Loading on both sides: announced, and in the tab order after
      // hydration as before it — the component never wrote a `-1`.
      'loading-both: tabindex=null aria-disabled=true',
      // DOCUMENTED RESIDUAL, and new with #324, pinned so it cannot change
      // unnoticed: loading on both sides, beside a consumer-bound `-1`. The
      // same mark as `loading-bound`, taken back the same way, although the
      // client is still loading. Before #324 the client wrote its own `-1`
      // while loading, which coincided with the consumer's, and the
      // consumer's went only when loading ended (the restore is to the
      // template's `tabindex`, and a binding leaves none) — measured by probe
      // on the pre-#324 source. Now it goes at hydration. The right answer is
      // `tabindex=-1`. Keeping a marked `-1` while the client is loading would
      // restore the old timing, but would also keep a disabled + loading
      // server render's `-1` on an anchor the client renders loading only —
      // the defect #324 fixes. Migration 2026-09-button-loading-keeps-focus
      // § 2.
      'loading-both-bound: tabindex=null aria-disabled=true',
    ]);
  });

  it('returns an anchor inert on both sides to its template tabindex, not the server -1, once it is re-enabled', async () => {
    const { html } = await renderOnServer();
    client = await hydrateOnClient(html);

    client.host.inertOnBothSides.set(false);
    await client.appRef.whenStable();

    const both = document.getElementById('both') as HTMLAnchorElement;
    expect(both.hasAttribute('tabindex')).toBe(false);
    expect(both.hasAttribute('aria-disabled')).toBe(false);
  });
});

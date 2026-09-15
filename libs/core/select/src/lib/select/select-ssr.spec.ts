import {
  afterEveryRender,
  afterNextRender,
  type AfterViewInit,
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  Component,
  Directive,
  ElementRef,
  ErrorHandler,
  HostAttributeToken,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  PLATFORM_ID,
  type Provider,
  signal,
  type Type,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import {
  CdkTrapFocus,
  FocusTrapFactory,
  InteractivityChecker,
} from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import {
  provideServerRendering,
  renderApplication,
} from '@angular/platform-server';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import type { MlvOptionsSearchFn } from '@malva-ui/core/dropdown';
import { MlvDialogService } from '@malva-ui/core/dialog';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { MlvSelect, type MlvSelectNativeMode } from './select';

/**
 * #218. `native="auto"` picks between two different DOM trees — the custom
 * `div[role="combobox"]` trigger and a real `<select>` — from the viewport, and
 * the label association follows the same decision (`<label for>` for the native
 * control, `aria-labelledby` on the trigger). A server has no viewport, so the
 * server and a hydrating client could resolve opposite branches for the same
 * markup.
 *
 * The owner's ruling: the server renders the native `<select>` under
 * `native="auto"` — what the breakpoint service answers with no viewport — and
 * a client **hydrating** that markup renders it too for its first render, then
 * follows the viewport inside the same tick. Only hydration is gated: a select
 * that is not being hydrated (a client-only app, a dialog, an `@if` after
 * hydration, an `ngSkipHydration` subtree) behaves exactly as before #218.
 * Explicit `native="true"` / `native="false"` are never viewport-driven.
 *
 * The first block drives a real hydration round trip — `renderApplication`
 * with `provideClientHydration()`, then `bootstrapApplication` over that markup
 * in jsdom — because the defect lives exactly between the two, and a `TestBed`
 * fixture has no server half to disagree with.
 */

/** The `native` input value a host renders with, supplied per bootstrap. */
const NATIVE_MODE = new InjectionToken<MlvSelectNativeMode>('NATIVE_MODE');

/** Optional `searchFn` a host binds, supplied per bootstrap. */
const SEARCH_FN = new InjectionToken<MlvOptionsSearchFn<string>>('SEARCH_FN');

/** Optional initial `value` a host starts from (default `'Staging'`), supplied per bootstrap. */
const INITIAL_VALUE = new InjectionToken<{ readonly value: string | null }>(
  'INITIAL_VALUE',
);

/** Optional client-side hook a host runs from `ngAfterViewInit`. */
const AFTER_VIEW_INIT = new InjectionToken<(host: SelectSsrHost) => void>(
  'AFTER_VIEW_INIT',
);

/**
 * Optional client-side hook a host runs after every render. The host registers
 * it in its constructor — before the select it contains registers anything — so
 * within a pass it runs ahead of every after-render hook the select adds.
 */
const AFTER_EVERY_RENDER = new InjectionToken<() => void>('AFTER_EVERY_RENDER');

/** Stands in for the viewport on one half of a round trip. */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean>;
  constructor(down: boolean) {
    this.down = signal(down);
  }
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(!this.down());
  }
}

/**
 * Which breakpoint service a half renders with: `'real'` is the production
 * `MlvBreakpointService` (on the server, CDK's `MediaMatcher` sees no browser
 * platform and matches nothing); `'phone'` / `'desktop'` are fakes.
 */
type Viewport = 'real' | 'phone' | 'desktop';

const breakpointProviders = (viewport: Viewport) =>
  viewport === 'real'
    ? []
    : [
        {
          provide: MlvBreakpointService,
          useValue: new FakeBreakpointService(viewport === 'phone'),
        },
      ];

/** Serialised `<mlv-select>` subtree captured at the first client render. */
let firstClientRender: string | null = null;

/** `isDown('md')()` as the host's breakpoint service answered it on the server. */
let serverBreakpointDownMd: boolean | null = null;

@Component({
  selector: 'mlv-select-ssr-host',
  imports: [MlvFormField, MlvLabel, MlvSelect],
  template: `<mlv-form-field
    ><mlv-label>Region</mlv-label
    ><mlv-select
      [id]="'region'"
      [native]="native()"
      [options]="options"
      [searchFn]="searchFn"
      [(value)]="value"
      (touch)="touches = touches + 1"
  /></mlv-form-field>`,
})
class SelectSsrHost implements AfterViewInit {
  // `[id]` is bound rather than written as a static `id="region"`: a static
  // attribute feeds the `id` input *and* stays on the `<mlv-select>` host, so
  // the id would exist twice and `select.labels` would resolve to nothing.
  readonly native = signal(inject(NATIVE_MODE));
  /** The half's breakpoint service — a `FakeBreakpointService` on the client. */
  readonly breakpoint = inject(MlvBreakpointService);
  /** For after-render hooks a scenario registers outside an injection context. */
  readonly injector = inject(Injector);
  readonly searchFn = inject(SEARCH_FN, { optional: true });
  // Plain values, not `{ label, value }` descriptors: the trigger labels a
  // committed value by passing *the value* through `toOption`, so a descriptor
  // option's trigger would read the raw `value` rather than its `label`.
  readonly options = ['Production', 'Staging'];
  // Not the first option: a native select with nothing selected falls back to
  // its first entry, which would hide a lost selection. A supplied `null` is
  // kept — hence no `??`.
  private readonly _initialValue = inject(INITIAL_VALUE, { optional: true });
  readonly value = signal<string | null>(
    this._initialValue ? this._initialValue.value : 'Staging',
  );
  readonly select = viewChild.required(MlvSelect);
  touches = 0;
  private readonly _afterViewInit = inject(AFTER_VIEW_INIT, { optional: true });

  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) {
      serverBreakpointDownMd = this.breakpoint.isDown('md')();
    }
    const everyRender = inject(AFTER_EVERY_RENDER, { optional: true });
    if (everyRender) afterEveryRender(everyRender);
    // `earlyRead` runs before every `mixedReadWrite` hook of the same render,
    // whichever component registered it — so this reads the DOM the first
    // client render produced, before any after-render work (the select's own
    // switch included) can change it. On the server it never runs.
    afterNextRender({
      earlyRead: () => {
        firstClientRender =
          document.querySelector('mlv-select-ssr-host mlv-select')?.outerHTML ??
          null;
      },
    });
  }

  ngAfterViewInit(): void {
    this._afterViewInit?.(this);
  }
}

/** What one `mlv-select` looked like to a hydrating client, keyed by `mlvSsrProbe`. */
interface ProbeRecord {
  /** The host carried `ngh` when its directives were constructed. */
  readonly nghAtConstruction: boolean;
  /** The host is the very node the server rendered, claimed by hydration. */
  readonly reusedServerNode: boolean;
  /** Its first render contained a native `<select>` (read at `earlyRead`). */
  firstRenderNative: boolean | null;
}

const probeRecords = new Map<string, ProbeRecord>();

/** Every `mlv-select` node that came from the server markup. */
let serverSelectHosts = new Set<Element>();

/**
 * Records, on a hydrating client, what the select beside it saw. A directive
 * on the same element is constructed right after the component and before
 * Angular renders the component's view — where `renderComponent` strips `ngh`
 * — so it observes the host exactly as `MlvSelect`'s field initializers do.
 */
@Directive({ selector: '[mlvSsrProbe]' })
class SsrProbe {
  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) return;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const record: ProbeRecord = {
      nghAtConstruction: host.hasAttribute('ngh'),
      reusedServerNode: serverSelectHosts.has(host),
      firstRenderNative: null,
    };
    probeRecords.set(inject(new HostAttributeToken('mlvSsrProbe')), record);
    afterNextRender({
      earlyRead: () => {
        record.firstRenderNative = !!host.querySelector('select');
      },
    });
  }
}

@Component({
  selector: 'mlv-select-ssr-skip-wrap',
  imports: [MlvSelect, SsrProbe],
  template: `<mlv-select
    mlvSsrProbe="skip-hydration-ancestor"
    label="Skipped"
    native="auto"
    [options]="options"
  />`,
})
class SkipHydrationWrap {
  readonly options = ['Production', 'Staging'];
}

/**
 * One select per way a host can come to exist under a hydrating app.
 *
 * `@defer (hydrate on timer(…))` is measured once, not pinned: its host carried
 * `ngh`, claimed the server's node and rendered the native branch first, with
 * `dehydratedViewsRemoved` 0 — the same as `hydrate when`. Pinning it needs a
 * real wait for the timer, which these specs avoid.
 */
@Component({
  selector: 'mlv-select-ssr-scopes-host',
  imports: [MlvSelect, SsrProbe, SkipHydrationWrap],
  template: `<mlv-select
      mlvSsrProbe="hydrated"
      label="Hydrated"
      native="auto"
      [options]="options"
    />
    @for (row of rows; track row) {
      <mlv-select
        mlvSsrProbe="for-row"
        [label]="row"
        native="auto"
        [options]="options"
      />
    }
    <mlv-select-ssr-skip-wrap ngSkipHydration />
    @defer (hydrate on immediate) {
      <div>
        <mlv-select
          mlvSsrProbe="hydrate-on-immediate"
          label="Deferred"
          native="auto"
          [options]="options"
        />
      </div>
    }
    @defer (hydrate when late()) {
      <div>
        <mlv-select
          mlvSsrProbe="hydrate-when"
          label="Deferred until"
          native="auto"
          [options]="options"
        />
      </div>
    }
    @if (late()) {
      <mlv-select
        mlvSsrProbe="if-after-hydration"
        label="Late"
        native="auto"
        [options]="options"
      />
    }`,
})
class SelectScopesHost {
  readonly options = ['Production', 'Staging'];
  readonly rows = ['Repeated'];
  /** Turns on the `@if` after hydration and triggers the `hydrate when` block. */
  readonly late = signal(false);
}

/** The shape the focus hosts below share with `SelectSsrHost`. */
interface FocusHost {
  touches: number;
  readonly select: () => MlvSelect<string>;
}

/** Whether `SsrLateFocus` found the claimed `<select>` and focused it. */
let lateFocusLandedOnSelect = false;

/**
 * Focuses the select beside it from its own after-render hook. Constructed
 * after the select, so its hook runs after the select's in the same pass —
 * the ordering a hydrating select's focus hand-off must not depend on.
 */
@Directive({ selector: '[mlvSsrLateFocus]' })
class SsrLateFocus {
  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) return;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const select = host.parentElement?.querySelector('select') ?? null;
      select?.focus();
      lateFocusLandedOnSelect = !!select && document.activeElement === select;
    });
  }
}

@Component({
  selector: 'mlv-select-ssr-late-focus-host',
  imports: [MlvFormField, MlvLabel, MlvSelect, SsrLateFocus],
  template: `<mlv-form-field
      ><mlv-label>Region</mlv-label
      ><mlv-select
        [id]="'region'"
        native="auto"
        [options]="options"
        (touch)="touches = touches + 1"
    /></mlv-form-field>
    <span mlvSsrLateFocus></span>`,
})
class LateFocusHost implements FocusHost {
  readonly options = ['Production', 'Staging'];
  readonly select = viewChild.required(MlvSelect);
  touches = 0;

  constructor() {
    // Registered before the select's own hooks, so in the pass that removes
    // the <select> it runs ahead of the select's hand-off.
    const everyRender = inject(AFTER_EVERY_RENDER, { optional: true });
    if (everyRender) afterEveryRender(everyRender);
  }
}

/**
 * jsdom has no layout, so CDK's `InteractivityChecker` finds nothing visible —
 * and so nothing tabbable — for a focus trap to capture.
 */
@Injectable()
class LayoutlessInteractivityChecker extends InteractivityChecker {
  override isVisible(): boolean {
    return true;
  }
}

@Component({
  selector: 'mlv-select-ssr-focus-trap-host',
  imports: [MlvFormField, MlvLabel, MlvSelect, CdkTrapFocus],
  // `FocusTrapFactory` is root-provided, so it is provided here too: that is
  // what makes the trap it creates resolve the checker above.
  providers: [
    { provide: InteractivityChecker, useClass: LayoutlessInteractivityChecker },
    FocusTrapFactory,
  ],
  template: `<div cdkTrapFocus cdkTrapFocusAutoCapture>
    <mlv-form-field
      ><mlv-label>Region</mlv-label
      ><mlv-select
        [id]="'region'"
        native="auto"
        [options]="options"
        (touch)="touches = touches + 1"
    /></mlv-form-field>
  </div>`,
})
class FocusTrapHost implements FocusHost {
  readonly options = ['Production', 'Staging'];
  readonly select = viewChild.required(MlvSelect);
  touches = 0;
}

/** What happens to the focus of `TwoSelectHost` during its first client render. */
interface TwoSelectScenario {
  /**
   * Ids of the claimed `<select>`s one after-render hook focuses, in order.
   * The hook is registered after both selects', so it runs after theirs.
   */
  readonly hookFocuses: readonly string[];
  /** Runs from the host's `ngAfterViewInit`, inside the first client render. */
  readonly afterViewInit?: (host: TwoSelectHost) => void;
}

const TWO_SELECT_SCENARIO = new InjectionToken<TwoSelectScenario>(
  'TWO_SELECT_SCENARIO',
);

/** Runs the after-render half of the `TWO_SELECT_SCENARIO` on the client. */
@Directive({ selector: '[mlvSsrFocusSelects]' })
class SsrFocusSelects {
  constructor() {
    const scenario = inject(TWO_SELECT_SCENARIO, { optional: true });
    if (isPlatformServer(inject(PLATFORM_ID)) || !scenario) return;
    afterNextRender(() => {
      for (const id of scenario.hookFocuses) {
        document.querySelector<HTMLElement>(`select#${id}`)?.focus();
      }
    });
  }
}

@Component({
  selector: 'mlv-select-ssr-two-select-host',
  imports: [MlvFormField, MlvLabel, MlvSelect, SsrFocusSelects],
  template: `<mlv-form-field
      ><mlv-label>First</mlv-label
      ><mlv-select
        #first
        [id]="'first'"
        native="auto"
        [options]="options"
        (touch)="firstTouches = firstTouches + 1"
    /></mlv-form-field>
    <mlv-form-field
      ><mlv-label>Second</mlv-label
      ><mlv-select
        #second
        [id]="'second'"
        native="auto"
        [options]="options"
        (touch)="secondTouches = secondTouches + 1"
    /></mlv-form-field>
    <span mlvSsrFocusSelects></span>`,
})
class TwoSelectHost implements AfterViewInit {
  readonly options = ['Production', 'Staging'];
  readonly first = viewChild.required<MlvSelect<string>>('first');
  readonly second = viewChild.required<MlvSelect<string>>('second');
  firstTouches = 0;
  secondTouches = 0;
  private readonly _scenario = inject(TWO_SELECT_SCENARIO, { optional: true });
  private readonly _server = isPlatformServer(inject(PLATFORM_ID));

  ngAfterViewInit(): void {
    if (!this._server) this._scenario?.afterViewInit?.(this);
  }
}

/** A root component plus the element the document has to carry for it. */
interface SsrRoot {
  readonly component: Type<unknown>;
  readonly tag: string;
}

const SELECT_HOST: SsrRoot = {
  component: SelectSsrHost,
  tag: 'mlv-select-ssr-host',
};
const SCOPES_HOST: SsrRoot = {
  component: SelectScopesHost,
  tag: 'mlv-select-ssr-scopes-host',
};
const LATE_FOCUS_HOST: SsrRoot = {
  component: LateFocusHost,
  tag: 'mlv-select-ssr-late-focus-host',
};
const FOCUS_TRAP_HOST: SsrRoot = {
  component: FocusTrapHost,
  tag: 'mlv-select-ssr-focus-trap-host',
};
const TWO_SELECT_HOST: SsrRoot = {
  component: TwoSelectHost,
  tag: 'mlv-select-ssr-two-select-host',
};

/**
 * Drops what legitimately differs between the two serialisations of one DOM:
 * hydration bookkeeping the server stamps (`ngh`, `jsaction`, `ng-*`) and
 * generated ids, whose module-scoped counter keeps counting from the server
 * render into the client bootstrap because both run in one test process (a
 * browser starts again from zero).
 */
const normalise = (html: string): string =>
  html
    // The Lucide glyph is not the select's markup, and its opening tag does not
    // survive the round trip through `innerHTML` byte-for-byte: the HTML parser
    // lowercases the `lucideChevronDown` attribute the server wrote on an
    // `<svg>`, and the client directive then writes the camel-cased one again.
    .replace(/<svg[^>]*>/g, '<svg>')
    .replace(/\s(?:ngh|jsaction|ng-server-context|ng-version)="[^"]*"/g, '')
    .replace(/\b(mlv-[a-z]+(?:-[a-z]+)*)-\d+\b/g, '$1-N');

/** The one `<mlv-select>` element of a serialised document. */
const selectMarkup = (html: string): string =>
  /<mlv-select[\s>][\s\S]*?<\/mlv-select>/.exec(html)?.[0] ?? '';

/**
 * `renderApplication` installs domino's DOM classes on `globalThis`
 * (`Object.assign(globalThis, domino.impl)`), after which jsdom rejects its own
 * nodes — axe's `instanceof Node` checks included. The shared
 * `setup-restore-dom-globals.js` puts jsdom's classes back around every test,
 * but these specs render on the server and hydrate in the browser inside *one*
 * test, so they put them back between the two halves from the same snapshot.
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

/**
 * Chromium fires `blur` synchronously when a focused element is removed
 * (measured: Chrome 152 — `blur` then `focusout`, `activeElement` already
 * `<body>`). jsdom follows the HTML focus-fixup rule and fires nothing, which is
 * the other path the select must survive — so only the specs that name the
 * Chromium path install this. Angular's DOM renderer removes nodes with
 * `node.remove()` — which, on a `<select>`, is `HTMLSelectElement.prototype.remove`
 * (the `remove(index)` overload), not `Element.prototype.remove`, so both are
 * wrapped. Returns the restore function.
 */
const emulateChromiumBlurOnRemoval = (): (() => void) => {
  const restore: (() => void)[] = [];
  for (const proto of [Element.prototype, HTMLSelectElement.prototype]) {
    const original = proto.remove;
    proto.remove = function (this: Element, ...args: unknown[]) {
      const focused = document.activeElement as HTMLElement | null;
      const hadFocus =
        args.length === 0 &&
        focused !== null &&
        (this === focused || this.contains(focused));
      let blurred = false;
      const onBlur = () => (blurred = true);
      focused?.addEventListener('blur', onBlur);
      (original as (...a: unknown[]) => void).apply(this, args);
      focused?.removeEventListener('blur', onBlur);
      if (hadFocus && focused && !blurred) {
        focused.dispatchEvent(new FocusEvent('blur'));
        focused.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      }
    } as typeof original;
    restore.push(() => (proto.remove = original));
  }
  return () => restore.forEach((undo) => undo());
};

/** What a server render produced, and everything it reported. */
interface ServerRender {
  readonly html: string;
  readonly problems: string[];
}

const renderOnServer = async (
  native: MlvSelectNativeMode,
  viewport: Viewport,
  root: SsrRoot = SELECT_HOST,
  searchFn?: MlvOptionsSearchFn<string>,
  initialValue?: string | null,
): Promise<ServerRender> => {
  const problems: string[] = [];
  serverBreakpointDownMd = null;
  const consoleError = console.error;
  console.error = (...args: unknown[]) =>
    problems.push(args.map(String).join(' '));
  try {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          root.component,
          {
            providers: [
              provideServerRendering(),
              provideClientHydration(),
              provideMlvI18nTesting(),
              { provide: NATIVE_MODE, useValue: native },
              ...(searchFn ? [{ provide: SEARCH_FN, useValue: searchFn }] : []),
              ...(initialValue !== undefined
                ? [
                    {
                      provide: INITIAL_VALUE,
                      useValue: { value: initialValue },
                    },
                  ]
                : []),
              ...breakpointProviders(viewport),
              {
                provide: ErrorHandler,
                useValue: {
                  handleError: (error: unknown) => problems.push(String(error)),
                },
              },
            ],
          },
          context,
        ),
      {
        document: `<html><head></head><body><${root.tag}></${root.tag}></body></html>`,
        url: '/',
      },
    );
    return { html, problems };
  } finally {
    console.error = consoleError;
    restoreJsdomGlobals();
  }
};

/** The client half: the server markup is in `document.body`, hydration on. */
interface HydratedClient {
  readonly appRef: ApplicationRef;
  readonly host: HTMLElement;
  readonly problems: string[];
  /** Whether a native `<select>` existed right after the bootstrap tick. */
  readonly nativeAfterBootstrapTick: boolean;
  /** Dehydrated views Angular had to discard because no client view claimed them. */
  readonly dehydratedViewsRemoved: number;
  /** The server's `<select>` and trigger nodes, as parsed before bootstrap. */
  readonly serverNodes: {
    readonly select: HTMLSelectElement | null;
    readonly trigger: HTMLElement | null;
  };
}

interface NgDevModeCounters {
  dehydratedViewsRemoved: number;
}

const devCounters = (): NgDevModeCounters | undefined =>
  (globalThis as { ngDevMode?: NgDevModeCounters }).ngDevMode;

interface HydrateOptions {
  readonly root?: SsrRoot;
  /** Runs on the parsed server markup before any JavaScript of the app does. */
  readonly beforeBootstrap?: (nodes: HydratedClient['serverNodes']) => void;
  readonly afterViewInit?: (host: SelectSsrHost) => void;
  readonly afterEveryRender?: () => void;
  readonly searchFn?: MlvOptionsSearchFn<string>;
  readonly initialValue?: string | null;
  /** Further client-side providers, e.g. a `TWO_SELECT_SCENARIO`. */
  readonly providers?: readonly Provider[];
}

const hydrateOnClient = async (
  serverHtml: string,
  native: MlvSelectNativeMode,
  viewport: Exclude<Viewport, 'real'>,
  {
    root = SELECT_HOST,
    beforeBootstrap,
    afterViewInit,
    afterEveryRender: everyRender,
    searchFn,
    initialValue,
    providers = [],
  }: HydrateOptions = {},
): Promise<HydratedClient> => {
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/.exec(serverHtml)?.[1] ?? '';
  firstClientRender = null;
  lateFocusLandedOnSelect = false;
  probeRecords.clear();
  serverSelectHosts = new Set(document.querySelectorAll('mlv-select'));
  const serverNodes = {
    select: document.querySelector<HTMLSelectElement>(`${root.tag} select`),
    trigger: document.querySelector<HTMLElement>(
      `${root.tag} .mlv-select__trigger`,
    ),
  };
  beforeBootstrap?.(serverNodes);

  const problems: string[] = [];
  let nativeAfterBootstrapTick = false;
  const removedBefore = devCounters()?.dehydratedViewsRemoved ?? 0;
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
    const appRef = await bootstrapApplication(root.component, {
      providers: [
        provideClientHydration(),
        provideMlvI18nTesting(),
        { provide: NATIVE_MODE, useValue: native },
        ...(searchFn ? [{ provide: SEARCH_FN, useValue: searchFn }] : []),
        ...(initialValue !== undefined
          ? [{ provide: INITIAL_VALUE, useValue: { value: initialValue } }]
          : []),
        ...(afterViewInit
          ? [{ provide: AFTER_VIEW_INIT, useValue: afterViewInit }]
          : []),
        ...(everyRender
          ? [{ provide: AFTER_EVERY_RENDER, useValue: everyRender }]
          : []),
        ...providers,
        ...breakpointProviders(viewport),
        {
          provide: ErrorHandler,
          useValue: {
            handleError: (error: unknown) => problems.push(String(error)),
          },
        },
        {
          // Bootstrap listeners run straight after the bootstrap `tick()`.
          provide: APP_BOOTSTRAP_LISTENER,
          multi: true,
          useValue: () => {
            nativeAfterBootstrapTick = !!document.querySelector(
              `${root.tag} select`,
            );
          },
        },
      ],
    });
    // Hydration discards unclaimed server views once the app is stable.
    await appRef.whenStable();
    return {
      appRef,
      host: document.querySelector(root.tag) as HTMLElement,
      problems,
      nativeAfterBootstrapTick,
      dehydratedViewsRemoved:
        (devCounters()?.dehydratedViewsRemoved ?? 0) - removedBefore,
      serverNodes,
    };
  } finally {
    console.error = consoleError;
    console.warn = consoleWarn;
    console.log = consoleLog;
  }
};

/** The root `SelectSsrHost` instance of a hydrated client. */
const hostOf = (client: HydratedClient): SelectSsrHost =>
  client.appRef.components[0].instance as SelectSsrHost;

/** Asserts a serialised `<mlv-select>` is the native branch, named by `for`. */
const expectNativeServerMarkup = (html: string): void => {
  const select = selectMarkup(html);
  expect(select, 'no <mlv-select> in the server markup').not.toBe('');
  expect(
    /<select[\s>]/.test(select),
    `the server did not render the native <select>: ${select}`,
  ).toBe(true);
  expect(/mlv-select--native/.test(select)).toBe(true);
  expect(/<select[^>]*\sid="region"/.test(select)).toBe(true);

  const trigger = /<div[^>]*class="mlv-select__trigger"[^>]*>/.exec(
    select,
  )?.[0];
  expect(trigger, `no trigger in the server markup: ${select}`).toBeTruthy();
  expect(/\saria-labelledby="/.test(trigger as string)).toBe(false);
  // The id belongs to the <select> alone — not copied to the hidden trigger,
  // and not as the string "null" a property write of `null` leaves.
  expect(
    /\sid="/.test(trigger as string),
    `the hidden trigger carries an id: ${trigger}`,
  ).toBe(false);

  const label = /<label[^>]*>/.exec(html)?.[0] ?? '';
  expect(label).toContain('for="region"');
};

/** The scopes of `SelectScopesHost`: the hydrated ones, then the rest. */
const SCOPE_KEYS = [
  'hydrated',
  'for-row',
  'hydrate-on-immediate',
  'hydrate-when',
  'skip-hydration-ancestor',
  'if-after-hydration',
] as const;

/** Summarises a probe record as one comparable string. */
const probeSummary = (key: string, withFirstRender: boolean): string => {
  const record = probeRecords.get(key);
  if (!record) return `${key}: never constructed on the client`;
  return (
    `${key}: ngh=${record.nghAtConstruction} reused=${record.reusedServerNode}` +
    (withFirstRender ? ` firstRenderNative=${record.firstRenderNative}` : '')
  );
};

describe('MlvSelect — native="auto" under hydration (#218)', () => {
  let client: HydratedClient | null = null;
  let restoreRemove: (() => void) | null = null;

  afterEach(() => {
    restoreRemove?.();
    restoreRemove = null;
    client?.appRef.destroy();
    client = null;
    document.body.innerHTML = '';
  });

  it('server-renders the native <select> with the real breakpoint service, which answers below md with no viewport', async () => {
    const { html, problems } = await renderOnServer('auto', 'real');

    expect(problems).toEqual([]);
    // The select's server answer for `'auto'` is "native" because this is what
    // the service answers with no viewport. If a server ever learned the
    // viewport, this goes red — revisit #218 rather than let the two drift.
    expect(serverBreakpointDownMd).toBe(true);
    expectNativeServerMarkup(html);
  });

  it('server-renders the native <select> even when the breakpoint service reports a desktop viewport', async () => {
    // The server renders what a hydrating client's first render will render,
    // so a server that had a viewport answer — a hint — still renders native.
    const { html, problems } = await renderOnServer('auto', 'desktop');

    expect(problems).toEqual([]);
    expectNativeServerMarkup(html);
  });

  it('hydrates a desktop client over the server <select>, then switches it to the custom trigger in the same tick', async () => {
    const server = await renderOnServer('auto', 'real');
    client = await hydrateOnClient(server.html, 'auto', 'desktop');
    const { host } = client;
    const hostComponent = hostOf(client);

    expect(client.problems).toEqual([]);
    // Angular's own verdict: a server view no client view claimed is removed
    // silently at stability. Before #218 that was the whole native <select>.
    expect(client.dehydratedViewsRemoved).toBe(0);
    expect(
      firstClientRender !== null,
      'the first client render was not captured',
    ).toBe(true);
    expect(normalise(firstClientRender as string)).toBe(
      normalise(selectMarkup(server.html)),
    );
    expect(/<select[\s>]/.test(firstClientRender as string)).toBe(true);

    // The viewport decided inside the bootstrap tick.
    expect(client.nativeAfterBootstrapTick).toBe(false);

    const label = host.querySelector('mlv-label label') as HTMLLabelElement;
    const trigger = host.querySelector('.mlv-select__trigger') as HTMLElement;
    expect(!!host.querySelector('select')).toBe(false);
    expect(host.querySelector('mlv-select')?.classList).not.toContain(
      'mlv-select--native',
    );
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id);
    expect(trigger.hasAttribute('aria-hidden')).toBe(false);
    expect(label.hasAttribute('for')).toBe(false);
    expect(hostComponent.select().labelTarget()?.labelable).toBe(false);
    expect(trigger.id).toBe('region');
    expect(host.querySelectorAll('#region')).toHaveLength(1);
    // Hydration claimed the server's trigger rather than building another.
    expect(trigger === client.serverNodes.trigger).toBe(true);
    // The committed value crosses the switch.
    expect(host.querySelector('.mlv-select__value')?.textContent?.trim()).toBe(
      'Staging',
    );
    expect(hostComponent.value()).toBe('Staging');
    expect(hostComponent.touches).toBe(0);

    await expectNoAxeViolations(host);
  });

  it('hydrates a phone client over the server <select> and never switches', async () => {
    const server = await renderOnServer('auto', 'real');
    client = await hydrateOnClient(server.html, 'auto', 'phone');
    const { host } = client;
    const hostComponent = hostOf(client);

    expect(client.problems).toEqual([]);
    expect(client.dehydratedViewsRemoved).toBe(0);
    expect(normalise(firstClientRender as string)).toBe(
      normalise(selectMarkup(server.html)),
    );
    expect(client.nativeAfterBootstrapTick).toBe(true);

    const nativeSelect = host.querySelector(
      'select.mlv-select__native',
    ) as HTMLSelectElement;
    // The very node the server rendered: claimed at hydration, never replaced.
    expect(!!client.serverNodes.select).toBe(true);
    expect(nativeSelect === client.serverNodes.select).toBe(true);

    const label = host.querySelector('mlv-label label') as HTMLLabelElement;
    const trigger = host.querySelector('.mlv-select__trigger') as HTMLElement;
    expect(host.querySelector('mlv-select')?.classList).toContain(
      'mlv-select--native',
    );
    expect(label.getAttribute('for')).toBe('region');
    expect(nativeSelect.labels?.length).toBe(1);
    expect(trigger.hasAttribute('aria-labelledby')).toBe(false);
    expect(trigger.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.getAttribute('id')).toBeNull();
    expect(hostComponent.select().labelTarget()?.labelable).toBe(true);
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) =>
        option.text.trim(),
      ),
    ).toEqual(['Staging']);

    await expectNoAxeViolations(host);
  });

  // Each client call is recorded with when it happened relative to the first
  // client render (`firstClientRender` is captured at the host's first
  // `earlyRead`): `before` means during it, as every native render loaded
  // before #218.
  for (const [native, viewport, initialValue, callsOnHydration] of [
    // A committed value needing its label loads eagerly on every client.
    ['auto', 'desktop', 'Staging', ["'' before"]],
    // None: a desktop defers a lazy searchFn to the first open, as a
    // client-rendered desktop does (see the TestBed block) — the native branch
    // it renders for its hydrating render does not load it.
    ['auto', 'desktop', null, []],
    // A phone and an explicit `native=true` render the native branch hydrating
    // or not, so they load during the first render, as they always did.
    ['auto', 'phone', null, ["'' before"]],
    [true, 'desktop', null, ["'' before"]],
  ] as const) {
    it(`calls a lazy searchFn on a hydrating ${viewport} native=${native} client exactly when a client-rendered one would (value ${initialValue})`, async () => {
      const serverCalls: string[] = [];
      const server = await renderOnServer(
        native,
        'real',
        SELECT_HOST,
        (query) => {
          serverCalls.push(query);
          return of(['Production', 'Staging']);
        },
        initialValue,
      );
      expect(server.problems).toEqual([]);
      expect(serverCalls).toEqual(['']);
      expect(
        (selectMarkup(server.html).match(/<option[\s>]/g) ?? []).length,
      ).toBe(3);

      const clientCalls: string[] = [];
      client = await hydrateOnClient(server.html, native, viewport, {
        initialValue,
        searchFn: (query) => {
          clientCalls.push(
            `'${query}' ${firstClientRender === null ? 'before' : 'after'}`,
          );
          return of(['Production', 'Staging']);
        },
      });

      expect(client.problems).toEqual([]);
      expect(client.dehydratedViewsRemoved).toBe(0);
      expect(normalise(firstClientRender as string)).toBe(
        normalise(selectMarkup(server.html)),
      );
      expect(clientCalls).toEqual(callsOnHydration);
      const staysNative = native === true || viewport === 'phone';
      expect(!!client.host.querySelector('select')).toBe(staysNative);

      // Loaded exactly once, whenever that was.
      hostOf(client).select().openDropdown();
      await client.appRef.whenStable();
      expect(hostOf(client).select().isOpen()).toBe(!staysNative);
      expect(clientCalls).toHaveLength(1);
    });
  }

  for (const [change, applyChange] of [
    ['`native` turns true', (host: SelectSsrHost) => host.native.set(true)],
    [
      'the viewport answer drops below md',
      (host: SelectSsrHost) =>
        (host.breakpoint as unknown as FakeBreakpointService).down.set(true),
    ],
  ] as const) {
    it(`still loads a lazy searchFn once ${change} during a hydrating desktop client's first render, which then keeps the <select>`, async () => {
      const server = await renderOnServer(
        'auto',
        'real',
        SELECT_HOST,
        () => of(['Production', 'Staging']),
        null,
      );
      expect(server.problems).toEqual([]);

      const clientCalls: string[] = [];
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        initialValue: null,
        searchFn: (query) => {
          clientCalls.push(
            `'${query}' ${firstClientRender === null ? 'before' : 'after'}`,
          );
          return of(['Production', 'Staging']);
        },
        // Inside the first client render, before the select's switch has run:
        // the change keeps the <select> without changing which branch renders.
        afterViewInit: applyChange,
      });

      expect(client.problems).toEqual([]);
      expect(client.dehydratedViewsRemoved).toBe(0);
      expect(!!client.host.querySelector('select')).toBe(true);
      // As a client-rendered native select loads: during its first render.
      expect(clientCalls).toEqual(["'' before"]);
      // The placeholder plus both loaded options.
      expect(client.host.querySelectorAll('option')).toHaveLength(3);
    });
  }

  for (const [native, clientViewport, expectNative] of [
    // The adversarial viewport for each: a desktop would pull `'auto'` onto the
    // trigger, a phone would keep `'auto'` native.
    [true, 'desktop', true],
    [false, 'phone', false],
  ] as const) {
    it(`renders native=${native} identically on the server and every client render, whatever the viewport`, async () => {
      const server = await renderOnServer(native, 'real');
      const serverSelect = selectMarkup(server.html);

      expect(server.problems).toEqual([]);
      expect(/<select[\s>]/.test(serverSelect)).toBe(expectNative);

      client = await hydrateOnClient(server.html, native, clientViewport);
      expect(client.problems).toEqual([]);
      expect(client.dehydratedViewsRemoved).toBe(0);
      expect(normalise(firstClientRender as string)).toBe(
        normalise(serverSelect),
      );
      expect(client.nativeAfterBootstrapTick).toBe(expectNative);
      expect(!!client.host.querySelector('select')).toBe(expectNative);

      const label = client.host.querySelector(
        'mlv-label label',
      ) as HTMLLabelElement;
      expect(label.getAttribute('for')).toBe(expectNative ? 'region' : null);
    });
  }

  it('tripwire (Angular internals): a select host carries `ngh` at construction exactly when hydration reuses a server node', async () => {
    // `MlvSelect` decides "am I being hydrated" from the `ngh` attribute on its
    // host in a field initializer — Angular 22.0.7 strips it in
    // `renderComponent`, after the host's directives are constructed. If
    // Angular stops stamping it, or starts stripping it earlier, this fails
    // before any user sees a hydrated desktop select drop its server <select>.
    const server = await renderOnServer('auto', 'real', SCOPES_HOST);
    expect(server.problems).toEqual([]);
    client = await hydrateOnClient(server.html, 'auto', 'desktop', {
      root: SCOPES_HOST,
    });
    (client.appRef.components[0].instance as SelectScopesHost).late.set(true);
    await client.appRef.whenStable();

    expect(client.problems).toEqual([]);
    // `hydrate when` hydrates only once `late` turns on — after the app is
    // stable — and still claims the server's node.
    expect(SCOPE_KEYS.map((key) => probeSummary(key, false))).toEqual([
      'hydrated: ngh=true reused=true',
      'for-row: ngh=true reused=true',
      'hydrate-on-immediate: ngh=true reused=true',
      'hydrate-when: ngh=true reused=true',
      'skip-hydration-ancestor: ngh=false reused=false',
      'if-after-hydration: ngh=false reused=false',
    ]);
  });

  it('gates only the selects hydration claims: an ngSkipHydration subtree and an @if after hydration render the trigger from their first render', async () => {
    const server = await renderOnServer('auto', 'real', SCOPES_HOST);
    client = await hydrateOnClient(server.html, 'auto', 'desktop', {
      root: SCOPES_HOST,
    });
    (client.appRef.components[0].instance as SelectScopesHost).late.set(true);
    await client.appRef.whenStable();

    expect(client.problems).toEqual([]);
    expect(client.dehydratedViewsRemoved).toBe(0);
    expect(SCOPE_KEYS.map((key) => probeSummary(key, true))).toEqual([
      'hydrated: ngh=true reused=true firstRenderNative=true',
      'for-row: ngh=true reused=true firstRenderNative=true',
      'hydrate-on-immediate: ngh=true reused=true firstRenderNative=true',
      'hydrate-when: ngh=true reused=true firstRenderNative=true',
      'skip-hydration-ancestor: ngh=false reused=false firstRenderNative=false',
      'if-after-hydration: ngh=false reused=false firstRenderNative=false',
    ]);
    // Every one of them ends on the trigger.
    expect(client.host.querySelectorAll('mlv-select')).toHaveLength(6);
    expect(client.host.querySelectorAll('select')).toHaveLength(0);
  });

  describe('focus the user put on the server <select> before JavaScript ran', () => {
    const focusServerSelect = (nodes: HydratedClient['serverNodes']) =>
      nodes.select?.focus();

    it('moves to the trigger without marking the field touched, where removal fires no blur (HTML focus fixup, jsdom)', async () => {
      const server = await renderOnServer('auto', 'real');
      let preJsFocus = false;
      // What the trigger looked like at the instant it took focus.
      const atFocus: string[] = [];
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        beforeBootstrap: (nodes) => {
          nodes.trigger?.addEventListener('focus', () =>
            atFocus.push(
              `aria-hidden=${nodes.trigger?.getAttribute('aria-hidden')} ` +
                `select=${!!document.querySelector('mlv-select select')}`,
            ),
          );
          focusServerSelect(nodes);
          preJsFocus = document.activeElement === nodes.select;
        },
      });

      expect(preJsFocus).toBe(true);
      const trigger = client.host.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;
      expect(!!client.host.querySelector('select')).toBe(false);
      expect(document.activeElement === trigger).toBe(true);
      // Focus never lands on a trigger that is still `aria-hidden` beside a live
      // <select>: the hand-off waits for the render that switches the two.
      expect(atFocus).toEqual(['aria-hidden=null select=false']);
      expect(hostOf(client).touches).toBe(0);
      expect(hostOf(client).select().focused()).toBe(true);

      // The hand-off window is over: once the viewport crosses below md, the
      // user leaving the <select> marks the field touched again.
      (
        client.appRef.injector.get(
          MlvBreakpointService,
        ) as unknown as FakeBreakpointService
      ).down.set(true);
      await client.appRef.whenStable();
      const nativeSelect = client.host.querySelector(
        'select',
      ) as HTMLSelectElement | null;
      expect(!!nativeSelect).toBe(true);
      nativeSelect?.focus();
      const touchesBeforeLeaving = hostOf(client).touches;
      nativeSelect?.blur();
      expect(hostOf(client).touches - touchesBeforeLeaving).toBe(1);
    });

    it('moves to the trigger exactly once without marking the field touched, where removal fires blur (Chromium)', async () => {
      restoreRemove = emulateChromiumBlurOnRemoval();
      const server = await renderOnServer('auto', 'real');
      let triggerFocusEvents = 0;
      let selectBlurEvents = 0;
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        beforeBootstrap: (nodes) => {
          nodes.trigger?.addEventListener('focus', () => triggerFocusEvents++);
          nodes.select?.addEventListener('blur', () => selectBlurEvents++);
          focusServerSelect(nodes);
        },
      });

      const trigger = client.host.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;
      // The emulation really fired the removal blur the select must ignore.
      expect(selectBlurEvents).toBe(1);
      expect(document.activeElement === trigger).toBe(true);
      expect(triggerFocusEvents).toBe(1);
      expect(hostOf(client).touches).toBe(0);
      expect(hostOf(client).select().focused()).toBe(true);
    });

    it('leaves focus where something else put it between the removal and the hand-off', async () => {
      restoreRemove = emulateChromiumBlurOnRemoval();
      const server = await renderOnServer('auto', 'real');
      const elsewhere = document.createElement('button');
      elsewhere.textContent = 'Elsewhere';
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        beforeBootstrap: (nodes) => {
          document.body.appendChild(elsewhere);
          // Page code reacting to the removal blur by moving focus itself.
          nodes.select?.addEventListener('blur', () => elsewhere.focus());
          focusServerSelect(nodes);
        },
      });

      expect(document.activeElement === elsewhere).toBe(true);
      expect(hostOf(client).touches).toBe(0);
    });

    it('leaves focus where something else put it after a removal that fired no blur (jsdom)', async () => {
      const server = await renderOnServer('auto', 'real');
      const elsewhere = document.createElement('button');
      elsewhere.textContent = 'Elsewhere';
      let movedFocus = false;
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        beforeBootstrap: (nodes) => {
          document.body.appendChild(elsewhere);
          focusServerSelect(nodes);
        },
        // Runs in the pass that re-renders without the <select>, ahead of the
        // select's hand-off: page code taking focus once the control is gone.
        afterEveryRender: () => {
          if (movedFocus || document.querySelector('mlv-select select')) return;
          movedFocus = true;
          elsewhere.focus();
        },
      });

      expect(movedFocus).toBe(true);
      expect(document.activeElement === elsewhere).toBe(true);
      expect(hostOf(client).touches).toBe(0);
      expect(hostOf(client).select().focused()).toBe(false);
    });

    for (const [name, root] of [
      ['a sibling directive', LATE_FOCUS_HOST],
      ['cdkTrapFocusAutoCapture', FOCUS_TRAP_HOST],
    ] as const) {
      for (const engine of ['jsdom', 'Chromium'] as const) {
        it(`hands focus to the trigger when ${name} focuses the <select> from an after-render hook that runs after the select's own (${engine})`, async () => {
          if (engine === 'Chromium') {
            restoreRemove = emulateChromiumBlurOnRemoval();
          }
          const server = await renderOnServer('auto', 'real', root);
          expect(server.problems).toEqual([]);
          const focusTargets: string[] = [];
          const onFocusIn = (event: Event) =>
            focusTargets.push((event.target as Element).tagName.toLowerCase());
          document.addEventListener('focusin', onFocusIn);
          try {
            client = await hydrateOnClient(server.html, 'auto', 'desktop', {
              root,
            });
          } finally {
            document.removeEventListener('focusin', onFocusIn);
          }
          const host = client.appRef.components[0].instance as FocusHost;
          const trigger = client.host.querySelector(
            '.mlv-select__trigger',
          ) as HTMLElement;

          expect(client.problems).toEqual([]);
          expect(client.dehydratedViewsRemoved).toBe(0);
          if (root === LATE_FOCUS_HOST)
            expect(lateFocusLandedOnSelect).toBe(true);
          // Focus really reached the claimed <select> before the switch.
          expect(focusTargets).toEqual(['select', 'div']);
          expect(!!client.host.querySelector('select')).toBe(false);
          expect(document.activeElement === trigger).toBe(true);
          expect(host.touches).toBe(0);
          expect(host.select().focused()).toBe(true);
        });
      }
    }

    it("clears the focused state a later after-render hook's focus on the <select> set, when something else takes focus after a removal that fired no blur (jsdom)", async () => {
      const server = await renderOnServer('auto', 'real', LATE_FOCUS_HOST);
      const elsewhere = document.createElement('button');
      elsewhere.textContent = 'Elsewhere';
      let movedFocus = false;
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        root: LATE_FOCUS_HOST,
        beforeBootstrap: () => document.body.appendChild(elsewhere),
        // Runs in the pass that re-renders without the <select>, ahead of the
        // select's hand-off: page code taking focus once the control is gone.
        afterEveryRender: () => {
          if (movedFocus || document.querySelector('mlv-select select')) return;
          movedFocus = true;
          elsewhere.focus();
        },
      });
      const host = client.appRef.components[0].instance as FocusHost;

      expect(client.problems).toEqual([]);
      expect(lateFocusLandedOnSelect).toBe(true);
      expect(movedFocus).toBe(true);
      expect(document.activeElement === elsewhere).toBe(true);
      expect(host.touches).toBe(0);
      expect(host.select().focused()).toBe(false);
    });

    it('does nothing to focus on a phone client, which keeps the <select>', async () => {
      const server = await renderOnServer('auto', 'real');
      client = await hydrateOnClient(server.html, 'auto', 'phone', {
        beforeBootstrap: focusServerSelect,
      });

      expect(document.activeElement === client.serverNodes.select).toBe(true);
      expect(hostOf(client).touches).toBe(0);
    });
  });

  const overlayPanelCount = (): number =>
    document.querySelectorAll('.cdk-overlay-container .mlv-select__panel')
      .length;

  for (const [method, focusOnTrigger] of [
    // "Focuses the trigger and opens the dropdown."
    ['openDropdown', true],
    // Opens without moving focus.
    ['toggleDropdown', false],
  ] as const) {
    it(`${method}() called while a desktop client is still claiming the server <select> opens the dropdown once the switch lands, as on a client-rendered desktop`, async () => {
      const server = await renderOnServer('auto', 'real');
      let nativeWhenCalled: boolean | null = null;
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        // `ngAfterViewInit` runs inside the first client render, before the
        // select's switch: the <select> is the rendered surface there.
        afterViewInit: (host) => {
          nativeWhenCalled = !!document.querySelector('mlv-select select');
          host.select()[method]();
        },
      });
      const select = hostOf(client).select();
      const trigger = client.host.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;

      expect(nativeWhenCalled).toBe(true);
      expect(client.problems).toEqual([]);
      expect(client.dehydratedViewsRemoved).toBe(0);
      expect(!!client.host.querySelector('select')).toBe(false);
      expect(select.isOpen()).toBe(true);
      expect(overlayPanelCount()).toBe(1);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement === trigger).toBe(focusOnTrigger);
      expect(hostOf(client).touches).toBe(0);
    });
  }

  it('toggleDropdown() called twice while a desktop client is still claiming the server <select> leaves the dropdown closed, as on a client-rendered desktop', async () => {
    const server = await renderOnServer('auto', 'real');
    client = await hydrateOnClient(server.html, 'auto', 'desktop', {
      afterViewInit: (host) => {
        host.select().toggleDropdown();
        host.select().toggleDropdown();
      },
    });

    expect(client.problems).toEqual([]);
    expect(hostOf(client).select().isOpen()).toBe(false);
    expect(overlayPanelCount()).toBe(0);
  });

  for (const [sequence, run, endsOpen] of [
    [
      'isOpen.set(true), then toggleDropdown()',
      (host: SelectSsrHost) => {
        host.select().isOpen.set(true);
        host.select().toggleDropdown();
      },
      false,
    ],
    [
      'toggleDropdown(), then `native` turning false',
      (host: SelectSsrHost) => {
        host.select().toggleDropdown();
        host.native.set(false);
      },
      true,
    ],
  ] as const) {
    it(`${sequence} while a desktop client is still claiming the server <select> ends ${endsOpen ? 'open' : 'closed'}, as on a client-rendered desktop`, async () => {
      const server = await renderOnServer('auto', 'real');
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        afterViewInit: run,
      });

      expect(client.problems).toEqual([]);
      expect(!!client.host.querySelector('select')).toBe(false);
      expect(hostOf(client).select().isOpen()).toBe(endsOpen);
      expect(overlayPanelCount()).toBe(endsOpen ? 1 : 0);
    });
  }

  it('toggleDropdown(), `native` turning false, then toggleDropdown() once that render has removed the <select> ends closed, as on a client-rendered desktop', async () => {
    const server = await renderOnServer('auto', 'real');
    let host: SelectSsrHost | null = null;
    let toggledWithSelectGone = false;
    client = await hydrateOnClient(server.html, 'auto', 'desktop', {
      afterViewInit: (h) => {
        host = h;
        h.select().toggleDropdown();
        h.native.set(false);
      },
      // Runs after the select's first hook has ended the hydrating render and
      // before its hand-off hook applies the open (measured): the select no
      // longer switches, and the first toggle's open is still pending.
      afterEveryRender: () => {
        if (toggledWithSelectGone || !host) return;
        if (document.querySelector('mlv-select select')) return;
        toggledWithSelectGone = true;
        (host as SelectSsrHost).select().toggleDropdown();
      },
    });

    expect(toggledWithSelectGone).toBe(true);
    expect(client.problems).toEqual([]);
    expect(hostOf(client).select().isOpen()).toBe(false);
    expect(overlayPanelCount()).toBe(0);
  });

  it('toggleDropdown(), then toggleDropdown() from an after-render hook registered after the select ends closed, as on a client-rendered desktop', async () => {
    const server = await renderOnServer('auto', 'real');
    let selectPresentAtSecondToggle: boolean | null = null;
    client = await hydrateOnClient(server.html, 'auto', 'desktop', {
      afterViewInit: (host) => {
        host.select().toggleDropdown();
        // Registered after the select's own hook, so it runs in the same pass
        // once that hook has ended the hydrating render — before the re-render
        // that removes the <select>, and before the hook that applies the open.
        afterNextRender(
          () => {
            selectPresentAtSecondToggle =
              !!document.querySelector('mlv-select select');
            host.select().toggleDropdown();
          },
          { injector: host.injector },
        );
      },
    });

    expect(selectPresentAtSecondToggle).toBe(true);
    expect(client.problems).toEqual([]);
    expect(!!client.host.querySelector('select')).toBe(false);
    expect(hostOf(client).select().isOpen()).toBe(false);
    expect(overlayPanelCount()).toBe(0);
  });

  for (const engine of ['jsdom', 'Chromium'] as const) {
    it(`openDropdown(), then \`native\` turning false, while a desktop client is still claiming the server <select> opens the dropdown with focus on the trigger and the field untouched (${engine})`, async () => {
      if (engine === 'Chromium') restoreRemove = emulateChromiumBlurOnRemoval();
      const server = await renderOnServer('auto', 'real');
      let selectBlurEvents = 0;
      client = await hydrateOnClient(server.html, 'auto', 'desktop', {
        beforeBootstrap: (nodes) =>
          nodes.select?.addEventListener('blur', () => selectBlurEvents++),
        afterViewInit: (host) => {
          host.select().openDropdown();
          host.native.set(false);
        },
      });
      const trigger = client.host.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;

      expect(client.problems).toEqual([]);
      // `native` removed the <select> before the render ended — with a blur
      // only where the engine fires one.
      expect(!!client.host.querySelector('select')).toBe(false);
      expect(selectBlurEvents).toBe(engine === 'Chromium' ? 1 : 0);
      expect(hostOf(client).select().isOpen()).toBe(true);
      expect(overlayPanelCount()).toBe(1);
      expect(document.activeElement === trigger).toBe(true);
      expect(hostOf(client).touches).toBe(0);
      expect(hostOf(client).select().focused()).toBe(true);
    });
  }

  describe('two hydrating selects whose <select>s are focused in turn', () => {
    for (const [name, scenario, preJsFocusFirst] of [
      [
        'a later after-render hook focuses the first, then the second',
        { hookFocuses: ['first', 'second'] },
        false,
      ],
      [
        'the user focused the first before JavaScript ran, then a later after-render hook focuses the second',
        { hookFocuses: ['second'] },
        true,
      ],
      [
        "the user focused the first before JavaScript ran, then the second's openDropdown() runs in ngAfterViewInit",
        {
          hookFocuses: [],
          afterViewInit: (host: TwoSelectHost) => host.second().openDropdown(),
        },
        true,
      ],
    ] as const) {
      for (const engine of ['jsdom', 'Chromium'] as const) {
        it(`hands focus to the trigger of the one focused last, touching neither, when ${name} (${engine})`, async () => {
          if (engine === 'Chromium') {
            restoreRemove = emulateChromiumBlurOnRemoval();
          }
          const server = await renderOnServer('auto', 'real', TWO_SELECT_HOST);
          expect(server.problems).toEqual([]);
          const focusTargets: string[] = [];
          const onFocusIn = (event: Event) => {
            const target = event.target as Element;
            focusTargets.push(`${target.tagName.toLowerCase()}#${target.id}`);
          };
          document.addEventListener('focusin', onFocusIn);
          try {
            client = await hydrateOnClient(server.html, 'auto', 'desktop', {
              root: TWO_SELECT_HOST,
              providers: [{ provide: TWO_SELECT_SCENARIO, useValue: scenario }],
              beforeBootstrap: () => {
                if (preJsFocusFirst) {
                  document.querySelector<HTMLElement>('select#first')?.focus();
                }
              },
            });
          } finally {
            document.removeEventListener('focusin', onFocusIn);
          }
          const host = client.appRef.components[0].instance as TwoSelectHost;
          const triggers = Array.from(
            client.host.querySelectorAll<HTMLElement>('.mlv-select__trigger'),
          );

          expect(client.problems).toEqual([]);
          // Each scenario really focused the first <select>, then the second,
          // before the switch removed both.
          expect(focusTargets).toEqual([
            'select#first',
            'select#second',
            'div#second',
          ]);
          expect(client.dehydratedViewsRemoved).toBe(0);
          expect(client.host.querySelectorAll('select')).toHaveLength(0);
          expect(triggers.map((trigger) => trigger.id)).toEqual([
            'first',
            'second',
          ]);
          expect(document.activeElement === triggers[1]).toBe(true);
          expect(host.second().focused()).toBe(true);
          expect(host.first().focused()).toBe(false);
          expect([host.firstTouches, host.secondTouches]).toEqual([0, 0]);
        });
      }
    }
  });
});

/**
 * The client-only half: a select no server rendered is not gated at all, so
 * everything here is the behaviour `native="auto"` had before #218 — pinned so
 * the hydration gate cannot leak into it.
 *
 * `create()` writes inputs with `setInput`, which applies them immediately.
 * Through a host template they would not be bound until the first change
 * detection, so every "before the first render" read would see `native=false`
 * and prove nothing.
 */
describe('MlvSelect — native="auto" on a client-rendered select is not gated (#218)', () => {
  let breakpoint: FakeBreakpointService;

  const configure = async (viewport: 'phone' | 'desktop') => {
    breakpoint = new FakeBreakpointService(viewport === 'phone');
    await TestBed.configureTestingModule({
      imports: [MlvSelect],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useValue: breakpoint },
      ],
    }).compileComponents();
  };

  const create = () => {
    const fixture = TestBed.createComponent(MlvSelect<string>);
    fixture.componentRef.setInput('label', 'Region');
    fixture.componentRef.setInput('native', 'auto');
    fixture.componentRef.setInput('options', ['Production', 'Staging']);
    return fixture;
  };

  const overlayPanels = (): number =>
    document.querySelectorAll('.cdk-overlay-container .mlv-select__panel')
      .length;

  /**
   * Finishes any popup leave animation — jsdom never fires `animationend`, and
   * the popup detaches its overlay only once it does.
   */
  const finishCloseAnimations = async (fixture: {
    whenStable(): Promise<unknown>;
  }): Promise<void> => {
    for (const popup of Array.from(
      document.querySelectorAll('.cdk-overlay-container .mlv-popup'),
    )) {
      popup.dispatchEvent(new Event('animationend'));
    }
    await fixture.whenStable();
  };

  it('cannot tell hydration from the breakpoint service: the browser reports the viewport before any render', async () => {
    // The real service, over the desktop `matchMedia` stub in `test-setup.ts`.
    await TestBed.configureTestingModule({}).compileComponents();
    const service = TestBed.inject(MlvBreakpointService);

    // Nothing has rendered. CDK's `BreakpointObserver` emits synchronously on
    // subscribe, so a hydrating select reading the service on its first render
    // would resolve the trigger while the server rendered the <select> — which
    // is why the gate is keyed on the host being hydrated instead.
    expect(service.isDown('md')()).toBe(false);
  });

  it('reports the trigger as its label target on a desktop client before and after its first render', async () => {
    await configure('desktop');
    const fixture = create();
    const select = fixture.componentInstance;

    expect(select.labelTarget()?.labelable).toBe(false);
    expect(fixture.nativeElement.classList.contains('mlv-select--native')).toBe(
      false,
    );

    await fixture.whenStable();
    expect(select.labelTarget()?.labelable).toBe(false);
    expect(!!fixture.nativeElement.querySelector('select')).toBe(false);
  });

  it('never renders the native <select> or its options on a desktop client, not even for its first render', async () => {
    await configure('desktop');
    let firstRender: string | null = null;
    let firstRenderNativeClass: boolean | null = null;

    @Component({
      imports: [MlvSelect],
      template: `<mlv-select
        label="Region"
        native="auto"
        [options]="options"
      />`,
    })
    class CsrHost {
      readonly options = ['Production', 'Staging'];
      constructor() {
        const element =
          inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterNextRender({
          earlyRead: () => {
            firstRender = element.innerHTML;
            firstRenderNativeClass = !!element.querySelector(
              '.mlv-select--native',
            );
          },
        });
      }
    }

    const fixture = TestBed.createComponent(CsrHost);
    // One `detectChanges()` is one `ApplicationRef.tick()` here.
    fixture.detectChanges();

    expect(firstRender !== null, 'the first render was not captured').toBe(
      true,
    );
    expect(/<select[\s>]/.test(firstRender ?? '')).toBe(false);
    expect(/<option[\s>]/.test(firstRender ?? '')).toBe(false);
    expect(firstRenderNativeClass).toBe(false);
    expect(/role="combobox"/.test(firstRender ?? '')).toBe(true);
  });

  for (const method of ['openDropdown', 'toggleDropdown'] as const) {
    it(`${method}() before the first render opens the dropdown on a desktop client, and it closes without leaving an overlay`, async () => {
      await configure('desktop');
      const fixture = create();
      const select = fixture.componentInstance;

      select[method]();
      expect(select.isOpen()).toBe(true);

      await fixture.whenStable();
      expect(!!fixture.nativeElement.querySelector('select')).toBe(false);
      expect(select.isOpen()).toBe(true);
      expect(overlayPanels()).toBe(1);

      select.isOpen.set(false);
      await fixture.whenStable();
      await finishCloseAnimations(fixture);
      expect(overlayPanels()).toBe(0);
    });
  }

  it('opens nothing for a phone client that asked before the first render', async () => {
    await configure('phone');
    const fixture = create();
    const select = fixture.componentInstance;

    select.openDropdown();
    expect(select.isOpen()).toBe(false);

    await fixture.whenStable();
    await finishCloseAnimations(fixture);
    expect(!!fixture.nativeElement.querySelector('select')).toBe(true);
    expect(select.isOpen()).toBe(false);
    expect(overlayPanels()).toBe(0);
  });

  it('does not start a lazy searchFn load on a desktop client', async () => {
    await configure('desktop');
    const calls: string[] = [];
    const fixture = create();
    fixture.componentRef.setInput(
      'searchFn',
      (query: string): Observable<string[]> => {
        calls.push(query);
        return of(['Production', 'Staging']);
      },
    );
    await fixture.whenStable();

    // The trigger defers a `searchFn` to the first open.
    expect(!!fixture.nativeElement.querySelector('select')).toBe(false);
    expect(calls).toEqual([]);
  });

  it('still loads a lazy searchFn at once on a phone client, which renders the <select>', async () => {
    await configure('phone');
    const calls: string[] = [];
    const fixture = create();
    fixture.componentRef.setInput(
      'searchFn',
      (query: string): Observable<string[]> => {
        calls.push(query);
        return of(['Production', 'Staging']);
      },
    );
    await fixture.whenStable();

    expect(!!fixture.nativeElement.querySelector('select')).toBe(true);
    expect(calls).toEqual(['']);
  });

  it('closes a dropdown that is open when the viewport crosses below md', async () => {
    await configure('desktop');
    const fixture = create();
    const select = fixture.componentInstance;
    await fixture.whenStable();

    select.openDropdown();
    await fixture.whenStable();
    expect(overlayPanels()).toBe(1);

    breakpoint.down.set(true);
    await fixture.whenStable();
    await finishCloseAnimations(fixture);

    expect(!!fixture.nativeElement.querySelector('select')).toBe(true);
    expect(select.isOpen()).toBe(false);
    expect(overlayPanels()).toBe(0);
  });

  it('lands dialog initial focus on the trigger of a desktop native="auto" first field, where removal fires no blur', async () => {
    await configure('desktop');

    @Component({
      imports: [MlvSelect],
      template: `<mlv-select
        label="Region"
        native="auto"
        [options]="options"
      />`,
    })
    class DialogContent {
      readonly options = ['Production', 'Staging'];
    }

    TestBed.inject(MlvDialogService).open(DialogContent);
    const appRef = TestBed.inject(ApplicationRef);
    await appRef.whenStable();
    // The dialog container captures initial focus in an after-render hook of
    // its own render; the second wait lets that pass settle.
    await appRef.whenStable();

    const pane = document.querySelector('.cdk-overlay-pane');
    const trigger = pane?.querySelector('.mlv-select__trigger') ?? null;
    expect(!!trigger, 'the dialog did not render a trigger').toBe(true);
    expect(!!pane?.querySelector('select')).toBe(false);
    expect(document.activeElement === trigger).toBe(true);
  });

  describe('focus on the <select> when a later render removes it (Chromium blur on removal)', () => {
    let restoreRemove: (() => void) | null = null;
    beforeEach(() => {
      restoreRemove = emulateChromiumBlurOnRemoval();
    });
    afterEach(() => {
      restoreRemove?.();
      restoreRemove = null;
    });

    it('marks the field touched and drops focus when the viewport crosses md while the <select> has focus', async () => {
      await configure('phone');
      let touches = 0;
      const fixture = create();
      fixture.componentInstance.touch.subscribe(() => touches++);
      await fixture.whenStable();

      (
        fixture.nativeElement.querySelector('select') as HTMLSelectElement
      ).focus();
      breakpoint.down.set(false);
      await fixture.whenStable();

      expect(!!fixture.nativeElement.querySelector('select')).toBe(false);
      expect(document.activeElement === document.body).toBe(true);
      expect(touches).toBe(1);
      expect(fixture.componentInstance.focused()).toBe(false);
    });

    it('marks the field touched and drops focus when native turns false while the <select> has focus', async () => {
      await configure('desktop');
      let touches = 0;
      const fixture = create();
      fixture.componentRef.setInput('native', true);
      fixture.componentInstance.touch.subscribe(() => touches++);
      await fixture.whenStable();

      (
        fixture.nativeElement.querySelector('select') as HTMLSelectElement
      ).focus();
      fixture.componentRef.setInput('native', false);
      await fixture.whenStable();

      expect(!!fixture.nativeElement.querySelector('select')).toBe(false);
      expect(document.activeElement === document.body).toBe(true);
      expect(touches).toBe(1);
    });

    it('still marks the field touched when the user leaves the <select>', async () => {
      await configure('phone');
      let touches = 0;
      const fixture = create();
      fixture.componentInstance.touch.subscribe(() => touches++);
      await fixture.whenStable();

      const nativeSelect = fixture.nativeElement.querySelector(
        'select',
      ) as HTMLSelectElement;
      nativeSelect.focus();
      nativeSelect.blur();
      await fixture.whenStable();

      expect(touches).toBe(1);
    });
  });
});

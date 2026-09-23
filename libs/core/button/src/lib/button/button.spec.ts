import { fileURLToPath } from 'node:url';
import {
  ChangeDetectionStrategy,
  Component,
  createComponent,
  EnvironmentInjector,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  NavigationStart,
  provideRouter,
  Router,
  RouterLink,
} from '@angular/router';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { compile } from 'sass';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { LucideX } from '@lucide/angular';
import { MlvButton } from './button';
import {
  MlvButtonAfter,
  MlvButtonBefore,
  MlvButtonIcon,
} from '../button.directives';
import { MlvButtonGroup } from '../button-group/button-group';
import type { MlvButtonShape } from '../button.types';

describe('MlvButton', () => {
  let component: MlvButton;
  let fixture: ComponentFixture<MlvButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvButton],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose a busy, non-interactive loading state', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.nativeElement as HTMLButtonElement;
    expect(component.loading()).toBe(true);
    expect(button.classList.contains('mlv-button--loading')).toBe(true);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    const loader = button.querySelector('mlv-loader');
    expect(loader).toBeTruthy();
    expect(loader?.classList.contains('mlv-loader--indeterminate')).toBe(true);

    const clickEvent = new MouseEvent('click', { cancelable: true });
    button.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('should remove loading state when loading is false', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const button = fixture.nativeElement as HTMLButtonElement;
    expect(button.classList.contains('mlv-button--loading')).toBe(false);
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('mlv-loader')).toBeNull();
  });
});

@Component({ template: '' })
class BlankPage {}

/**
 * Anchor buttons beside every listener that must not see a disabled click: the
 * router's own and a consumer's `(click)` on the same element — both coalesced
 * by Angular into one native listener together with the button's — and one on
 * an ancestor, added in `beforeEach`. A plain `href` anchor covers the native
 * navigation half, and a native `<button>` host shows what stays as it was.
 * The last three carry a consumer `tabindex` the component must leave alone.
 */
@Component({
  imports: [MlvButton, RouterLink],
  template: `
    <div class="ancestor">
      <a
        mlvButton
        routerLink="/target"
        [disabled]="disabled()"
        [loading]="loading()"
        (click)="onOwnClick()"
        id="router"
        >Billing</a
      >
      <a
        mlvButton
        href="#plain"
        [disabled]="disabled()"
        [loading]="loading()"
        id="plain"
        >Plain</a
      >
      <button
        mlvButton
        type="button"
        [disabled]="disabled()"
        [loading]="loading()"
        id="native"
      >
        Save
      </button>
      <a
        mlvButton
        href="#focusable"
        tabindex="0"
        [disabled]="disabled()"
        id="focusable"
        >Focusable</a
      >
      <button mlvButton type="button" tabindex="-1" id="roving-static">
        Static
      </button>
      <button
        mlvButton
        type="button"
        [attr.tabindex]="rovingTabIndex()"
        id="roving-bound"
      >
        Bound
      </button>
    </div>
  `,
})
class DisabledAnchorButtonHost {
  readonly disabled = signal(true);
  readonly loading = signal(false);
  readonly rovingTabIndex = signal(0);
  readonly ownClicks = signal(0);

  onOwnClick(): void {
    this.ownClicks.update((n) => n + 1);
  }
}

/**
 * #460 — the `a[mlvLink]` defect (#309) on `a[mlvButton]`. The host `(click)`
 * guard called `preventDefault()` + `stopImmediatePropagation()`, which stops
 * neither `RouterLink.onClick` (it never reads `defaultPrevented`) nor anything
 * else in Angular's coalesced listener chain; and `[attr.disabled]` means
 * nothing on an anchor, so it kept its tab stop.
 */
describe('MlvButton disabled anchor activation', () => {
  let fixture: ComponentFixture<DisabledAnchorButtonHost>;
  let host: DisabledAnchorButtonHost;
  let router: Router;
  let ancestorClicks: number;

  const el = <T extends HTMLElement = HTMLAnchorElement>(id: string): T =>
    fixture.nativeElement.querySelector(`#${id}`);
  const textOf = (button: HTMLElement): HTMLElement =>
    button.querySelector('.mlv-button__text') as HTMLElement;
  const click = (target: Element): MouseEvent => {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  /**
   * A script-dispatched keydown activates nothing, so replay what a browser
   * does for Enter on an `<a href>`: dispatch the click unless the keydown was
   * cancelled (`click.spec.ts`'s `press()`).
   */
  const pressEnter = (target: Element): KeyboardEvent => {
    const keydown = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(keydown);
    if (!keydown.defaultPrevented) click(target);
    return keydown;
  };
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledAnchorButtonHost],
      providers: [
        provideMlvI18nTesting(),
        provideRouter([
          { path: '', component: BlankPage },
          { path: 'target', component: BlankPage },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DisabledAnchorButtonHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    ancestorClicks = 0;
    (fixture.nativeElement as HTMLElement)
      .querySelector('.ancestor')
      ?.addEventListener('click', () => ancestorClicks++);
  });

  it('keeps router.url when a disabled routerLink anchor button is activated', async () => {
    const started: string[] = [];
    const sub = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) started.push(event.url);
    });
    // `HTMLElement.click()` is what screen-reader activation and script
    // produce; the second click lands on the label span inside the anchor.
    el('router').click();
    click(textOf(el('router')));
    await fixture.whenStable();
    sub.unsubscribe();

    expect(started).toEqual([]);
    expect(router.url).toBe('/');
  });

  it('keeps router.url when Enter is pressed on a disabled routerLink anchor button', async () => {
    pressEnter(el('router'));
    await fixture.whenStable();

    expect(router.url).toBe('/');
  });

  it('blocks a loading anchor button the same way as a disabled one', async () => {
    host.disabled.set(false);
    host.loading.set(true);
    await settle();

    el('router').click();
    pressEnter(el('router'));
    await fixture.whenStable();

    expect(router.url).toBe('/');
    expect(host.ownClicks()).toBe(0);
    expect(click(el('plain')).defaultPrevented).toBe(true);
    expect(ancestorClicks).toBe(0);
  });

  it('cancels the native navigation of a disabled plain href, from the anchor and from its label', () => {
    expect(click(el('plain')).defaultPrevented).toBe(true);
    expect(click(textOf(el('plain'))).defaultPrevented).toBe(true);
  });

  it('stops the click before the listeners on the same element and on an ancestor', async () => {
    const raw = vi.fn();
    el('router').addEventListener('click', raw);
    el('router').click();
    click(textOf(el('plain')));
    await fixture.whenStable();

    expect(raw).not.toHaveBeenCalled();
    expect(host.ownClicks()).toBe(0);
    expect(ancestorClicks).toBe(0);
    expect(router.url).toBe('/');
  });

  it('runs before a same-element listener registered before the button existed — capture, not registration order', () => {
    // Every listener in the host above is registered after the component's
    // constructor, so a bubble-phase guard would beat them by order alone.
    // Here the consumer's listener is on the anchor first.
    const early = document.createElement('a');
    early.href = '#early';
    document.body.appendChild(early);
    const earlyListener = vi.fn();
    early.addEventListener('click', earlyListener);
    const ref = createComponent(MlvButton, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      hostElement: early,
    });
    try {
      ref.setInput('disabled', true);
      ref.changeDetectorRef.detectChanges();
      const event = click(early);

      expect(earlyListener).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    } finally {
      ref.destroy();
      early.remove();
    }
  });

  it('lets the same anchor navigate once re-enabled — the guard reads disabled and loading per click', async () => {
    host.disabled.set(false);
    await settle();

    click(el('router'));
    await fixture.whenStable();
    expect(router.url).toBe('/target');
    expect(host.ownClicks()).toBe(1);
    expect(ancestorClicks).toBe(1);
    // An enabled plain anchor's click must stay uncancelled, or the browser
    // does not follow `href`: Angular `preventDefault()`s any listener whose
    // expression evaluates to `false` (#309's `disabled() && …` trap).
    expect(click(el('plain')).defaultPrevented).toBe(false);
    expect(ancestorClicks).toBe(2);
  });

  it('follows an enabled anchor button on Enter — the keydown is left for the browser to turn into a click', async () => {
    host.disabled.set(false);
    await settle();

    const keydown = pressEnter(el('router'));
    await fixture.whenStable();

    expect(keydown.defaultPrevented).toBe(false);
    expect(router.url).toBe('/target');
  });

  it('takes a disabled or loading anchor out of the tab order without writing the invalid disabled attribute', async () => {
    const anchors = ['router', 'plain'] as const;
    const native = el<HTMLButtonElement>('native');

    for (const id of anchors) {
      expect(el(id).getAttribute('tabindex')).toBe('-1');
      expect(el(id).hasAttribute('disabled')).toBe(false);
      expect(el(id).getAttribute('aria-disabled')).toBe('true');
    }
    // A native button keeps `disabled`, which already removes its tab stop;
    // it gets no `tabindex` of the component's own.
    expect(native.hasAttribute('disabled')).toBe(true);
    expect(native.hasAttribute('tabindex')).toBe(false);

    host.disabled.set(false);
    await settle();
    for (const id of anchors) {
      expect(el(id).hasAttribute('tabindex')).toBe(false);
      expect(el(id).hasAttribute('aria-disabled')).toBe(false);
    }
    expect(native.hasAttribute('disabled')).toBe(false);

    host.loading.set(true);
    await settle();
    for (const id of anchors) {
      expect(el(id).getAttribute('tabindex')).toBe('-1');
      expect(el(id).hasAttribute('disabled')).toBe(false);
      expect(el(id).getAttribute('aria-busy')).toBe('true');
    }
    expect(native.hasAttribute('disabled')).toBe(true);
    expect(native.hasAttribute('tabindex')).toBe(false);
  });

  it("restores an anchor's own tabindex on re-enable and never writes one on a button host", async () => {
    // A host `[attr.tabindex]` binding would evaluate to `null` on every
    // button host and remove these — speed-dial actions and the calendar's
    // roving cells are `<button mlvButton>` with a tabindex of their own.
    expect(el('focusable').getAttribute('tabindex')).toBe('-1');
    expect(el('roving-static').getAttribute('tabindex')).toBe('-1');
    expect(el('roving-bound').getAttribute('tabindex')).toBe('0');

    host.disabled.set(false);
    await settle();
    expect(el('focusable').getAttribute('tabindex')).toBe('0');

    host.disabled.set(true);
    host.rovingTabIndex.set(-1);
    await settle();
    expect(el('focusable').getAttribute('tabindex')).toBe('-1');
    expect(el('roving-static').getAttribute('tabindex')).toBe('-1');
    expect(el('roving-bound').getAttribute('tabindex')).toBe('-1');
  });

  it('restores the tabindex a root host came with — createComponent with hostElement has no template to read it from', () => {
    // Angular Elements and dynamic hosting create the button on an existing
    // element. `HostAttributeToken` reads template attributes and is always
    // `null` for such a root host, so the tabindex it already carried is read
    // from the host itself. What happens across hydration, where the node's
    // `tabindex` may be the server's own `-1`, is `button-ssr.spec.ts`.
    const hosts = ['0', '-1'].map((tabIndex) => {
      const anchor = document.createElement('a');
      anchor.href = `#root-host-${tabIndex}`;
      anchor.setAttribute('tabindex', tabIndex);
      document.body.appendChild(anchor);
      const ref = createComponent(MlvButton, {
        environmentInjector: TestBed.inject(EnvironmentInjector),
        hostElement: anchor,
      });
      return { anchor, ref, tabIndex };
    });
    try {
      for (const { anchor, ref } of hosts) {
        ref.setInput('disabled', true);
        ref.changeDetectorRef.detectChanges();
        expect(anchor.getAttribute('tabindex')).toBe('-1');
      }
      for (const { anchor, ref, tabIndex } of hosts) {
        ref.setInput('disabled', false);
        ref.changeDetectorRef.detectChanges();
        expect(anchor.getAttribute('tabindex')).toBe(tabIndex);
      }
    } finally {
      for (const { anchor, ref } of hosts) {
        ref.destroy();
        anchor.remove();
      }
    }
  });

  it('removes the capture-phase guard on destroy', () => {
    const link = el('router');
    const plain = el('plain');
    const remove = vi.spyOn(link, 'removeEventListener');
    fixture.destroy();
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function), {
      capture: true,
    });
    // `disabled` is still `true`, so a surviving guard would stop these before
    // this listener, or cancel them. It cancels the `/target` one itself once
    // read, because jsdom implements no navigation beyond hash changes.
    const seen: boolean[] = [];
    link.addEventListener('click', (event) => {
      seen.push(event.defaultPrevented);
      event.preventDefault();
    });
    click(link);
    expect(seen).toEqual([false]);
    expect(click(plain).defaultPrevented).toBe(false);
  });

  it('has no axe violations with disabled anchor buttons', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations with loading anchor buttons', async () => {
    host.disabled.set(false);
    host.loading.set(true);
    await settle();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('MlvButton pressed styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      // Joined rather than a literal so Vite's static `new URL('literal',
      // import.meta.url)` asset analysis does not rewrite this into a
      // dev-server URL — see editor-block-handle.spec.ts for the same pattern.
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  /** Every `CSSStyleRule` the compiled stylesheet declares, in source order. */
  const rules = (): CSSStyleRule[] =>
    [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );

  it('renders a visible treatment for the native pressed state', () => {
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );

    // Matched against real elements rather than compared as a string: jsdom's
    // CSSOM re-serialises `[aria-pressed='true']` without the quotes a browser
    // keeps, so only the targeting itself is portable.
    const button = document.createElement('button');
    button.className = 'mlv-button';
    expect(pressed).toBeDefined();
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.setAttribute('aria-pressed', 'false');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.setAttribute('aria-pressed', 'true');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(true);

    // SF-R1: selection is its own token — a persistent pressed state never
    // resolves the pressed/`-active` fill.
    expect(pressed?.style.getPropertyValue('--mlv-btn-bg')).toBe(
      'var(--mlv-background-selected)',
    );
    expect(pressed?.style.getPropertyValue('--mlv-btn-text-color')).toBe(
      'var(--mlv-text-on-selected)',
    );
    // Routed through the component's own shadow variable rather than a direct
    // `box-shadow`, so the base `box-shadow: var(--mlv-btn-box-shadow, none)`
    // channel stays the single place the property is written. Custom property
    // values keep their raw token stream, so the source line wrap survives
    // into the declaration and is collapsed here rather than pinned.
    expect(
      pressed?.style
        .getPropertyValue('--mlv-btn-box-shadow')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe('inset 0 0 0 var(--mlv-stroke-width) var(--mlv-border-normal)');
  });

  it('keeps the pressed treatment while the pressed button is hovered', () => {
    // `.mlv-button:hover` and `.mlv-button[aria-pressed='true']` have equal
    // specificity, so a pressed button's background would otherwise depend on
    // which rule Sass emitted last. Pinning the hover custom property makes the
    // resolved background the same either way.
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );

    expect(pressed?.style.getPropertyValue('--mlv-btn-bg-hover')).toBe(
      'var(--mlv-background-selected-hover)',
    );
  });

  /**
   * A menu button that reflects an active state — an editor's heading trigger
   * showing that the caret sits in an H2 — must not claim the toggle-button
   * ARIA pattern on top of `aria-haspopup`/`aria-expanded`. `--selected` is the
   * visual half of `[aria-pressed='true']` with no ARIA of its own, so it has
   * to share the rule rather than re-declare the recipe next to it.
   */
  it('paints --selected with the same rule as the native pressed state', () => {
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );
    const button = document.createElement('button');
    button.className = 'mlv-button';

    expect(pressed).toBeDefined();
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.classList.add('mlv-button--selected');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(true);

    // Doubled class token, so the selected half carries the same (0,2,0) the
    // attribute half does and cannot lose to `--variant-transparent:hover`.
    expect(pressed?.selectorText).toMatch(
      /\.mlv-button\.mlv-button--selected\b/,
    );
  });

  it('emits --disabled as a doubled class positioned after [aria-pressed] (C2 regression)', () => {
    // A `getComputedStyle` cascade check here would be vacuous: jsdom
    // resolves custom properties by source order alone and ignores CSS
    // specificity entirely, so it would keep "passing" even if `--disabled`
    // were reverted to the old, lower-specificity `.mlv-button--disabled`
    // (0,1,0) — that selector already sat textually after `[aria-pressed]`
    // (0,2,0), which is exactly how the regression rendered a disabled+
    // pressed control as enabled-and-selected in a real browser despite
    // "looking" source-ordered correctly. Assert the two things that
    // actually determine the real-browser cascade winner instead: the
    // disabled rule's selector must carry two `.mlv-button` class tokens
    // (specificity (0,2,0), matching `[aria-pressed='true']`'s
    // class+attribute specificity) and must appear after the pressed rule
    // in source order — mirroring the segmented I1 fix's source-text style.
    const all = rules();
    const pressedIndex = all.findIndex(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );
    const disabledIndex = all.findIndex(({ selectorText }) =>
      /\.mlv-button\.mlv-button--disabled\b/.test(selectorText),
    );

    expect(pressedIndex).toBeGreaterThanOrEqual(0);
    expect(disabledIndex).toBeGreaterThanOrEqual(0);
    expect(disabledIndex).toBeGreaterThan(pressedIndex);

    // The disabled rule itself still resolves the declared-surface tokens
    // (this part of the cascade doesn't depend on specificity behaviour —
    // it's just reading the one matching rule's own declarations).
    const disabled = all[disabledIndex];
    expect(disabled.style.getPropertyValue('--mlv-btn-bg')).toBe(
      'var(--mlv-background-disabled)',
    );
    expect(disabled.style.getPropertyValue('--mlv-btn-text-color')).toBe(
      'var(--mlv-text-disabled)',
    );
  });
});

@Component({
  imports: [MlvButton, MlvButtonIcon, MlvButtonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="bare-icon" mlvButton [shape]="shape()" aria-label="Close">
      <svg></svg>
    </button>

    <button id="marked-icon" mlvButton shape="circle" aria-label="Close">
      <svg mlvButtonIcon></svg>
    </button>

    <button id="labelled" mlvButton shape="square">Save</button>

    <button id="text" mlvButton>Save</button>

    <button id="explicit" mlvButton shape="circle" variant="primary">
      <svg></svg>
    </button>

    <mlv-button-group>
      <button id="grouped" mlvButton shape="circle" aria-label="Close">
        <svg></svg>
      </button>
    </mlv-button-group>
  `,
})
class ButtonProjectionHost {
  readonly shape = signal<MlvButtonShape>('circle');
}

describe('MlvButton icon-only inference', () => {
  let fixture: ComponentFixture<ButtonProjectionHost>;

  const button = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonProjectionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonProjectionHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('infers icon-only from an icon projected without mlvButtonIcon', () => {
    expect(button('bare-icon').classList).toContain('mlv-button--icon-only');
  });

  it('keeps honouring the mlvButtonIcon directive', () => {
    expect(button('marked-icon').classList).toContain('mlv-button--icon-only');
  });

  it('does not treat a square button with a text label as icon-only', () => {
    expect(button('labelled').classList).not.toContain('mlv-button--icon-only');
  });

  it('never marks a default-shaped button icon-only', async () => {
    fixture.componentInstance.shape.set('default');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button('bare-icon').classList).not.toContain(
      'mlv-button--icon-only',
    );
  });
});

describe('MlvButton default variant', () => {
  let fixture: ComponentFixture<ButtonProjectionHost>;

  const button = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonProjectionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonProjectionHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('falls back to secondary for the icon-only shapes', () => {
    expect(button('bare-icon').classList).toContain(
      'mlv-button--variant-secondary',
    );
    expect(button('labelled').classList).toContain(
      'mlv-button--variant-secondary',
    );
  });

  it('keeps primary for every other shape', () => {
    expect(button('text').classList).toContain('mlv-button--variant-primary');
  });

  it('lets an explicit variant win over the shape default', () => {
    expect(button('explicit').classList).toContain(
      'mlv-button--variant-primary',
    );
  });

  it('lets an ancestor MLV_BUTTON_VARIANT win over the shape default', () => {
    // `mlv-button-group` always provides the token, so its own `primary`
    // fallback resolves before the button's shape-aware default.
    expect(button('grouped').classList).toContain(
      'mlv-button--variant-primary',
    );
  });

  it('follows a shape change back to primary', async () => {
    fixture.componentInstance.shape.set('pill');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button('bare-icon').classList).toContain(
      'mlv-button--variant-primary',
    );
  });
});

describe('MlvButton icon-only styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('sizes an unmarked icon in the label slot like a mlvButtonIcon one', () => {
    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) =>
        selectorText.includes('.mlv-button--icon-only .mlv-button__text'),
      );

    expect(rule).toBeDefined();
    expect(rule?.selectorText).toContain('svg:only-child');
    expect(rule?.style.getPropertyValue('width')).toBe(
      'var(--mlv-icon-font-size)',
    );
    expect(rule?.style.getPropertyValue('height')).toBe(
      'var(--mlv-icon-font-size)',
    );
  });
});

describe('MlvButton icon wrapper styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('fills an svg wrapped by a mlvButtonIcon-marked element (e.g. <span mlvButtonIcon><ng-content /></span>)', () => {
    // A projected, unannotated Lucide icon keeps its own fixed
    // `width="24" height="24"` attributes; sizing only the marked wrapper
    // (the `.mlv-button__icon` rule above) never reaches that child svg.
    // This rule makes the svg fill the wrapper's box instead, so it tracks
    // `--mlv-icon-font-size` (and therefore density) too.
    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) => selectorText === '.mlv-button__icon > svg');

    expect(rule).toBeDefined();
    expect(rule?.style.getPropertyValue('width')).toBe('100%');
    expect(rule?.style.getPropertyValue('height')).toBe('100%');
  });

  it('does not re-target an svg that is itself the marked element (e.g. mlv-button-close’s <svg mlvButtonIcon />)', () => {
    // `> svg` is a child combinator: it must never match the marked element
    // itself, only a child of it — otherwise a directly-marked svg (the far
    // more common form) would additionally match this rule.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('mlv-button__icon');

    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) => selectorText === '.mlv-button__icon > svg');

    expect(rule).toBeDefined();
    expect(svg.matches(rule?.selectorText ?? '')).toBe(false);
  });
});

@Component({
  imports: [MlvButton, MlvButtonIcon, MlvButtonBefore, MlvButtonAfter, LucideX],
  template: `
    <button mlvButton>Save</button>

    <button mlvButton [loading]="loading()">Submitting</button>

    <button mlvButton disabled>Delete</button>

    <button mlvButton shape="circle" aria-label="Add item">
      <svg lucideX mlvButtonIcon></svg>
    </button>

    <button mlvButton>
      <ng-template mlvButtonBefore>
        <svg lucideX mlvButtonIcon></svg>
      </ng-template>
      Export
      <ng-template mlvButtonAfter>
        <svg lucideX mlvButtonIcon></svg>
      </ng-template>
    </button>

    <a mlvButton href="#docs">Read the docs</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ButtonA11yHost {
  readonly loading = signal(false);
}

/**
 * Accessibility sweep — `button[mlvButton]` / `a[mlvButton]`.
 *
 * The states here are the ones that change what the host exposes, not just how
 * it looks: `loading` swaps the projected content for a `role="progressbar"`
 * and adds `disabled` + `aria-busy`; `disabled` removes the tab stop;
 * `shape="circle"` with no text is the icon-only inference, where the whole
 * accessible name is an `aria-label` beside an `aria-hidden` glyph; the
 * before/after slots put two more glyphs inside the name computation; and the
 * anchor selector renders a link rather than a button. Variant and density
 * change only classes, so they are not separate states for axe.
 */
describe('MlvButton accessibility', () => {
  let a11yFixture: ComponentFixture<ButtonA11yHost>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ButtonA11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    a11yFixture = TestBed.createComponent(ButtonA11yHost);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  });

  it('has no axe violations across shape, slot and element states', async () => {
    const host = a11yFixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.mlv-button')).toHaveLength(6);
    // The icon-only button is named only by aria-label; its glyph is hidden.
    const iconOnly = host.querySelector(
      '.mlv-button--icon-only',
    ) as HTMLButtonElement;
    expect(iconOnly.getAttribute('aria-label')).toBe('Add item');
    expect(iconOnly.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    // The anchor branch stays a link, not a synthesised button.
    const link = host.querySelector('a.mlv-button') as HTMLAnchorElement;
    expect(link.hasAttribute('role')).toBe(false);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations while loading', async () => {
    a11yFixture.componentInstance.loading.set(true);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
    const host = a11yFixture.nativeElement as HTMLElement;

    // State: a `role="progressbar"` now lives inside the button, which is
    // itself disabled and busy — the loader must carry its own name for that
    // role, and the button must still resolve one from its text.
    const loading = host.querySelector(
      '.mlv-button--loading',
    ) as HTMLButtonElement;
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.hasAttribute('disabled')).toBe(true);
    const loader = loading.querySelector('[role="progressbar"]') as HTMLElement;
    expect(loader.getAttribute('aria-label')).toBeTruthy();

    await expectNoAxeViolations(host);
  });
});

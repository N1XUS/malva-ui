import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  createComponent,
  EnvironmentInjector,
  signal,
} from '@angular/core';
import {
  NavigationStart,
  provideRouter,
  Router,
  RouterLink,
} from '@angular/router';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvLink } from './link';
import { MlvLinkAfter, MlvLinkBefore } from './link.directives';

@Component({
  template: `<a mlvLink href="/test">Test Link</a>`,
  imports: [MlvLink],
})
class TestHostComponent {}

describe('MlvLink', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const link = fixture.nativeElement.querySelector('a[mlvLink], a.mlv-link');
    expect(link).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a')).toBeTruthy();
  });
});

@Component({ template: '' })
class BlankPage {}

/**
 * A disabled link beside every listener that must not see its click: the
 * router's own and a consumer's `(click)` on the same element — both of which
 * Angular coalesces into one native listener — and one on an ancestor, added
 * in `beforeEach`. A plain `href` link covers the native navigation half.
 */
@Component({
  imports: [MlvLink, RouterLink],
  template: `
    <div class="ancestor">
      <a
        mlvLink
        routerLink="/target"
        [disabled]="disabled()"
        (click)="onOwnClick()"
        id="router"
        >Billing</a
      >
      <a mlvLink href="#plain" [disabled]="disabled()" id="plain">Plain</a>
    </div>
  `,
})
class DisabledLinkHost {
  readonly disabled = signal(true);
  readonly ownClicks = signal(0);

  onOwnClick(): void {
    this.ownClicks.update((n) => n + 1);
  }
}

describe('MlvLink disabled activation', () => {
  let fixture: ComponentFixture<DisabledLinkHost>;
  let host: DisabledLinkHost;
  let router: Router;
  let ancestorClicks: number;

  const anchor = (id: 'router' | 'plain'): HTMLAnchorElement =>
    fixture.nativeElement.querySelector(`#${id}`);
  const textOf = (link: HTMLAnchorElement): HTMLElement =>
    link.querySelector('.mlv-link__text') as HTMLElement;
  const click = (target: Element): MouseEvent => {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledLinkHost],
      providers: [
        provideRouter([
          { path: '', component: BlankPage },
          { path: 'target', component: BlankPage },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DisabledLinkHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    ancestorClicks = 0;
    (fixture.nativeElement as HTMLElement)
      .querySelector('.ancestor')
      ?.addEventListener('click', () => ancestorClicks++);
  });

  it('keeps router.url when a disabled routerLink is activated', async () => {
    const started: string[] = [];
    const sub = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) started.push(event.url);
    });
    // `HTMLElement.click()` is what screen-reader activation and script
    // produce; the second click lands on the text span inside the anchor.
    anchor('router').click();
    click(textOf(anchor('router')));
    await fixture.whenStable();
    sub.unsubscribe();

    expect(started).toEqual([]);
    expect(router.url).toBe('/');
  });

  it('keeps router.url when Enter is pressed on a disabled routerLink', async () => {
    // A script-dispatched keydown activates nothing, so replay what a browser
    // does for Enter on an `<a href>`: dispatch the click unless the keydown
    // was cancelled (`click.spec.ts`'s `press()`).
    const link = anchor('router');
    const keydown = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(keydown);
    if (!keydown.defaultPrevented) click(link);
    await fixture.whenStable();

    expect(router.url).toBe('/');
  });

  it('cancels the native navigation of a disabled plain href, from the anchor and from its text', () => {
    expect(click(anchor('plain')).defaultPrevented).toBe(true);
    expect(click(textOf(anchor('plain'))).defaultPrevented).toBe(true);
  });

  it('stops the click before the listeners on the same element and on an ancestor', async () => {
    const raw = vi.fn();
    anchor('router').addEventListener('click', raw);
    anchor('router').click();
    click(textOf(anchor('plain')));
    await fixture.whenStable();

    expect(raw).not.toHaveBeenCalled();
    expect(host.ownClicks()).toBe(0);
    expect(ancestorClicks).toBe(0);
    expect(router.url).toBe('/');
  });

  it('runs before a same-element listener registered before the link existed — capture, not registration order', () => {
    // Every listener in the host above is registered after the component's
    // constructor, so a bubble-phase guard would beat them by order alone.
    // Here the consumer's listener is on the anchor first.
    const early = document.createElement('a');
    early.href = '#early';
    early.textContent = 'Early';
    document.body.appendChild(early);
    const earlyListener = vi.fn();
    early.addEventListener('click', earlyListener);
    const ref = createComponent(MlvLink, {
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

  it('lets the same link navigate once re-enabled — the guard reads disabled per click', async () => {
    host.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    click(anchor('router'));
    await fixture.whenStable();
    expect(router.url).toBe('/target');
    expect(host.ownClicks()).toBe(1);
    expect(ancestorClicks).toBe(1);
    // An enabled plain link's click must stay uncancelled, or the browser does
    // not follow `href`: a host listener whose expression evaluates to `false`
    // (`disabled() && …` while enabled) is `preventDefault()`ed by Angular.
    expect(click(anchor('plain')).defaultPrevented).toBe(false);
    expect(ancestorClicks).toBe(2);
  });

  it('follows an enabled link on Enter — the keydown is left for the browser to turn into a click', async () => {
    host.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const link = anchor('router');
    const keydown = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(keydown);
    if (!keydown.defaultPrevented) click(link);
    await fixture.whenStable();

    expect(keydown.defaultPrevented).toBe(false);
    expect(router.url).toBe('/target');
  });

  it('keeps href, and so the link role, while disabled', () => {
    for (const [id, href] of [
      ['router', '/target'],
      ['plain', '#plain'],
    ] as const) {
      expect(anchor(id).getAttribute('href')).toBe(href);
      expect(anchor(id).getAttribute('aria-disabled')).toBe('true');
      expect(anchor(id).getAttribute('tabindex')).toBe('-1');
    }
  });

  it('leaves Space alone, disabled or not — Space is not link activation', async () => {
    const space = (): boolean => {
      const keydown = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      anchor('router').dispatchEvent(keydown);
      return keydown.defaultPrevented;
    };
    expect(space()).toBe(false);
    host.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(space()).toBe(false);
  });

  it('removes the capture-phase guard on destroy', () => {
    const link = anchor('router');
    const plain = anchor('plain');
    const remove = vi.spyOn(link, 'removeEventListener');
    fixture.destroy();
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function), {
      capture: true,
    });
    // `disabled` is still `true`, so a surviving guard would cancel these.
    expect(click(link).defaultPrevented).toBe(false);
    expect(click(plain).defaultPrevented).toBe(false);
  });

  it('has no axe violations with a disabled routerLink', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

/**
 * Accessibility sweep.
 *
 * `a[mlvLink]` keeps the native anchor, so the interesting states are the two
 * it adds on top of it: the `disabled` variant, which is still an `<a href>`
 * but carries `aria-disabled="true"` and `tabindex="-1"` (activation is
 * suppressed by a click guard, not by removing the link, so the element has to
 * keep announcing that it is off), and the before/after slots from
 * `apps/docs/src/app/pages/link/examples/2`, which wrap the text in extra
 * elements and are where a glyph could steal or dilute the link's name.
 */
describe('MlvLink accessibility', () => {
  @Component({
    imports: [MlvLink, MlvLinkBefore, MlvLinkAfter],
    template: `
      <a mlvLink href="#">Default Link</a>
      <a mlvLink href="#" variant="subtle">Subtle Link</a>
      <a mlvLink href="#" variant="emphasized">Emphasized Link</a>
      <a mlvLink href="#" [disabled]="true" id="off">Disabled Link</a>

      <a mlvLink href="#">
        <svg *mlvLinkBefore aria-hidden="true"></svg>
        Previous
      </a>
      <a mlvLink href="#">
        Next
        <svg *mlvLinkAfter aria-hidden="true"></svg>
      </a>
    `,
  })
  class LinkA11yHost {}

  it('has no axe violations across variants, slots and the disabled state', async () => {
    await TestBed.configureTestingModule({
      imports: [LinkA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(LinkA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: six anchors, each with discernible text; the disabled one is out
    // of the tab order and says so, and both slot wrappers rendered.
    const links = [...host.querySelectorAll('a.mlv-link')];
    expect(links).toHaveLength(6);
    expect(links.every((a) => (a.textContent ?? '').trim().length > 0)).toBe(
      true,
    );
    const off = host.querySelector('#off') as HTMLAnchorElement;
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(off.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelectorAll('.mlv-link__side')).toHaveLength(2);

    await expectNoAxeViolations(host);
  });
});

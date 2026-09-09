import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { vi } from 'vitest';

import { MlvDrawerSection } from '../drawer-section/drawer-section';
import { MlvDrawerSections } from './drawer-sections';
import { MlvDrawerSectionsService } from '../drawer-sections.service';

@Component({
  imports: [MlvDrawerSections, MlvDrawerSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MlvDrawerSectionsService],
  template: `
    <mlv-drawer-sections />
    @for (label of labels(); track label) {
      <!-- [id] feeds the directive input; [attr.id] writes the DOM id the
           service's IntersectionObserver callback keys entries by. Both are
           needed, and both are what every real consumer ships: a static
           id="meta" attribute is simultaneously a DOM attribute and a static
           input binding. See the apps/docs drawer examples. -->
      <section mlvDrawerSection [id]="label" [attr.id]="label" [label]="label">
        Content
      </section>
    }
  `,
})
class SectionsHostComponent {
  readonly labels = signal<string[]>([]);
}

describe('MlvDrawerSections', () => {
  let fixture: ComponentFixture<SectionsHostComponent>;
  let host: SectionsHostComponent;

  /** Elements handed to `IntersectionObserver.observe` by the double below. */
  const observedElements: Element[] = [];

  /**
   * Live doubles, newest last — `initObservers()` disconnects and rebuilds on
   * every section change, so only the last one is the service's current
   * observer.
   */
  const observers: IntersectionObserverDouble[] = [];

  /**
   * Recording `IntersectionObserver` double. jsdom ships none, and
   * `MlvDrawerSectionsService` constructs one from a render hook to track the
   * scrolled section.
   *
   * It also *emits*, through {@link flushIntersections}: a real observer
   * invokes its callback once per observed target right after `observe()`, and
   * the trigger's visible text is `currentScrolledSection()?.label()`, so a
   * double that never fires leaves the trigger permanently unnamed — an
   * artefact of the harness that an axe sweep would report as a `button-name`
   * defect of the component.
   */
  class IntersectionObserverDouble {
    constructor(private readonly _callback: IntersectionObserverCallback) {}

    readonly targets: Element[] = [];

    observe(target: Element): void {
      this.targets.push(target);
      observedElements.push(target);
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      this.targets.length = 0;
    }

    /** Delivers one fully-visible entry per observed target. */
    emit(): void {
      if (this.targets.length === 0) return;
      this._callback(
        this.targets.map((target) => ({
          target,
          isIntersecting: true,
          intersectionRatio: 1,
        })) as unknown as IntersectionObserverEntry[],
        this as unknown as IntersectionObserver,
      );
    }
  }

  /** Fires the service's current observer, naming the trigger button. */
  async function flushIntersections(): Promise<void> {
    observers.at(-1)?.emit();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeAll(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class extends IntersectionObserverDouble {
        constructor(callback: IntersectionObserverCallback) {
          super(callback);
          observers.push(this);
        }
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    observers.length = 0;
    fixture = TestBed.createComponent(SectionsHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function trigger(): HTMLElement | null {
    return fixture.nativeElement.querySelector('mlv-drawer-sections button');
  }

  it('renders nothing when no section is registered', async () => {
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });

  it('renders nothing for a single section — there is nowhere to navigate', async () => {
    host.labels.set(['Meta']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });

  it('renders the navigator once there is more than one section', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).not.toBeNull();
    expect(trigger()?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('observes every registered section in a browser', async () => {
    // The service moved off a constructor `effect` onto `afterRenderEffect`
    // so it cannot construct an `IntersectionObserver` during server
    // rendering (see the SSR smoke suite in `@malva-ui/core`). Render hooks do
    // not run on the server — but they must still run here, otherwise the fix
    // would have silently turned scroll tracking off in the browser too.
    observedElements.length = 0;
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();

    // The distinct set, not the call count: one section observed twice across
    // two render passes is still correct behaviour, and asserting `2` calls
    // would fail on a scheduling change that regressed nothing.
    const sections = fixture.nativeElement.querySelectorAll('section');
    const observed = new Set(observedElements);

    expect(observed.has(sections[0])).toBe(true);
    expect(observed.has(sections[1])).toBe(true);
  });

  /** Reads the rows currently rendered into the CDK overlay. */
  function overlayRows(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        '.cdk-overlay-container mlv-list-item',
      ),
    );
  }

  /**
   * Opens the trigger by the named gesture and returns the rows rendered into
   * the CDK overlay. The panel is portaled out of the fixture, so it is
   * queried from the document, not from `fixture.nativeElement`.
   *
   * It **throws** rather than returning an empty array when the menu did not
   * open. Every caller below is asserting something about the open panel, so a
   * silent `[]` would let them all pass vacuously — `.map()` and
   * `expectNoAxeViolations` are both perfectly happy with nothing there.
   */
  async function openMenu(
    gesture: 'hover' | 'click' = 'hover',
  ): Promise<HTMLElement[]> {
    const button = trigger();
    if (!button) throw new Error('openMenu(): the trigger is not rendered.');

    if (gesture === 'hover') {
      button.dispatchEvent(new MouseEvent('mouseenter'));
    } else {
      // A real browser turns Enter and Space on a `<button>` into a click.
      button.click();
    }
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = overlayRows();
    if (rows.length === 0) {
      throw new Error(
        `openMenu('${gesture}'): the menu did not open — no rows in the overlay.`,
      );
    }
    return rows;
  }

  it('gives every row the menuitem role its role="menu" parent requires', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushIntersections();

    const rows = await openMenu();

    expect(
      document
        .querySelector('.cdk-overlay-container mlv-list')
        ?.getAttribute('role'),
    ).toBe('menu');
    expect(rows).toHaveLength(2);
    // The *resolved* attribute, not the `itemRole` input: `MlvClick` co-hosts a
    // `[attr.role]` binding on this element, and on first render both write —
    // the directive's running last, so it wins the tie. Before #223 this read
    // `button`, and `[hostRole]="null"` — the first fix proposed — removes the
    // attribute outright rather than deferring to `itemRole`. Writing the same
    // value through both is what makes the row correct either way; the full
    // ordering contract is pinned in `click.spec.ts`.
    expect(rows.map((row) => row.getAttribute('role'))).toEqual([
      'menuitem',
      'menuitem',
    ]);
  });

  /**
   * WCAG 2.1.1, level A. The trigger shipped `triggerOn="hover"`, and
   * `MlvPopupTrigger.onClick()` gates on `hasTrigger('click')` while
   * `onFocus()` gates on `hasTrigger('focus')` — so for a hover-only trigger
   * focus, Enter, Space and click were all no-ops and the menu could only ever
   * be opened with a pointer. `['hover', 'click']` is the fix: the trigger is a
   * real `<button>`, whose Enter/Space activation *is* a click event.
   *
   * Dispatching `click` is therefore the honest keyboard simulation here —
   * jsdom does not synthesise the click from a `keydown`, but a browser does.
   */
  it('opens the menu from the keyboard, not only on hover', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushIntersections();

    const button = trigger();
    button?.focus();
    button?.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    await fixture.whenStable();

    // Focus alone must not open it: `focus` is deliberately not a trigger
    // type here, because its `blur` half would close the panel the moment
    // focus moved toward the rows.
    expect(overlayRows()).toHaveLength(0);

    const rows = await openMenu('click');

    expect(rows).toHaveLength(2);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps every row keyboard-reachable and Enter-activatable', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushIntersections();

    const sections = fixture.debugElement.query(By.directive(MlvDrawerSections))
      .componentInstance as MlvDrawerSections;
    const navigate = vi.spyOn(sections, 'navigateToSection');

    const rows = await openMenu('click');

    // KNOWN-INCOMPLETE, pinned deliberately. The WAI-ARIA menu pattern the
    // `role="menu"` claims wants a *roving* tabindex — one tab stop for the
    // whole menu, arrow keys between items, Home/End, Escape back to the
    // trigger — which is what `MlvMenuItem` implements. This menu has no key
    // manager, so `tabindex="0"` on every row is the only thing that makes the
    // rows reachable at all; asserting it stops a change to `-1` from silently
    // restoring the keyboard blocker above. It is not the end state: the
    // rebuild onto `MlvMenuItem` is tracked as the #223 follow-up.
    expect(rows.map((row) => row.getAttribute('tabindex'))).toEqual(['0', '0']);

    rows[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations with the section menu open', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushIntersections();

    // `openMenu` throws on an empty overlay, so this sweep cannot pass with
    // the menu closed — which it did while the helper returned `[]`.
    expect(await openMenu()).toHaveLength(2);

    // `document.body`, not the fixture: it covers the trigger *and* the
    // portaled panel, so the trigger/panel relationship is swept as one.
    await expectNoAxeViolations(document.body);
  });

  it('hides the navigator again when sections drop back to one', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger()).not.toBeNull();

    host.labels.set(['Meta']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });
});

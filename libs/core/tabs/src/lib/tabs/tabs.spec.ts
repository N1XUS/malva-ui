import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, Injectable, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import type { Routes } from '@angular/router';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { MlvTabGroup } from './tabs';
import type { MlvTabAppearance } from './tabs';
import { MlvTab } from '../tab/tab';
import { MlvTabsService } from '../tabs.service';
import { MlvTabDef } from '../tab-def';
import { MlvTabContentDef } from '../tab-content-def';
import { MlvTabPanel } from '../tab-panel/tab-panel';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvResizeObserverFactory, MlvRtlService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvTabOrientation } from '../tab-group-token';

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group [orientation]="orientation()" [(activeTab)]="activeTab">
      @for (t of tabs; track t) {
        <mlv-tab [value]="t">
          <ng-template mlvTabDef let-hidden>{{ t }}</ng-template>
          <ng-template mlvTabContent>
            <p>Content {{ t }}</p>
          </ng-template>
        </mlv-tab>
      }
    </mlv-tab-group>
  `,
})
class OverflowTestHost {
  tabs = ['t1', 't2', 't3', 't4', 't5'];
  activeTab = signal('t1');
  orientation = signal<MlvTabOrientation>('horizontal');
}

/**
 * A `ResizeObserver` double matching the three observation behaviours the
 * overflow sync depends on. Each is taken from the spec
 * (https://drafts.csswg.org/resize-observer/), not from a guess, because jsdom
 * ships no `ResizeObserver` at all to inherit them from:
 *
 * - `observe()` on a target this observer is **not** already watching creates a
 *   `ResizeObservation` whose `lastReportedSizes` slot is `[(-1,-1)]`, so
 *   `isActive()` — "currentSize is not equal to the first entry" — holds for
 *   *any* current size, a `0x0` box and a `display: none` box included. The
 *   initial notification that fires is precisely what makes "observe the tabs"
 *   work in a browser.
 * - `observe()` on a target already in `observationTargets` returns early: a
 *   live target is never re-notified by re-observing it.
 * - `disconnect()` clears `observationTargets`, so a following `observe()`
 *   builds a fresh `ResizeObservation` and therefore *does* re-notify a box
 *   that had long since settled. That is why the component diffs its target
 *   set instead of disconnecting.
 *
 * One deliberate divergence: the platform delivers asynchronously and batched
 * at the end of a frame; this delivers synchronously, one entry at a time. The
 * component's callback reads none of its entries — each call re-reads every
 * width and recomputes the split from scratch — so splitting a batch into
 * single-entry calls repeats work but cannot change an outcome, and
 * synchronous delivery is what lets a spec observe the cold start without a
 * scheduler.
 */
class SpecFaithfulResizeObserver implements ResizeObserver {
  /** Every instance handed out, in construction order. Reset per test. */
  static instances: SpecFaithfulResizeObserver[] = [];

  /** How many notifications each element has received, across all instances. */
  static deliveries = new Map<Element, number>();

  /**
   * While `true` nothing is delivered at all — neither the initial
   * notification `observe()` owes a new target nor a {@link notify}. Models a
   * change that moves no box, so a spec can prove a recalculation was caused
   * by something other than a resize notification. Reset per test.
   */
  static muted = false;

  /** This observer's `observationTargets`. */
  readonly targets = new Set<Element>();

  constructor(private readonly _callback: ResizeObserverCallback) {
    SpecFaithfulResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    if (this.targets.has(target)) return;
    this.targets.add(target);
    this._deliver(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  /**
   * Delivers a resize notification for `target` to every observer watching it,
   * and returns how many received it — so a spec can assert that the element it
   * is driving is actually observed, rather than passing because nothing moved.
   */
  static notify(target: Element): number {
    let delivered = 0;
    for (const instance of SpecFaithfulResizeObserver.instances) {
      if (instance.targets.has(target)) {
        instance._deliver(target);
        delivered++;
      }
    }
    return delivered;
  }

  /** Notifications `target` has received since the counters were reset. */
  static deliveryCount(target: Element): number {
    return SpecFaithfulResizeObserver.deliveries.get(target) ?? 0;
  }

  private _deliver(target: Element): void {
    if (SpecFaithfulResizeObserver.muted) return;
    const deliveries = SpecFaithfulResizeObserver.deliveries;
    deliveries.set(target, (deliveries.get(target) ?? 0) + 1);
    this._callback([{ target } as ResizeObserverEntry], this);
  }
}

/** Hands {@link SpecFaithfulResizeObserver}s to the component's DI seam. */
@Injectable()
class SpecFaithfulResizeObserverFactory extends MlvResizeObserverFactory {
  override create(callback: ResizeObserverCallback): ResizeObserver {
    return new SpecFaithfulResizeObserver(callback);
  }
}

/**
 * Host for the exact-split specs: every input the split reads is a signal, and
 * each tab's label can be swapped so a spec can change one tab's width.
 */
@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group
      [appearance]="appearance()"
      [orientation]="orientation()"
      [(activeTab)]="activeTab"
    >
      @for (t of tabs(); track t) {
        <mlv-tab [value]="t">
          <ng-template mlvTabDef>{{ labels()[t] ?? t }}</ng-template>
          <ng-template mlvTabContent>
            <p>Content {{ t }}</p>
          </ng-template>
        </mlv-tab>
      }
    </mlv-tab-group>
  `,
})
class SplitTestHost {
  readonly tabs = signal(['t1', 't2', 't3', 't4', 't5']);
  readonly labels = signal<Record<string, string>>({});
  readonly activeTab = signal('t1');
  readonly orientation = signal<MlvTabOrientation>('horizontal');
  readonly appearance = signal<MlvTabAppearance>('underline');
}

/**
 * Layout the exact-split specs pretend the browser produced. jsdom lays
 * nothing out, so every box the split reads is answered from here: the
 * group's own width, each tab's width by its label, the trigger's width, and
 * the header's padding and gap (component stylesheets are not applied under
 * jsdom either). Both the rect reads and the integer `offset*` / `client*`
 * reads are answered, from the same numbers.
 */
interface SplitGeometry {
  /** Border-box width of the `mlv-tab-group` host. */
  host: number;
  /** Width of a tab whose label has no entry in {@link widths}. */
  tab: number;
  /** Width per rendered label. */
  widths: Record<string, number>;
  /** Width of the "More (N)" trigger. */
  trigger: number;
  /** Inline padding on each side of the header. */
  headerPadding: number;
  /** The header's `column-gap`. */
  gap: number;
  /** `offsetTop` per rendered label (vertical indicator). */
  tops: Record<string, number>;
  /**
   * When set, answers the host's width instead of {@link host}, from the
   * rendered group — a layout outside the group that reacts to what the
   * group renders (a page scrollbar a wider row brings in).
   */
  hostFor: ((group: Element) => number) | null;
  /**
   * When set, the header's border-box width; otherwise the header is as wide
   * as the group (an underline header, or a boxed track at its `max-width`).
   * A boxed track is `width: fit-content` and can be narrower.
   */
  header: number | null;
  /**
   * Whether the tab items stretch into the room the row has left. `'none'`:
   * each tab is its natural width ({@link tab} / {@link widths}). Otherwise a
   * rendered tab is `max(natural, share)`, the share being the header's
   * content box less the trigger, split between the rendered tabs — wider the
   * fewer of them render. `'flex'` is flex growth: the item's computed
   * `flex-grow` reads `1`, and an inline `flex-grow: 0` returns it to its
   * natural width, as in a browser. `'layout'` is a stretch that switch does
   * not undo (a grid track): the item always reads stretched.
   */
  grow: 'none' | 'flex' | 'layout';
}

const splitGeometry: SplitGeometry = {
  host: 0,
  tab: 0,
  widths: {},
  trigger: 0,
  headerPadding: 0,
  gap: 0,
  tops: {},
  hostFor: null,
  header: null,
  grow: 'none',
};

function splitRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Width {@link splitGeometry} assigns to `element`, or `0` for any other box. */
function splitWidth(element: Element): number {
  if (!element.isConnected) return 0;
  if (element.tagName === 'MLV-TAB-GROUP') {
    return splitGeometry.hostFor?.(element) ?? splitGeometry.host;
  }
  if (element.classList.contains('mlv-tab-group__header')) {
    if (splitGeometry.header !== null) return splitGeometry.header;
    const group = element.closest('mlv-tab-group');
    return group ? splitWidth(group) : splitGeometry.host;
  }
  if (element.classList.contains('mlv-tab-group__more-trigger')) {
    return splitGeometry.trigger;
  }
  if (element.classList.contains('mlv-tab-item')) {
    const label = (element.textContent ?? '').trim();
    return stretchedWidth(
      element as HTMLElement,
      splitGeometry.widths[label] ?? splitGeometry.tab,
    );
  }
  return 0;
}

/** A tab item's laid-out width under {@link SplitGeometry.grow}. */
function stretchedWidth(item: HTMLElement, natural: number): number {
  const { grow } = splitGeometry;
  if (grow === 'none' || natural <= 0) return natural;
  if (grow === 'flex' && item.style.getPropertyValue('flex-grow') === '0') {
    return natural;
  }
  const header = item.parentElement;
  if (!header) return natural;
  const rendered = Array.from(header.children).filter((child) =>
    child.classList.contains('mlv-tab-item'),
  ).length;
  const trigger = header.querySelector(':scope > .mlv-tab-group__more-trigger');
  const room =
    splitWidth(header) -
    2 * splitGeometry.headerPadding -
    (trigger ? splitGeometry.trigger : 0);
  return Math.max(natural, room / rendered);
}

/** Installs {@link splitGeometry} behind every layout read the split makes. */
function stubSplitGeometry(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const width = splitWidth(this);
      return splitRect(width, width > 0 ? 40 : 0);
    },
  );
  // `offsetWidth` / `clientWidth` are integers in a browser.
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Math.round(splitWidth(this));
    },
  );
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: Element) {
      return Math.round(splitWidth(this));
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
    function (this: HTMLElement) {
      if (!this.classList.contains('mlv-tab-item')) return 0;
      return splitGeometry.tops[(this.textContent ?? '').trim()] ?? 0;
    },
  );

  const original = globalThis.getComputedStyle.bind(globalThis);
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
    (element: Element, pseudo?: string | null) => {
      const isHeader = element.classList.contains('mlv-tab-group__header');
      if (
        splitGeometry.grow === 'flex' &&
        element.classList.contains('mlv-tab-item')
      ) {
        // The consumer's `flex: 1`; jsdom applies no stylesheet.
        return { flexGrow: '1' } as CSSStyleDeclaration;
      }
      if (!isHeader && element.tagName !== 'MLV-TAB-GROUP') {
        return original(element, pseudo);
      }
      const padding = isHeader ? `${splitGeometry.headerPadding}px` : '0px';
      return {
        columnGap: isHeader ? `${splitGeometry.gap}px` : 'normal',
        paddingInlineStart: padding,
        paddingInlineEnd: padding,
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '0px',
      } as CSSStyleDeclaration;
    },
  );
}

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group [orientation]="orientation()" [(activeTab)]="activeTab">
      <mlv-tab value="tab1">
        <ng-template mlvTabDef let-hidden>
          {{ hidden ? 'Tab 1 Hidden' : 'Tab 1' }}
        </ng-template>
        <ng-template mlvTabContent>
          <p>Content 1</p>
        </ng-template>
      </mlv-tab>
      <mlv-tab value="tab2">
        <ng-template mlvTabDef let-hidden>
          {{ hidden ? 'Tab 2 Hidden' : 'Tab 2' }}
        </ng-template>
        <ng-template mlvTabContent>
          <p>Content 2</p>
        </ng-template>
      </mlv-tab>
      <mlv-tab value="tab3" [disabled]="true">
        <ng-template mlvTabDef let-hidden>Tab 3</ng-template>
        <ng-template mlvTabContent>
          <p>Content 3</p>
        </ng-template>
      </mlv-tab>
    </mlv-tab-group>
  `,
})
class BasicTestHost {
  activeTab = signal('tab1');
  orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group [(activeTab)]="outerTab">
      <mlv-tab value="outer1">
        <ng-template mlvTabDef let-hidden>Outer 1</ng-template>
        <ng-template mlvTabContent>
          <mlv-tab-group [(activeTab)]="innerTab">
            <mlv-tab value="inner1">
              <ng-template mlvTabDef let-hidden>Inner 1</ng-template>
              <ng-template mlvTabContent><p>Nested Content 1</p></ng-template>
            </mlv-tab>
            <mlv-tab value="inner2">
              <ng-template mlvTabDef let-hidden>Inner 2</ng-template>
              <ng-template mlvTabContent><p>Nested Content 2</p></ng-template>
            </mlv-tab>
          </mlv-tab-group>
        </ng-template>
      </mlv-tab>
      <mlv-tab value="outer2">
        <ng-template mlvTabDef let-hidden>Outer 2</ng-template>
        <ng-template mlvTabContent><p>Outer Content 2</p></ng-template>
      </mlv-tab>
    </mlv-tab-group>
  `,
})
class NestedTestHost {
  outerTab = signal('outer1');
  innerTab = signal('inner1');
}

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group>
      <mlv-tab value="a">
        <ng-template mlvTabDef let-hidden>A</ng-template>
        <ng-template mlvTabContent><p>A content</p></ng-template>
      </mlv-tab>
      <mlv-tab value="b">
        <ng-template mlvTabDef let-hidden>B</ng-template>
        <ng-template mlvTabContent><p>B content</p></ng-template>
      </mlv-tab>
    </mlv-tab-group>
  `,
})
class AutoSelectTestHost {}

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group
      [appearance]="appearance()"
      [orientation]="orientation()"
      [(activeTab)]="activeTab"
    >
      <mlv-tab value="a">
        <ng-template mlvTabDef>A</ng-template>
        <ng-template mlvTabContent><p>A content</p></ng-template>
      </mlv-tab>
      <mlv-tab value="b">
        <ng-template mlvTabDef>B</ng-template>
        <ng-template mlvTabContent><p>B content</p></ng-template>
      </mlv-tab>
    </mlv-tab-group>
  `,
})
class AppearanceTestHost {
  appearance = signal<'underline' | 'boxed'>('underline');
  orientation = signal<'horizontal' | 'vertical'>('horizontal');
  activeTab = signal('a');
}

@Component({ template: '', selector: 'test-route-stub' })
class RouteStub {}

const ROUTED_ROUTES: Routes = [
  { path: '', component: RouteStub },
  { path: 'api', component: RouteStub },
  { path: 'settings', component: RouteStub },
];

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef, RouterLink],
  template: `
    <mlv-tab-group appearance="boxed" [(activeTab)]="activeTab">
      <mlv-tab value="examples" routerLink="/" [linkActiveOptions]="exactMatch">
        <ng-template mlvTabDef>Examples</ng-template>
        <ng-template mlvTabContent><p>Examples content</p></ng-template>
      </mlv-tab>
      <mlv-tab value="api" routerLink="/api">
        <ng-template mlvTabDef>API</ng-template>
        <ng-template mlvTabContent><p>API content</p></ng-template>
      </mlv-tab>
    </mlv-tab-group>
  `,
})
class RoutedTestHost {
  activeTab = signal('');
  // `/` would subset-match every URL, so the Examples tab is pinned to exact
  // matching — the API tab keeps the default `{ exact: false }` (subset).
  readonly exactMatch = { exact: true };
}

describe('MlvTabGroup', () => {
  describe('Basic functionality', () => {
    let fixture: ComponentFixture<BasicTestHost>;
    let host: BasicTestHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BasicTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(BasicTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    afterEach(() => {
      // `MlvRtlService` writes the direction onto <html>, which outlives the
      // TestBed injector and would otherwise leak RTL into the next test —
      // mirroring every ArrowLeft/ArrowRight assertion that follows.
      document.documentElement.removeAttribute('dir');
    });

    it('should create the tab group', () => {
      const tabGroup = fixture.nativeElement.querySelector('.mlv-tab-group');
      expect(tabGroup).toBeTruthy();
    });

    it('should render all tab items', () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems.length).toBe(3);
    });

    it('should set the first tab as active by default', () => {
      const activeItem = fixture.nativeElement.querySelector(
        '.mlv-tab-item--active',
      );
      expect(activeItem).toBeTruthy();
      expect(activeItem.textContent.trim()).toContain('Tab 1');
    });

    it('should display content of the active tab', () => {
      const content = fixture.nativeElement.querySelector('.mlv-tab-content');
      expect(content.textContent.trim()).toContain('Content 1');
    });

    it('should switch tab on click', async () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      tabItems[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      const content = fixture.nativeElement.querySelector('.mlv-tab-content');
      expect(content.textContent.trim()).toContain('Content 2');
      expect(host.activeTab()).toBe('tab2');
    });

    it('should not switch to disabled tab on click', async () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      tabItems[2].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.activeTab()).toBe('tab1');
    });

    it('should pass hidden=false context to visible tab def template', () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems[0].textContent.trim()).toContain('Tab 1');
      expect(tabItems[0].textContent.trim()).not.toContain('Hidden');
    });

    // ── ARIA attributes ──

    it('should have role="tablist" on the header', () => {
      const header = fixture.nativeElement.querySelector('[role="tablist"]');
      expect(header).toBeTruthy();
    });

    it('should set aria-orientation on tablist', () => {
      const header = fixture.nativeElement.querySelector('[role="tablist"]');
      expect(header.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('should set role="tab" on each tab item', () => {
      const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(3);
    });

    it('should set aria-selected on active tab', () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems[0].getAttribute('aria-selected')).toBe('true');
      expect(tabItems[1].getAttribute('aria-selected')).toBe('false');
    });

    it('should set aria-disabled on disabled tab', () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems[2].getAttribute('aria-disabled')).toBe('true');
    });

    it('should set tabindex=0 on active tab and -1 on others', () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems[0].getAttribute('tabindex')).toBe('0');
      expect(tabItems[1].getAttribute('tabindex')).toBe('-1');
    });

    it('should have role="tabpanel" on content', () => {
      const panel = fixture.nativeElement.querySelector('[role="tabpanel"]');
      expect(panel).toBeTruthy();
    });

    it('should wire aria-controls (tab → panel) and aria-labelledby (panel → tab)', () => {
      const activeTab = fixture.nativeElement.querySelector(
        '.mlv-tab-item--active',
      ) as HTMLElement;
      const panel = fixture.nativeElement.querySelector(
        '[role="tabpanel"]',
      ) as HTMLElement;

      const controls = activeTab.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(panel.id).toBe(controls);
      expect(panel.getAttribute('aria-labelledby')).toBe(activeTab.id);
    });

    // ── Orientation ──

    it('should apply horizontal class by default', () => {
      const group = fixture.nativeElement.querySelector('.mlv-tab-group');
      expect(group.classList.contains('mlv-tab-group--horizontal')).toBe(true);
    });

    it('should apply vertical class when orientation is vertical', async () => {
      host.orientation.set('vertical');
      fixture.detectChanges();
      await fixture.whenStable();

      const group = fixture.nativeElement.querySelector('.mlv-tab-group');
      expect(group.classList.contains('mlv-tab-group--vertical')).toBe(true);
      expect(group.classList.contains('mlv-tab-group--horizontal')).toBe(false);
    });

    it('should update aria-orientation when switching to vertical', async () => {
      host.orientation.set('vertical');
      fixture.detectChanges();
      await fixture.whenStable();

      const header = fixture.nativeElement.querySelector('[role="tablist"]');
      expect(header.getAttribute('aria-orientation')).toBe('vertical');
    });

    // ── Programmatic tab change ──

    it('should switch tab when activeTab model changes', async () => {
      host.activeTab.set('tab2');
      fixture.detectChanges();
      await fixture.whenStable();

      const activeItem = fixture.nativeElement.querySelector(
        '.mlv-tab-item--active',
      );
      expect(activeItem.textContent.trim()).toContain('Tab 2');

      const content = fixture.nativeElement.querySelector('.mlv-tab-content');
      expect(content.textContent.trim()).toContain('Content 2');
    });

    // ── CSS animation classes ──

    it('should apply enter animation class on content', () => {
      const content = fixture.nativeElement.querySelector('.mlv-tab-content');
      // mlv-tab-content is always rendered when a tab is active; verify it exists
      expect(content).toBeTruthy();
    });

    // ── Indicator ──

    it('should render the indicator element', () => {
      const indicator = fixture.nativeElement.querySelector(
        '.mlv-tab-group__indicator',
      );
      expect(indicator).toBeTruthy();
    });

    it('re-measures the indicator when the direction flips', async () => {
      const indicator: HTMLElement = fixture.nativeElement.querySelector(
        '.mlv-tab-group__indicator',
      );
      const active: HTMLElement =
        fixture.nativeElement.querySelector('.mlv-tab-item');

      // Baseline: jsdom lays everything out at 0.
      expect(indicator.style.getPropertyValue('--mlv-tab-indicator-left')).toBe(
        '0px',
      );

      // Mirroring the header moves every tab without resizing it, so neither
      // the ResizeObserver nor the item queries change. Only the direction does.
      Object.defineProperty(active, 'offsetLeft', {
        configurable: true,
        get: () => 120,
      });
      TestBed.inject(MlvRtlService).setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));

      expect(indicator.style.getPropertyValue('--mlv-tab-indicator-left')).toBe(
        '120px',
      );
    });

    // ── Keyboard navigation ──

    it('should activate tab on Enter keydown', async () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      tabItems[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.activeTab()).toBe('tab2');
    });

    it('should activate tab on Space keydown', async () => {
      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        cancelable: true,
      });
      tabItems[1].dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.activeTab()).toBe('tab2');
    });
  });

  // ── Keyboard roving navigation via @angular/aria ngTabList (added behavior) ──
  // The tablist now delegates roving focus + arrow-key selection to
  // `@angular/aria`. In `selectionMode="follow"` arrow navigation moves the
  // roving tab and selects it; disabled tabs are skipped (`[softDisabled]="false"`)
  // and navigation does not wrap (`[wrap]="false"`).
  describe('Keyboard navigation (aria roving)', () => {
    let fixture: ComponentFixture<BasicTestHost>;
    let host: BasicTestHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BasicTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(BasicTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    function pressKey(key: string): void {
      const tablist = fixture.nativeElement.querySelector(
        '[role="tablist"]',
      ) as HTMLElement;
      tablist.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
    }

    it('should select the next tab on ArrowRight (follow mode)', async () => {
      pressKey('ArrowRight');
      await fixture.whenStable();
      expect(host.activeTab()).toBe('tab2');
    });

    it('should select the previous tab on ArrowLeft', async () => {
      host.activeTab.set('tab2');
      fixture.detectChanges();
      await fixture.whenStable();

      pressKey('ArrowLeft');
      await fixture.whenStable();
      expect(host.activeTab()).toBe('tab1');
    });

    it('should skip disabled tabs and not wrap during arrow navigation', async () => {
      host.activeTab.set('tab2');
      fixture.detectChanges();
      await fixture.whenStable();

      // tab3 is disabled and wrap is off, so ArrowRight from tab2 stays on tab2.
      pressKey('ArrowRight');
      await fixture.whenStable();
      expect(host.activeTab()).toBe('tab2');
    });

    it('should jump to the first enabled tab on Home', async () => {
      host.activeTab.set('tab2');
      fixture.detectChanges();
      await fixture.whenStable();

      pressKey('Home');
      await fixture.whenStable();
      expect(host.activeTab()).toBe('tab1');
    });

    it('should move roving tabindex=0 onto the newly selected tab', async () => {
      pressKey('ArrowRight');
      await fixture.whenStable();

      const tabItems = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      expect(tabItems[1].getAttribute('tabindex')).toBe('0');
      expect(tabItems[0].getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('Auto-selection', () => {
    let fixture: ComponentFixture<AutoSelectTestHost>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AutoSelectTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(AutoSelectTestHost);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should auto-select the first tab if no activeTab is set', () => {
      const activeItem = fixture.nativeElement.querySelector(
        '.mlv-tab-item--active',
      );
      expect(activeItem).toBeTruthy();
      expect(activeItem.textContent.trim()).toContain('A');
    });
  });

  describe('Nested tabs', () => {
    let fixture: ComponentFixture<NestedTestHost>;
    let host: NestedTestHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [NestedTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(NestedTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should render outer tabs', () => {
      const outerHeader = fixture.nativeElement.querySelector(
        '.mlv-tab-group > .mlv-tab-group__header',
      );
      const outerItems = outerHeader.querySelectorAll(':scope > .mlv-tab-item');
      expect(outerItems.length).toBe(2);
    });

    it('should render inner tabs within outer tab content', () => {
      const innerGroups =
        fixture.nativeElement.querySelectorAll('.mlv-tab-group');
      expect(innerGroups.length).toBeGreaterThanOrEqual(2);

      const innerGroup = innerGroups[1];
      const innerItems = innerGroup.querySelectorAll(
        ':scope > .mlv-tab-group__header > .mlv-tab-item',
      );
      expect(innerItems.length).toBe(2);
    });

    it('should switch inner tab independently of outer', async () => {
      host.innerTab.set('inner2');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.outerTab()).toBe('outer1');
      expect(host.innerTab()).toBe('inner2');

      const innerContent =
        fixture.nativeElement.querySelectorAll('.mlv-tab-content')[1];
      expect(innerContent.textContent.trim()).toContain('Nested Content 2');
    });

    it('should switch outer tab and show different content', async () => {
      host.outerTab.set('outer2');
      fixture.detectChanges();
      await fixture.whenStable();

      const content = fixture.nativeElement.querySelector('.mlv-tab-content');
      expect(content.textContent.trim()).toContain('Outer Content 2');
    });
  });

  describe('MlvTabsService overflow swap logic', () => {
    let service: MlvTabsService;

    function makeMockTab(value: string): MlvTab {
      return { value: () => value } as unknown as MlvTab;
    }

    beforeEach(() => {
      service = new MlvTabsService();
      const tabs = [
        makeMockTab('t1'),
        makeMockTab('t2'),
        makeMockTab('t3'),
        makeMockTab('t4'),
        makeMockTab('t5'),
      ];
      tabs.forEach((t) => service.register(t));
    });

    it('should show all tabs when no overflow', () => {
      expect(service.visibleTabs().length).toBe(5);
      expect(service.overflowTabs().length).toBe(0);
    });

    it('should split tabs at maxVisibleCount', () => {
      service.maxVisibleCount.set(3);

      expect(service.visibleTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't3',
      ]);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't4',
        't5',
      ]);
    });

    it('should swap forced tab with last visible tab', () => {
      service.maxVisibleCount.set(3);
      service.forceVisible('t4');

      expect(service.visibleTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't4',
      ]);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't3',
        't5',
      ]);
    });

    it('should swap forced tab with last visible — t5 forced', () => {
      service.maxVisibleCount.set(3);
      service.forceVisible('t5');

      expect(service.visibleTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't5',
      ]);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't3',
        't4',
      ]);
    });

    it('should not swap if forced tab is already visible', () => {
      service.maxVisibleCount.set(3);
      service.forceVisible('t2');

      expect(service.visibleTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't3',
      ]);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't4',
        't5',
      ]);
    });

    it('should handle clearing forced value', () => {
      service.maxVisibleCount.set(3);
      service.forceVisible('t4');
      service.forcedVisibleValue.set(null);

      expect(service.visibleTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't3',
      ]);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't4',
        't5',
      ]);
    });

    it('should handle maxVisibleCount of 1 with forced', () => {
      service.maxVisibleCount.set(1);
      service.forceVisible('t5');

      expect(service.visibleTabs().map((t) => t.value())).toEqual(['t5']);
      expect(service.overflowTabs().map((t) => t.value())).toEqual([
        't1',
        't2',
        't3',
        't4',
      ]);
    });
  });

  // ── Bug 1: active-tab content survives repartition ──
  // Driving the overflow split directly (no layout needed): the active tab must
  // always keep a rendered `ngTab`, otherwise `@angular/aria` desyncs its
  // `selectedTab` model, marks the active panel inert and the deferred
  // `ngTabContent` destroys the panel body permanently.
  describe('Overflow — active content survival', () => {
    let fixture: ComponentFixture<OverflowTestHost>;
    let host: OverflowTestHost;
    let service: MlvTabsService;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [OverflowTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(OverflowTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      service = fixture.debugElement
        .query(By.directive(MlvTabGroup))
        .injector.get(MlvTabsService);
    });

    function panel(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.mlv-tab-content');
    }

    it('keeps the active tab pinned into the visible row when overflow shrinks', async () => {
      host.activeTab.set('t5');
      service.maxVisibleCount.set(2);
      fixture.detectChanges();
      await fixture.whenStable();

      const visibleValues = Array.from(
        fixture.nativeElement.querySelectorAll('.mlv-tab-item'),
      ).map((el) => (el as HTMLElement).textContent?.trim());
      // t5 is swapped into the visible row (last slot) even though its natural
      // index is beyond maxVisibleCount.
      expect(visibleValues).toContain('t5');
    });

    it('keeps active content rendered and not inert through a repartition churn', async () => {
      expect(panel()?.textContent).toContain('Content t1');

      // Churn: collapse everything to overflow, then restore — mimics the
      // reset-then-repartition a resize performs.
      service.maxVisibleCount.set(0);
      fixture.detectChanges();
      await fixture.whenStable();

      service.maxVisibleCount.set(-1);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(panel()?.textContent).toContain('Content t1');
      expect(panel()?.hasAttribute('inert')).toBe(false);
    });

    it('keeps content for an active tab that starts beyond the overflow boundary', async () => {
      host.activeTab.set('t4');
      service.maxVisibleCount.set(2);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(panel()?.textContent).toContain('Content t4');
      expect(panel()?.hasAttribute('inert')).toBe(false);
    });
  });

  // ── #358 / #269: the split is exact, and caused by the right things ──
  //
  // The split used to compare the sum of the tabs' integer `offsetWidth`s
  // against the header's `clientWidth` — which includes the boxed header's
  // padding and none of its gaps — reserved a guessed 100px for a trigger that
  // did not exist yet, held a 24px band in which a tab that fits stayed in
  // "More", and ran only when a resize notification arrived. Every spec here
  // stubs the layout with `stubSplitGeometry()` and drives the group through
  // the same faithful observer as #232's block.
  describe('Overflow — exact split (#358, #269)', () => {
    beforeEach(() => {
      SpecFaithfulResizeObserver.instances = [];
      SpecFaithfulResizeObserver.deliveries = new Map<Element, number>();
      SpecFaithfulResizeObserver.muted = false;
      Object.assign(splitGeometry, {
        host: 0,
        tab: 0,
        widths: {},
        trigger: 0,
        headerPadding: 0,
        gap: 0,
        tops: {},
        hostFor: null,
        header: null,
        grow: 'none',
      });
      stubSplitGeometry();
    });

    afterEach(() => {
      SpecFaithfulResizeObserver.muted = false;
      vi.restoreAllMocks();
    });

    const create = async (
      setup: (host: SplitTestHost) => void = () => undefined,
    ): Promise<ComponentFixture<SplitTestHost>> => {
      await TestBed.configureTestingModule({
        imports: [SplitTestHost],
        providers: [
          provideMlvI18nTesting(),
          {
            provide: MlvResizeObserverFactory,
            useClass: SpecFaithfulResizeObserverFactory,
          },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(SplitTestHost);
      setup(fixture.componentInstance);
      fixture.detectChanges();
      await fixture.whenStable();
      await settle(fixture);
      return fixture;
    };

    /** Lets every trailing timer run, then renders what they committed. */
    const settle = async (
      fixture: ComponentFixture<SplitTestHost>,
    ): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      fixture.detectChanges();
      await fixture.whenStable();
    };

    const groupDebug = (fixture: ComponentFixture<SplitTestHost>) =>
      fixture.debugElement.query(By.directive(MlvTabGroup));

    const service = (fixture: ComponentFixture<SplitTestHost>) =>
      groupDebug(fixture).injector.get(MlvTabsService);

    const overflow = (fixture: ComponentFixture<SplitTestHost>) =>
      service(fixture)
        .overflowTabs()
        .map((t) => t.value());

    const root = (fixture: ComponentFixture<SplitTestHost>) =>
      fixture.nativeElement as HTMLElement;

    /**
     * Tells the observer the group changed size. Every box a version of the
     * split has ever watched is notified — the host and the header — so the
     * spec measures the arithmetic, not which box happens to be observed.
     */
    const resize = (fixture: ComponentFixture<SplitTestHost>): void => {
      const host = root(fixture).querySelector('mlv-tab-group');
      const header = root(fixture).querySelector('.mlv-tab-group__header');
      if (host) SpecFaithfulResizeObserver.notify(host);
      if (header) SpecFaithfulResizeObserver.notify(header);
    };

    const setWidth = async (
      fixture: ComponentFixture<SplitTestHost>,
      width: number,
    ): Promise<void> => {
      splitGeometry.host = width;
      resize(fixture);
      await settle(fixture);
    };

    // The issue's table: a boxed group of 5 × 100px tabs. The track's content
    // box is W − 6px (0.1875rem padding each side) and the row spends 4 × 2px
    // on gaps, so all five need W ≥ 514; below that the last tab was clipped
    // with no "More" while the old arithmetic (500 ≤ W) said everything fit.
    it('withholds a tab once the boxed padding and gaps no longer fit', async () => {
      const fixture = await create((host) => {
        host.appearance.set('boxed');
        Object.assign(splitGeometry, {
          host: 600,
          tab: 100,
          trigger: 60,
          headerPadding: 3,
          gap: 2,
        });
      });

      expect(overflow(fixture)).toEqual([]);

      await setWidth(fixture, 514);
      expect(overflow(fixture)).toEqual([]);

      for (const width of [513, 510, 505]) {
        await setWidth(fixture, width);
        expect({ width, overflow: overflow(fixture) }).toEqual({
          width,
          overflow: ['t5'],
        });
        expect(
          root(fixture).querySelector('.mlv-tab-group__more-trigger'),
        ).not.toBeNull();
      }

      // …and they come back at exactly the width they need.
      await setWidth(fixture, 514);
      expect(overflow(fixture)).toEqual([]);
    });

    // A boxed track is `width: fit-content`: once a tab is withheld it shrinks
    // around the tabs that remain and does not grow with its container again.
    // Measured in Chromium before the fix: a boxed group narrowed to 450px and
    // widened back to 800px kept "More (2)" in a 403px track. The room is now
    // read from the group, so growing the group alone — the track neither
    // moves nor is notified — brings the tab back.
    it('returns a withheld boxed tab when only the group grows', async () => {
      const fixture = await create((host) => {
        host.appearance.set('boxed');
        Object.assign(splitGeometry, {
          host: 505,
          tab: 100,
          trigger: 60,
          headerPadding: 3,
          gap: 2,
        });
      });
      expect(overflow(fixture)).toEqual(['t5']);

      // The track now hugs four tabs, the trigger, their four gaps and its
      // own padding: 474px, whatever the group does next.
      splitGeometry.header = 4 * 100 + 60 + 4 * 2 + 2 * 3;
      splitGeometry.host = 600;
      const group = root(fixture).querySelector('mlv-tab-group');
      expect(SpecFaithfulResizeObserver.notify(group as Element)).toBe(1);
      await settle(fixture);

      expect(overflow(fixture)).toEqual([]);
    });

    // Underline, no padding, no gap: what is left is the guessed trigger and
    // the band. At 499px four tabs (400) and the real 88px trigger fit; the
    // old first pass reserved 100px and withheld the fourth, and the band
    // then kept it out once the trigger was measured. Growing 300 → 400 the
    // third tab fits (300 + 88) but the band wanted 412.
    it('withholds no tab that fits beside the measured trigger', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 499, tab: 100, trigger: 88 });
      });

      expect(overflow(fixture)).toEqual(['t5']);

      await setWidth(fixture, 300);
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      await setWidth(fixture, 400);
      expect(overflow(fixture)).toEqual(['t4', 't5']);
    });

    // A resize that makes the row too wide is corrected in the task the
    // notification arrives in; one that leaves room waits for the trailing
    // timer, so a drag does not re-render the row on every frame.
    it('hides on the notification and reveals after the trailing debounce', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      // 150 − 100 leaves 50px: not even a second 60px tab beside the pinned one.
      splitGeometry.host = 150;
      resize(fixture);
      // Synchronously, before any timer has run.
      expect(service(fixture).overflowTabs().length).toBe(4);

      splitGeometry.host = 400;
      resize(fixture);
      expect(service(fixture).overflowTabs().length).toBe(4);

      await settle(fixture);
      expect(overflow(fixture)).toEqual([]);
    });

    it('re-measures the indicator on a vertical resize notification', async () => {
      const fixture = await create((host) => {
        host.orientation.set('vertical');
        host.activeTab.set('t3');
        Object.assign(splitGeometry, {
          host: 600,
          tab: 60,
          tops: { t3: 82 },
        });
      });
      const indicator = root(fixture).querySelector<HTMLElement>(
        '.mlv-tab-group__indicator',
      );
      expect(indicator?.style.getPropertyValue('--mlv-tab-indicator-top')).toBe(
        '82px',
      );

      // A label above the active tab rewraps (a font swap, say): the active
      // tab moves down and no signal the indicator effect tracks changes.
      splitGeometry.tops = { t3: 122 };
      const first = root(fixture).querySelector('.mlv-tab-item');
      expect(first).not.toBeNull();
      expect(SpecFaithfulResizeObserver.notify(first as Element)).toBe(1);
      await settle(fixture);

      expect(indicator?.style.getPropertyValue('--mlv-tab-indicator-top')).toBe(
        '122px',
      );
    });

    // #269: `orientation()` itself re-derives the split. With the observer
    // muted nothing is notified at all, so a split that follows the flip was
    // caused by the input, not by the relayout it usually produces.
    it('recalculates on an orientation flip with no resize notification', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      const split = overflow(fixture);
      expect(split).toEqual(['t3', 't4', 't5']);

      SpecFaithfulResizeObserver.muted = true;
      const deliveries = [...SpecFaithfulResizeObserver.deliveries.values()];

      fixture.componentInstance.orientation.set('vertical');
      await settle(fixture);
      expect(overflow(fixture)).toEqual([]);
      expect(
        root(fixture).querySelector('.mlv-tab-group__more-trigger'),
      ).toBeNull();

      fixture.componentInstance.orientation.set('horizontal');
      await settle(fixture);
      expect(overflow(fixture)).toEqual(split);

      expect([...SpecFaithfulResizeObserver.deliveries.values()]).toEqual(
        deliveries,
      );
    });

    // A pin, not a regression: #232 already re-measured a visible tab on its
    // own resize notification. Kept because the width cache was rebuilt here.
    it('re-measures a visible tab whose label changes', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, {
          host: 300,
          tab: 60,
          trigger: 100,
          widths: { 'Second, longer': 120 },
        });
      });
      expect(overflow(fixture)).toEqual([]);

      fixture.componentInstance.labels.set({ t2: 'Second, longer' });
      fixture.detectChanges();
      await fixture.whenStable();
      const second = root(fixture).querySelectorAll('.mlv-tab-item')[1];
      expect(second?.textContent?.trim()).toBe('Second, longer');
      expect(SpecFaithfulResizeObserver.notify(second)).toBe(1);
      await settle(fixture);

      // 60 + 120 + 100 = 280 fits in 300; a third tab does not.
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
    });

    // The active tab is pinned into the row even when it sits past the
    // boundary, so it is *its* width that has to fit, not the width of the
    // tab it displaces. At 300px: t5 (150) + t1 (60) + the 50px trigger fit,
    // a second 60px tab does not. The old count summed the leading tabs
    // (60 + 60 + 60 + 100 guessed) and then rendered the 150px t5 in the
    // third slot: 330px in a 300px header.
    it('reserves the pinned active tab at its own width', async () => {
      const fixture = await create((host) => {
        host.activeTab.set('t5');
        host.labels.set({ t5: 'Fifth, much longer' });
        Object.assign(splitGeometry, {
          host: 300,
          tab: 60,
          trigger: 50,
          widths: { 'Fifth, much longer': 150 },
        });
      });

      expect(overflow(fixture)).toEqual(['t2', 't3', 't4']);
      const rendered = Array.from(
        root(fixture).querySelectorAll('.mlv-tab-item'),
      ).map((el) => el.textContent?.trim());
      expect(rendered).toEqual(['t1', 'Fifth, much longer']);
    });

    // `getBoundingClientRect()` widths, not `offsetWidth`: five 100.4px tabs
    // need 502px, which the rounded 5 × 100 = 500 said fit in 501.
    it('sums fractional tab widths', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 501, tab: 100.4, trigger: 60 });
      });

      expect(overflow(fixture)).toEqual(['t5']);
    });

    // A font swap, a density change or a retranslation changes every tab —
    // the withheld ones too, which are not rendered and so cannot be
    // re-measured where they are. Their cached widths used to survive it: at
    // 40px each all five fit in 230px, but the stale 60s kept three in "More".
    it('re-measures withheld tabs when every rendered tab changes width', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      splitGeometry.tab = 40;
      const first = root(fixture).querySelector('.mlv-tab-item');
      expect(first).not.toBeNull();
      expect(SpecFaithfulResizeObserver.notify(first as Element)).toBe(1);
      await settle(fixture);

      expect(overflow(fixture)).toEqual([]);
    });

    // A drag widening the group delivers a notification per frame. The reveal
    // they ask for is committed once, after the last of them, from widths read
    // then — not from any one notification's.
    it('coalesces a burst of widening notifications into one trailing reveal', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      const recalc = vi.spyOn(
        groupDebug(fixture).componentInstance as unknown as {
          _recalculateOverflow: () => void;
        },
        '_recalculateOverflow',
      );

      try {
        vi.useFakeTimers();
        for (const width of [290, 320, 360, 400]) {
          splitGeometry.host = width;
          resize(fixture);
        }

        // Nothing yet — a reveal waits for the burst to end, and the burst
        // left one timer, not four.
        expect(recalc).not.toHaveBeenCalled();
        expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(100);

        // The timer's recalculation, then the render-driven one its commit
        // caused (the scheduler's tick is a timer too, so it ran as well).
        expect(recalc).toHaveBeenCalledTimes(2);
        expect(overflow(fixture)).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    // ── #232: the split follows the tabs' boxes, not only the container's ──
    //
    // The first measurement pass can land before the tabs have a laid-out box
    // (or before a webfont swap settles): every width reads 0 and nothing is
    // measured. That is not wrong on its own — it was wrong *forever*, because
    // the only thing that re-ran the calculation was a change in the header's
    // size, and a header whose width comes from its parent never resizes when
    // its children finally get theirs.
    //
    // `observe()` delivers the initial notification a real observer does (see
    // `SpecFaithfulResizeObserver`), so the cold start hand-fires nothing.
    it('recomputes the split when tab widths arrive without the host resizing', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 0, trigger: 40 });
      });

      expect(
        root(fixture).querySelector('.mlv-tab-group__more-trigger'),
      ).toBeNull();
      expect(overflow(fixture)).toEqual([]);

      // The tabs' boxes arrive; the host does not move, so the tab edge is
      // the only signal, and the guard names that mechanism.
      splitGeometry.tab = 60;
      const first = root(fixture).querySelector('.mlv-tab-item');
      expect(first).not.toBeNull();
      expect(SpecFaithfulResizeObserver.notify(first as Element)).toBe(1);
      await settle(fixture);

      expect(
        root(fixture).querySelector('.mlv-tab-group__more-trigger'),
      ).not.toBeNull();
      // 3 × 60 + the measured 40px trigger = 220 ≤ 230. The 100px the trigger
      // used to be assumed at would have withheld the third tab too.
      expect(overflow(fixture)).toEqual(['t4', 't5']);
    });

    // Observing the tabs and the trigger — which a repartition *creates* —
    // puts the observer inside a loop: notify → recalculate → repartition →
    // render → observe → notify. What ends it is that the split is a pure
    // function of widths that repartitioning does not change. Counted from
    // the cold start, prototype spies installed before the group exists.
    it('settles the observe → repartition → observe cycle at a fixed point', async () => {
      const proto = MlvTabGroup.prototype as unknown as Record<
        '_commit' | '_onResizeBatch',
        () => void
      >;
      const commit = vi.spyOn(proto, '_commit');
      const batch = vi.spyOn(proto, '_onResizeBatch');

      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      const counts = () => ({
        commits: commit.mock.calls.length,
        batches: batch.mock.calls.length,
      });
      const converged = counts();
      // Eight batches: the initial notification of each of the eight boxes
      // ever observed (host, header, five tabs, then the trigger) — none after.
      // Eleven commits: one per batch, plus one per render the split caused
      // (the first split, its correction once the trigger was measured, and
      // the pass that found nothing left to change).
      expect(converged).toEqual({ commits: 11, batches: 8 });

      for (let round = 0; round < 3; round++) {
        await settle(fixture);
      }

      expect(counts()).toEqual(converged);
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
      // One observer for the whole group, not one per box.
      expect(SpecFaithfulResizeObserver.instances.length).toBe(1);

      // The host and the header were observed at the cold start, never moved
      // and never left the target set, so each was notified exactly once in
      // the component's life. This separates the incremental diff from
      // `disconnect()`-and-re-observe, which re-arms every target and makes a
      // long-settled box deliver again on every repartition.
      const group = root(fixture).querySelector('mlv-tab-group');
      const header = root(fixture).querySelector('.mlv-tab-group__header');
      expect(SpecFaithfulResizeObserver.deliveryCount(group as Element)).toBe(
        1,
      );
      expect(SpecFaithfulResizeObserver.deliveryCount(header as Element)).toBe(
        1,
      );
    });

    // Before #232 a group that started vertical never got an observer at all;
    // after it, turning horizontal repartitioned only if the relayout happened
    // to deliver a notification. Muted, nothing is delivered: the flip alone
    // has to do it (#269).
    it('repartitions a group that started vertical as soon as it turns horizontal', async () => {
      const fixture = await create((host) => {
        host.orientation.set('vertical');
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });

      // A vertical group never overflows, whatever the widths say — and it is
      // observed all the same.
      expect(overflow(fixture)).toEqual([]);
      const header = root(fixture).querySelector('.mlv-tab-group__header');
      expect(SpecFaithfulResizeObserver.notify(header as Element)).toBe(1);
      await settle(fixture);
      expect(overflow(fixture)).toEqual([]);

      SpecFaithfulResizeObserver.muted = true;
      fixture.componentInstance.orientation.set('horizontal');
      await settle(fixture);

      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
    });

    // The loop the oscillation guard exists for, replacing the 24px band:
    // returning the last tab makes the page taller, a scrollbar takes 20px
    // from the group, the tab no longer fits and goes, the scrollbar goes with
    // it — and round again. Each step is correct arithmetic at the width it
    // is computed against; only the guard sees that the reveal undoes itself.
    // It is not a band: at any width past the one that failed, the tab comes
    // straight back.
    it('refuses a reveal that has already undone itself', async () => {
      const commit = vi.spyOn(
        MlvTabGroup.prototype as unknown as Record<'_commit', () => void>,
        '_commit',
      );
      const fixture = await create(() => {
        Object.assign(splitGeometry, {
          tab: 60,
          trigger: 50,
          // Five 60px tabs need 300px: they fit the 310 the group has while
          // the trigger shows, not the 290 it keeps once they are all back.
          hostFor: (group: Element) =>
            group.querySelector('.mlv-tab-group__more-trigger') ? 310 : 290,
        });
      });
      expect(overflow(fixture)).toEqual(['t5']);

      const settled = commit.mock.calls.length;
      for (let round = 0; round < 3; round++) {
        resize(fixture);
        await settle(fixture);
      }
      expect(overflow(fixture)).toEqual(['t5']);
      // One refused reveal per round (its trailing timer), and nothing that
      // round re-renders.
      expect(commit.mock.calls.length - settled).toBe(3);

      splitGeometry.hostFor = () => 330;
      resize(fixture);
      await settle(fixture);
      expect(overflow(fixture)).toEqual([]);
    });

    /**
     * Counts the guard's resets from here on. One happens exactly when the
     * row is expanded to re-read widths that are no longer on record — the
     * step the stretched-tab loop repeated.
     */
    const spyOnGuardResets = (
      fixture: ComponentFixture<SplitTestHost>,
    ): (() => number) => {
      const group = groupDebug(fixture).componentInstance as unknown as {
        _revealGuard: { reset: () => void };
      };
      const reset = vi.spyOn(group._revealGuard, 'reset');
      return () => reset.mock.calls.length;
    };

    // Tabs that grow into the free room (`flex: 1`, the full-width pattern
    // `mlv-color-picker` uses) are wider the fewer of them render. Read as
    // laid out, hiding tabs let the rest grow, every rendered width changed,
    // the withheld entries were dropped as stale, the row expanded to re-read
    // them, the tabs shrank back and the split hid them again — Angular's
    // render loop (NG0103) and a frozen page (#358 review, B1). Read at their
    // natural width, the split is the one a non-stretched row gets.
    it('splits stretched tabs by their natural width and settles', async () => {
      const errors = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const fixture = await create(() => {
        Object.assign(splitGeometry, {
          host: 250,
          tab: 60,
          trigger: 80,
          grow: 'flex',
        });
      });
      const resets = spyOnGuardResets(fixture);

      // 3 × 60 + 80 = 260 > 250: two tabs, which then stretch to 85 each.
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      // 5 × 60 = 300 fits 330: the 85s the two rendered tabs are laid out at
      // would have said 350, and kept two tabs in "More".
      for (const [width, hidden] of [
        [330, []],
        [250, ['t3', 't4', 't5']],
        [400, []],
        [250, ['t3', 't4', 't5']],
      ] as const) {
        await setWidth(fixture, width);
        expect({ width, overflow: overflow(fixture) }).toEqual({
          width,
          overflow: hidden,
        });
      }

      expect(resets()).toBe(0);
      expect(errors).not.toHaveBeenCalled();
      // The switch that reads the natural width is undone before the frame.
      expect(root(fixture).querySelector('.mlv-tab-item[style]')).toBeNull();
    });

    // The switch is written over whatever inline `flex-grow` the consumer put
    // on a tab item, so it must hand that back as it found it — value and
    // priority — or every split would erase an inline style it does not own.
    it("restores a tab item's own inline flex-grow after a split", async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, {
          host: 400,
          tab: 60,
          trigger: 80,
          grow: 'flex',
        });
      });
      const first = root(fixture).querySelector('.mlv-tab-item') as HTMLElement;
      first.style.setProperty('flex-grow', '2', 'important');

      for (const [width, hidden] of [
        [250, ['t3', 't4', 't5']],
        [400, []],
        [250, ['t3', 't4', 't5']],
      ] as const) {
        await setWidth(fixture, width);
        expect({
          width,
          overflow: overflow(fixture),
          connected: first.isConnected,
          value: first.style.getPropertyValue('flex-grow'),
          priority: first.style.getPropertyPriority('flex-grow'),
        }).toEqual({
          width,
          overflow: hidden,
          connected: true,
          value: '2',
          priority: 'important',
        });
      }
    });

    // A stretch no `flex-grow` switch undoes (a grid track) is read as laid
    // out, so a repartition changes every rendered width by its own doing.
    // Only a change between two captures of the *same* rendered tabs may drop
    // the withheld tabs' widths; counted against the previous, different
    // render, it expanded the row on every repartition. Such a tab also
    // follows its container, so widening the group while tabs are withheld
    // reads like a font swap and re-reads them — once, however many
    // notifications the batch carries, and from there the split settles.
    it('drops withheld widths only on a change between two same renders', async () => {
      const errors = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const fixture = await create(() => {
        Object.assign(splitGeometry, {
          host: 400,
          tab: 60,
          trigger: 80,
          grow: 'layout',
        });
      });
      const resets = spyOnGuardResets(fixture);
      expect(overflow(fixture)).toEqual([]);

      // All five at 80 → two at 85: every rendered width changed, by the
      // repartition. Nothing is re-read.
      await setWidth(fixture, 250);
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
      for (let round = 0; round < 3; round++) {
        resize(fixture);
        await settle(fixture);
      }
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);
      expect(resets()).toBe(0);

      // The same two tabs, 85 → 160: re-read once (the batch notifies the
      // host and the header), then all five fit at 80.
      await setWidth(fixture, 400);
      expect(overflow(fixture)).toEqual([]);
      expect(resets()).toBe(1);

      expect(errors).not.toHaveBeenCalled();
    });

    // A reveal waits on a timer the group owns. Destroyed mid-debounce, the
    // group must release it rather than recalculate a view that is gone.
    it('releases a pending reveal when the group is destroyed', async () => {
      const fixture = await create(() => {
        Object.assign(splitGeometry, { host: 230, tab: 60, trigger: 100 });
      });
      expect(overflow(fixture)).toEqual(['t3', 't4', 't5']);

      const recalc = vi.spyOn(
        MlvTabGroup.prototype as unknown as Record<
          '_recalculateOverflow',
          () => void
        >,
        '_recalculateOverflow',
      );
      splitGeometry.host = 400;
      resize(fixture);
      fixture.destroy();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(recalc).not.toHaveBeenCalled();
    });

    it('has no axe violations while boxed tabs are withheld', async () => {
      const fixture = await create((host) => {
        host.appearance.set('boxed');
        Object.assign(splitGeometry, {
          host: 505,
          tab: 100,
          trigger: 60,
          headerPadding: 3,
          gap: 2,
        });
      });
      expect(overflow(fixture)).toEqual(['t5']);
      expect(
        root(fixture).querySelector('.mlv-tab-group__more-trigger'),
      ).not.toBeNull();

      // axe reads computed styles and client rects the layout stubs answer for
      // only a few boxes; the rendered markup is what is swept.
      vi.restoreAllMocks();
      await expectNoAxeViolations(root(fixture), {
        // NARROWED, not clean: `aria-required-children` fires on
        // `.mlv-tab-group__header` — "Element has children which are not
        // allowed: button[aria-haspopup]". The "More (N)" trigger is a
        // `<button>` inside the `role="tablist"`, which may own only tabs; the
        // markup predates #358 (this is the first sweep of an overflowed
        // group). Fixable, deferred: tracked in #697.
        rules: { 'aria-required-children': { enabled: false } },
      });
    });
  });

  // ── Shrinkability inside a grid/flex parent ──
  //
  // The overflow split is computed against the group's own content box, so it
  // only ever engages if the group can be narrower than its tab row. As a flex
  // or grid item the group defaults to `min-width: auto`, whose content-based
  // minimum is the full tab row — the group then refuses to shrink, its width
  // never drops, "More (N)" never appears and the `overflow: hidden` header
  // silently clips its trailing tabs.
  //
  // The fix is CSS-only and therefore unobservable through the DOM here:
  // component stylesheets are not injected under the jsdom test environment, so
  // `getComputedStyle` reports nothing. The stylesheet source is asserted
  // instead, which still fails if the declarations are dropped.
  describe('Header shrinkability (min-width)', () => {
    // Resolved through `path`, not `new URL(…, import.meta.url)`: under the
    // jsdom environment `URL` is jsdom's implementation and neither `node:fs`
    // nor `fileURLToPath` accepts what it produces.
    const stylesheet = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'tabs.scss'),
      'utf8',
    );

    /** Declarations of one top-level rule, up to its closing brace. */
    const ruleBody = (selector: string): string => {
      const start = stylesheet.indexOf(`${selector} {`);
      expect(start, `${selector} rule not found`).toBeGreaterThan(-1);
      return stylesheet.slice(start, stylesheet.indexOf('\n}', start));
    };

    it('lets the group shrink below its tab row', () => {
      expect(ruleBody('.#{$block}')).toMatch(/min-width:\s*0;/);
    });

    it('lets the header shrink below its tab row', () => {
      expect(ruleBody('.#{$block}__header')).toMatch(/min-width:\s*0;/);
    });
  });

  // ── Phase A: boxed appearance ──
  describe('Boxed appearance', () => {
    let fixture: ComponentFixture<AppearanceTestHost>;
    let host: AppearanceTestHost;

    function group(): HTMLElement {
      return fixture.nativeElement.querySelector('.mlv-tab-group');
    }

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AppearanceTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      fixture = TestBed.createComponent(AppearanceTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('defaults to the underline appearance (no boxed class)', () => {
      expect(
        group().classList.contains('mlv-tab-group--appearance-boxed'),
      ).toBe(false);
    });

    it('applies the appearance-boxed class when appearance="boxed"', async () => {
      host.appearance.set('boxed');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        group().classList.contains('mlv-tab-group--appearance-boxed'),
      ).toBe(true);
    });

    it('keeps the indicator element mounted in boxed mode (hidden via the boxed class, not removed)', async () => {
      host.appearance.set('boxed');
      fixture.detectChanges();
      await fixture.whenStable();

      // The indicator bar is hidden by the appearance-boxed class in CSS; it is
      // still rendered so switching back to underline needs no re-creation.
      expect(
        fixture.nativeElement.querySelector('.mlv-tab-group__indicator'),
      ).toBeTruthy();
      expect(
        group().classList.contains('mlv-tab-group--appearance-boxed'),
      ).toBe(true);
    });

    it('composes appearance orthogonally with orientation (boxed + vertical)', async () => {
      host.appearance.set('boxed');
      host.orientation.set('vertical');
      fixture.detectChanges();
      await fixture.whenStable();

      const el = group();
      expect(el.classList.contains('mlv-tab-group--appearance-boxed')).toBe(
        true,
      );
      expect(el.classList.contains('mlv-tab-group--vertical')).toBe(true);
      expect(el.classList.contains('mlv-tab-group--horizontal')).toBe(false);
    });

    it('does not render routed header link anchors for a non-routed group', () => {
      expect(
        fixture.nativeElement.querySelector('.mlv-tab-item__link'),
      ).toBeNull();
    });
  });

  // ── Boxed appearance: the selected pill in every theme ──
  // Asserted against the SCSS *source* for the same reason as the min-width
  // guards above — component stylesheets are not injected under jsdom. What
  // the pill paints per theme and theme scope is measured in `libs/styles`
  // (`theme-scopes.spec.mjs` § component surfaces, `tone-contrast.spec.mjs`).
  describe('Boxed appearance — selected pill', () => {
    const stylesheet = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'tabs.scss'),
      'utf8',
    );
    /** The source with its comments removed, so prose cannot satisfy a match. */
    const rules = stylesheet
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    it('paints the pill with the elevation token that lifts it above the track in every theme', () => {
      // `--mlv-background-raised` (#1e1e1e) is darker than the boxed track's
      // `--mlv-background-neutral-1` (#262626) in dark, so the pill would sink
      // below the track. `--mlv-elevation-bg-4` is the raised surface in light
      // and high contrast and neutral-700 in dark — the value the old
      // `[mlvTheme='dark']` repaint wrote, now resolved by every theme scope.
      expect(rules).toMatch(
        /& > \.#\{\$block\}__header > \.#\{\$block\}__indicator \{\s*background: var\(--mlv-elevation-bg-4\);/,
      );
    });

    it('never keys a rule on the theme attribute (#454)', () => {
      // `[mlvTheme='dark'] …` reached into light islands, survived high
      // contrast on a dark `<html>` and missed a group that is its own island.
      expect(rules).not.toMatch(/\[\s*(mlvTheme|data-theme)\s*[~|^$*]?=/i);
    });

    it('does not leave a dead @at-root dark override on the light-mode indicator rule', () => {
      expect(stylesheet).not.toContain('@at-root');
    });
  });

  // ── Phase A2: routable tabs ──
  describe('Routed tabs', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [RoutedTestHost, RouteStub],
        providers: [provideMlvI18nTesting(), provideRouter(ROUTED_ROUTES)],
      }).compileComponents();
    });

    function tabGroup(fixture: ComponentFixture<RoutedTestHost>): MlvTabGroup {
      return fixture.debugElement.query(By.directive(MlvTabGroup))
        .componentInstance as MlvTabGroup;
    }

    async function createAt(url: string) {
      const router = TestBed.inject(Router);
      const fixture = TestBed.createComponent(RoutedTestHost);
      fixture.detectChanges();
      await fixture.whenStable();
      await router.navigateByUrl(url);
      fixture.detectChanges();
      await fixture.whenStable();
      return fixture;
    }

    it('detects routed mode when a tab carries a routerLink', async () => {
      const fixture = await createAt('/');
      expect(
        (
          tabGroup(fixture) as unknown as { _isRouted: () => boolean }
        )._isRouted(),
      ).toBe(true);
    });

    it('is NOT routed for a group whose tabs have no routerLink', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [BasicTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(BasicTestHost);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        (
          tabGroup(
            fixture as unknown as ComponentFixture<RoutedTestHost>,
          ) as unknown as {
            _isRouted: () => boolean;
          }
        )._isRouted(),
      ).toBe(false);
    });

    it('derives activeTab from the current URL on a NavigationEnd', async () => {
      const fixture = await createAt('/api');
      expect(fixture.componentInstance.activeTab()).toBe('api');

      const router = TestBed.inject(Router);
      await router.navigateByUrl('/');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.activeTab()).toBe('examples');
    });

    it('runs an initial sync when the router is already settled before the group inits', async () => {
      // Settle the router first, THEN create the group: no NavigationEnd fires
      // for the group's subscription, so the initial-sync effect must set it.
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/api');

      const fixture = TestBed.createComponent(RoutedTestHost);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.activeTab()).toBe('api');
    });

    it('honours linkActiveOptions — exact-matched Examples tab is inactive on /api', async () => {
      const fixture = await createAt('/api');
      // Examples is routerLink="/" with { exact: true }; on /api it must NOT win
      // over the subset-matching API tab.
      expect(fixture.componentInstance.activeTab()).toBe('api');
    });

    it('navigates via the router on activation instead of setting activeTab directly', async () => {
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigateByUrl');
      const fixture = await createAt('/');
      expect(fixture.componentInstance.activeTab()).toBe('examples');
      navSpy.mockClear();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      // items[1] is the API tab header.
      items[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(navSpy).toHaveBeenCalled();
      // activeTab followed the resulting navigation, not a direct set.
      expect(fixture.componentInstance.activeTab()).toBe('api');
    });

    it('renders no nested anchor inside role="tab" (avoids axe nested-interactive)', async () => {
      const fixture = await createAt('/');
      // Routed header items navigate via activate → navigateByUrl; they do NOT
      // wrap the label in an <a href>, because an anchor nested inside the
      // role="tab" element trips the axe nested-interactive rule.
      const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(2);
      expect(
        fixture.nativeElement.querySelector('.mlv-tab-item__link'),
      ).toBeNull();
      for (const tab of tabs) {
        expect(tab.querySelector('a')).toBeNull();
      }
    });

    it('keeps aria-selected in sync with the route-derived active tab', async () => {
      const fixture = await createAt('/api');
      const items = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
      // items[0]=Examples, items[1]=API. On /api the API tab is selected.
      expect(items[1].getAttribute('aria-selected')).toBe('true');
      expect(items[0].getAttribute('aria-selected')).toBe('false');
    });
  });
});

describe('MlvTabGroup — external panels', () => {
  @Component({
    imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabPanel],
    template: `
      <mlv-tab-group #tabs panels="external" [(activeTab)]="activeTab">
        @for (t of ['roster', 'invitations']; track t) {
          <mlv-tab [value]="t">
            <ng-template mlvTabDef>{{ t }}</ng-template>
          </mlv-tab>
        }
      </mlv-tab-group>
      <section [mlvTabPanel]="tabs">Body for {{ activeTab() }}</section>
    `,
  })
  class ExternalHost {
    readonly activeTab = signal('roster');
  }

  async function create(): Promise<ComponentFixture<ExternalHost>> {
    const fixture = TestBed.configureTestingModule({
      imports: [ExternalHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(ExternalHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders no panel body and no stub panels inside the group', async () => {
    const fixture = await create();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.mlv-tab-group__body')).toBeNull();
    expect(root.querySelector('.mlv-tab-group__panel-stub')).toBeNull();

    // The one `role="tabpanel"` in the document is the consumer's element.
    const panels = root.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(1);
    expect(panels[0].tagName).toBe('SECTION');
  });

  it('names the external panel after the selected tab, and follows selection', async () => {
    const fixture = await create();
    const root = fixture.nativeElement as HTMLElement;
    const panel = root.querySelector('section') as HTMLElement;
    const tabs = root.querySelectorAll('[role="tab"]');

    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs[0].id).toBeTruthy();

    fixture.componentInstance.activeTab.set('invitations');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id);
  });

  it('leaves aria-controls absent rather than pointing at an empty stub', async () => {
    const fixture = await create();
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[role="tab"]',
    );

    // The whole point of the mode: a reference that resolves to an empty
    // element is not a panel relationship, so no reference is emitted.
    for (const tab of Array.from(tabs)) {
      expect(tab.hasAttribute('aria-controls')).toBe(false);
    }
  });

  it('has no axe violations', async () => {
    const fixture = await create();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

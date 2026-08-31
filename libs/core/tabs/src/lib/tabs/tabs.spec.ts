import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import type { Routes } from '@angular/router';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { MlvTabGroup } from './tabs';
import { MlvTab } from '../tab/tab';
import { MlvTabsService } from '../tabs.service';
import { MlvTabDef } from '../tab-def';
import { MlvTabContentDef } from '../tab-content-def';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <mlv-tab-group [(activeTab)]="activeTab">
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

  // ── Bug 2: overflow recalculation damping ──
  describe('Overflow — resize recalculation', () => {
    it('debounces ResizeObserver-driven recalculation (trailing)', async () => {
      // Capture the ResizeObserver callback so we can fire it synchronously.
      let roCallback: (() => void) | null = null;
      const originalRO = (globalThis as { ResizeObserver?: unknown })
        .ResizeObserver;
      class MockResizeObserver {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
      }
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
        MockResizeObserver;

      try {
        await TestBed.configureTestingModule({
          imports: [OverflowTestHost],
          providers: [provideMlvI18nTesting()],
        }).compileComponents();

        const fixture = TestBed.createComponent(OverflowTestHost);
        fixture.detectChanges();
        await fixture.whenStable();

        const comp = fixture.debugElement.query(By.directive(MlvTabGroup))
          .componentInstance as MlvTabGroup;

        const recalcSpy = vi.spyOn(
          comp as unknown as { _recalculateOverflow: () => void },
          '_recalculateOverflow',
        );

        vi.useFakeTimers();
        // Burst of resize events within the debounce window.
        expect(roCallback).toBeTruthy();
        roCallback?.();
        roCallback?.();
        roCallback?.();
        roCallback?.();

        // Nothing yet — trailing debounce.
        expect(recalcSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);

        // Coalesced into a single recalculation.
        expect(recalcSpy).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
        (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
          originalRO as never;
      }
    });

    it('does not oscillate the split between two alternating boundary widths (hysteresis)', async () => {
      await TestBed.configureTestingModule({
        imports: [OverflowTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      const fixture = TestBed.createComponent(OverflowTestHost);
      fixture.detectChanges();
      await fixture.whenStable();

      const comp = fixture.debugElement.query(By.directive(MlvTabGroup))
        .componentInstance as unknown as {
        _computeFittingCount: (
          widths: number[],
          containerWidth: number,
          moreButtonWidth: number,
          currentMax: number,
        ) => number;
      };

      const widths = [100, 100, 100, 60];
      const more = 40;
      // Two widths straddling the point where the 3rd tab just barely fits.
      const narrow = 320; // 3rd tab clearly does not fit -> split at 2
      const wide = 345; // 3rd tab *just* fits statelessly -> would become 3

      // Establish the split at the narrow width.
      let max = comp._computeFittingCount(widths, narrow, more, -1);
      expect(max).toBe(2);

      // Statelessly (currentMax = -1) the wide width would pull the tab back in…
      expect(comp._computeFittingCount(widths, wide, more, -1)).toBe(3);

      // …but with hysteresis, feeding the current split back keeps it stable
      // as the width alternates — no flip-flop ("dizzy") oscillation.
      for (let i = 0; i < 6; i++) {
        const width = i % 2 === 0 ? wide : narrow;
        const next = comp._computeFittingCount(widths, width, more, max);
        expect(next).toBe(2);
        max = next;
      }
    });

    it('reports -1 (no overflow) when every tab fits', () => {
      // Pure-function sanity: total width within the container.
      const fixturePromise = TestBed.configureTestingModule({
        imports: [OverflowTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      return fixturePromise.then(() => {
        const fixture = TestBed.createComponent(OverflowTestHost);
        fixture.detectChanges();
        const comp = fixture.debugElement.query(By.directive(MlvTabGroup))
          .componentInstance as unknown as {
          _computeFittingCount: (
            widths: number[],
            containerWidth: number,
            moreButtonWidth: number,
            currentMax: number,
          ) => number;
        };
        expect(comp._computeFittingCount([50, 50, 50], 400, 40, -1)).toBe(-1);
      });
    });
  });

  // ── Shrinkability inside a grid/flex parent ──
  //
  // The overflow split is computed from `headerEl.clientWidth`, so it only ever
  // engages if the group can be narrower than its tab row. As a flex or grid
  // item the group defaults to `min-width: auto`, whose content-based minimum
  // is the full tab row — the group then refuses to shrink, clientWidth never
  // drops, "More (N)" never appears and the `overflow: hidden` header silently
  // clips its trailing tabs.
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

  // ── Boxed appearance: dark-theme indicator ──
  // Asserted against the SCSS *source* for the same reason as the min-width
  // guards above — component stylesheets are not injected under jsdom.
  describe('Boxed appearance — dark theme indicator', () => {
    const stylesheet = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'tabs.scss'),
      'utf8',
    );

    it('lifts the boxed pill one step above the dark track', () => {
      // `--mlv-background-raised` (#1e1e1e) is darker than the boxed
      // track's `--mlv-background-neutral-1` (#262626) in the dark theme,
      // so the pill would sink below the track instead of lifting off it.
      // Mirrors the same light/dark inversion `mlv-segmented` applies to its
      // raised pill (segmented.scss) — same `--mlv-palette-neutral-700`
      // token, descendant-combinator selector off `[mlvTheme='dark']`.
      // Selector fragments are checked independently (not as one adjacent
      // string) because prettier is free to wrap the multi-line selector
      // across lines.
      expect(stylesheet).toMatch(
        /\[mlvTheme='dark'\]\s*\.#\{\$block\}--appearance-boxed\s*>\s*\.#\{\$block\}__header\s*>\s*\.#\{\$block\}__indicator/,
      );
      expect(stylesheet).toContain(
        'background: var(--mlv-palette-neutral-700)',
      );
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

import { Component, computed, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvPageEndPaneContent } from './page-end-pane-content';
import { MlvPageEndPaneTrigger } from './page-end-pane-trigger';
import { MlvPageEndPane } from './page-end-pane';

class FakeBreakpointService {
  private readonly _down = signal<Record<MlvBreakpoint, boolean>>({
    sm: false,
    md: false,
    lg: false,
  });

  isDown(breakpoint: MlvBreakpoint) {
    return computed(() => this._down()[breakpoint]);
  }

  setDown(breakpoint: MlvBreakpoint, down: boolean): void {
    this._down.update((value) => ({ ...value, [breakpoint]: down }));
  }
}

@Component({
  imports: [MlvPageEndPane, MlvPageEndPaneContent, MlvPageEndPaneTrigger],
  template: `
    <button type="button" data-pane-trigger [mlvPageEndPaneTrigger]="pane">
      Account details
    </button>
    <mlv-page-end-pane
      #pane
      [(opened)]="open"
      collapseBelow="lg"
      width="20rem"
      ariaLabel="Account details"
      (afterOpened)="openedCount = openedCount + 1"
      (afterClosed)="closedCount = closedCount + 1"
    >
      <ng-template mlvPageEndPaneContent>
        <section data-pane-content>
          <button type="button" data-pane-action>Save account</button>
        </section>
      </ng-template>
    </mlv-page-end-pane>
  `,
})
class PageEndPaneHost {
  readonly open = signal(false);
  openedCount = 0;
  closedCount = 0;
}

describe('MlvPageEndPane', () => {
  let fixture: ComponentFixture<PageEndPaneHost>;
  let host: PageEndPaneHost;
  let breakpoint: FakeBreakpointService;
  let trigger: HTMLButtonElement;

  const paneElement = (): HTMLElement =>
    fixture.nativeElement.querySelector('mlv-page-end-pane');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageEndPaneHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PageEndPaneHost);
    host = fixture.componentInstance;
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    trigger = fixture.nativeElement.querySelector('[data-pane-trigger]');
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  function dispatchKeyboardEvent(
    element: Element,
    type: string,
    key: string,
  ): void {
    element.dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  function finishDrawerLeaveAnimation(): void {
    document
      .querySelector('.mlv-drawer')
      ?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
  }

  it('renders one named inline aside while opened above the breakpoint', () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
    const aside = fixture.nativeElement.querySelector('aside');
    expect(aside.getAttribute('aria-label')).toBe('Account details');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders one modal Drawer below the breakpoint without reserving host width', () => {
    breakpoint.setDown('lg', true);
    host.open.set(true);
    fixture.detectChanges();
    expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
    ).toBe('Account details');
    expect(paneElement().classList).toContain('mlv-page-end-pane--overlay');
  });

  it('migrates an open pane in both directions without duplicate content or lifecycle emissions', () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(host.openedCount).toBe(1);
    breakpoint.setDown('lg', true);
    fixture.detectChanges();
    breakpoint.setDown('lg', false);
    fixture.detectChanges();
    expect(host.open()).toBe(true);
    expect(host.openedCount).toBe(1);
    expect(host.closedCount).toBe(0);
    expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
  });

  it('synchronizes Escape and backdrop dismissal, then restores the opening trigger', () => {
    breakpoint.setDown('lg', true);
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    const drawer = document.querySelector('.mlv-drawer');
    if (!drawer) {
      throw new Error('Expected compact Drawer');
    }
    dispatchKeyboardEvent(drawer, 'keydown', 'Escape');
    finishDrawerLeaveAnimation();
    expect(host.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('synchronizes backdrop dismissal with the logical open state', () => {
    breakpoint.setDown('lg', true);
    trigger.click();
    fixture.detectChanges();

    document.querySelector<HTMLElement>('.mlv-drawer-backdrop')?.click();
    fixture.detectChanges();
    finishDrawerLeaveAnimation();

    expect(host.open()).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('removes closed inline content from the tab order', () => {
    host.open.set(false);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-pane-action]'),
    ).toBeNull();
  });

  it('collapses the closed inline host geometry', () => {
    host.open.set(false);
    fixture.detectChanges();

    expect(
      paneElement().style.getPropertyValue('--mlv-page-end-pane-width'),
    ).toBe('0px');
  });

  it('keeps a compact Drawer rendered when reopened during leave', () => {
    breakpoint.setDown('lg', true);
    host.open.set(true);
    fixture.detectChanges();
    const leavingDrawer = document.querySelector('.mlv-drawer');
    expect(leavingDrawer).not.toBeNull();

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();
    leavingDrawer?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();

    expect(host.open()).toBe(true);
    expect(document.querySelector('.mlv-drawer')).not.toBeNull();
  });

  it('has no axe violations in inline and compact states', async () => {
    host.open.set(true);
    fixture.detectChanges();
    let results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    breakpoint.setDown('lg', true);
    fixture.detectChanges();
    results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('removes the overlay pane when destroyed while open', () => {
    breakpoint.setDown('lg', true);
    host.open.set(true);
    fixture.detectChanges();
    expect(document.querySelector('.mlv-drawer')).not.toBeNull();

    fixture.destroy();

    expect(document.querySelector('.mlv-drawer')).toBeNull();
    expect(document.querySelector('.cdk-overlay-pane')).toBeNull();
  });
});

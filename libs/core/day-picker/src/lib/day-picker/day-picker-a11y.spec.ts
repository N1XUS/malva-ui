import {
  Component,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvDayPicker } from './day-picker';

@Component({
  imports: [MlvDayPicker],
  template: `<mlv-day-picker label="Due date" />`,
})
class A11yHost {
  readonly picker = viewChild.required(MlvDayPicker);
}

/**
 * Stubs the breakpoint service so the suite chooses its layout rather than
 * inheriting one. jsdom's `matchMedia` never matches a `min-width` query, so
 * the real service is pinned to `'sm'` and every open would be the full-screen
 * sheet — the anchored calendar would go unswept while looking covered.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

/**
 * The closed trigger is a fraction of this component: the calendar grid only
 * exists while the popup is open, and it is portaled into the CDK overlay
 * container, outside `fixture.nativeElement`. `.claude/rules/accessibility.md`
 * asks for one sweep per state that changes the markup, over `document.body`
 * for overlay content — so this suite sweeps closed, open-anchored and
 * open-sheet, which is what earns `core-day-picker`'s removal from
 * `ROLLOUT_PENDING` in `scripts/check-axe-coverage.mjs`.
 */
describe('MlvDayPicker accessibility', () => {
  let breakpoint: FakeBreakpointService;

  async function render(): Promise<{
    body: HTMLElement;
    open: () => Promise<void>;
  }> {
    await TestBed.configureTestingModule({
      imports: [A11yHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;

    const fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return {
      body: document.body,
      open: async () => {
        fixture.componentInstance.picker().toggleDropdown();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
    };
  }

  it('has no axe violations while closed', async () => {
    const { body } = await render();

    await expectNoAxeViolations(body);
  });

  it('has no axe violations with the anchored calendar open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(false);
    await open();

    expect(body.querySelectorAll('mlv-calendar').length).toBe(1);
    await expectNoAxeViolations(body);
  });

  it('has no axe violations with the full-screen sheet open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    expect(body.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
    await expectNoAxeViolations(body);
  });

  it('opens the full-screen sheet as a modal dialog named by its title', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    // #322: the sheet is a modal dialog named by its visible title.
    const sheet = body.querySelector('.mlv-popup--fullscreen') as HTMLElement;
    const title = sheet.querySelector('.mlv-popup__title') as HTMLElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(title.id).not.toBe('');
    expect(sheet.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent?.trim()).toBe('Due date');
    expect(sheet.hasAttribute('aria-label')).toBe(false);
  });
});

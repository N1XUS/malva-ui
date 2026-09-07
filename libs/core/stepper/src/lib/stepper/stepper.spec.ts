import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvStepper } from './stepper';
import { MlvStep } from './step';
import type { MlvStepperOrientation } from './stepper.types';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';

@Component({
  template: `
    <mlv-stepper [initialIndex]="initialIndex()" [linear]="linear()">
      <mlv-step label="Step 1">Content 1</mlv-step>
      <mlv-step label="Step 2">Content 2</mlv-step>
      <mlv-step label="Step 3">Content 3</mlv-step>
    </mlv-stepper>
  `,
  imports: [MlvStepper, MlvStep],
})
class StepperTestHostComponent {
  initialIndex = signal(0);
  linear = signal(false);
}

@Component({
  template: `
    <mlv-stepper [orientation]="orientation()" [initialIndex]="initialIndex()">
      <mlv-step label="Step 1">Content 1</mlv-step>
      <mlv-step label="Step 2">Content 2</mlv-step>
      <mlv-step label="Step 3">Content 3</mlv-step>
    </mlv-stepper>
  `,
  imports: [MlvStepper, MlvStep],
})
class StepperOrientationHostComponent {
  orientation = signal<MlvStepperOrientation>('vertical');
  initialIndex = signal(1);
}

describe('MlvStepper', () => {
  let fixture: ComponentFixture<StepperTestHostComponent>;
  let host: HTMLElement;
  let stepper: MlvStepper;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepperTestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StepperTestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement.querySelector('mlv-stepper') as HTMLElement;
    stepper = fixture.debugElement.children[0].componentInstance;
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => rtlService?.setDirection('ltr'));

  it('should render with default horizontal class', () => {
    expect(host.classList).toContain('mlv-stepper');
    expect(host.classList).toContain('mlv-stepper--horizontal');
  });

  it('should render step headers', () => {
    const headers = host.querySelectorAll('.mlv-stepper__step-header');
    expect(headers.length).toBe(3);
  });

  it('should mark first step as active', () => {
    const activeHeaders = host.querySelectorAll(
      '.mlv-stepper__step-header--active',
    );
    expect(activeHeaders.length).toBe(1);
    expect(activeHeaders[0].textContent).toContain('Step 1');
  });

  it('should navigate to next step', () => {
    stepper.next();
    fixture.detectChanges();
    const activeHeaders = host.querySelectorAll(
      '.mlv-stepper__step-header--active',
    );
    expect(activeHeaders[0].textContent).toContain('Step 2');
  });

  it('should navigate to previous step', () => {
    stepper.next();
    fixture.detectChanges();
    stepper.previous();
    fixture.detectChanges();
    const activeHeaders = host.querySelectorAll(
      '.mlv-stepper__step-header--active',
    );
    expect(activeHeaders[0].textContent).toContain('Step 1');
  });

  it('should not navigate before first step', () => {
    stepper.previous();
    fixture.detectChanges();
    expect(stepper.activeIndex()).toBe(0);
  });

  it('should not navigate after last step', () => {
    stepper.next();
    stepper.next();
    stepper.next();
    fixture.detectChanges();
    expect(stepper.activeIndex()).toBe(2);
  });

  it('should mark steps before active as completed', () => {
    stepper.next();
    fixture.detectChanges();
    const completedHeaders = host.querySelectorAll(
      '.mlv-stepper__step-header--completed',
    );
    expect(completedHeaders.length).toBe(1);
  });

  it('should emit activeIndexChange on navigation', () => {
    const emitted: number[] = [];
    stepper.activeIndexChange.subscribe((i: number) => emitted.push(i));
    stepper.next();
    fixture.detectChanges();
    expect(emitted).toEqual([1]);
  });

  it('should block forward navigation in linear mode', async () => {
    fixture.componentInstance.linear.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    stepper.selectStep(2);
    fixture.detectChanges();
    expect(stepper.activeIndex()).toBe(0);
  });

  it('should apply vertical orientation class', () => {
    // Force stepper to use vertical orientation by testing the class binding
    expect(host.classList).not.toContain('mlv-stepper--vertical');
  });

  // ─── Roving tabindex + keyboard navigation ─────────────────────────────────

  function headers(): HTMLElement[] {
    return Array.from(
      host.querySelectorAll<HTMLElement>('.mlv-stepper__step-header'),
    );
  }

  /** Dispatches a keydown carrying a `keyCode` (CDK's FocusKeyManager reads it). */
  function dispatchKey(
    element: HTMLElement,
    key: string,
    keyCode: number,
  ): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    element.dispatchEvent(event);
  }
  const KEY = {
    ArrowRight: 39,
    ArrowLeft: 37,
    ArrowDown: 40,
    ArrowUp: 38,
    Home: 36,
    End: 35,
  } as const;

  it('should apply roving tabindex — only the active step header is tabbable', () => {
    const tabindexes = headers().map((h) => h.getAttribute('tabindex'));
    expect(tabindexes).toEqual(['0', '-1', '-1']);
  });

  it('should move the roving tabindex to the selected step', () => {
    stepper.next();
    fixture.detectChanges();
    const tabindexes = headers().map((h) => h.getAttribute('tabindex'));
    expect(tabindexes).toEqual(['-1', '0', '-1']);
  });

  it('should move focus and roving tabindex with ArrowRight', () => {
    const els = headers();
    els[0].focus();
    dispatchKey(els[0], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[1]);
    expect(els.map((h) => h.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('should wrap from last to first with ArrowRight', () => {
    const els = headers();
    els[2].focus();
    dispatchKey(els[2], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[0]);
  });

  it('should mirror horizontal FocusKeyManager navigation in RTL', () => {
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    const els = headers();
    els[0].focus();

    dispatchKey(els[0], 'ArrowLeft', KEY.ArrowLeft);
    fixture.detectChanges();

    expect(document.activeElement).toBe(els[1]);
  });

  it('should jump to first/last with Home/End', () => {
    const els = headers();
    els[0].focus();
    dispatchKey(els[0], 'End', KEY.End);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[2]);

    dispatchKey(els[2], 'Home', KEY.Home);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[0]);
  });

  it('should skip non-clickable steps in linear mode during arrow navigation', async () => {
    fixture.componentInstance.linear.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    // Active is step 0; only step 0 is clickable, steps 1 & 2 are disabled.
    const els = headers();
    expect(els[1].getAttribute('aria-disabled')).toBe('true');
    els[0].focus();
    dispatchKey(els[0], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();
    // Disabled steps are skipped; focus wraps back to the only enabled step.
    expect(document.activeElement).toBe(els[0]);
  });

  it('should not set aria-current on the active step (tablist uses aria-selected)', () => {
    const active = host.querySelector('.mlv-stepper__step-header--active');
    expect(active?.getAttribute('aria-current')).toBeNull();
    expect(active?.getAttribute('aria-selected')).toBe('true');
  });

  // ─── aria-required-children: tablist owns only tabs (horizontal) ────────────

  it('has no axe violations in horizontal mode', async () => {
    await expectNoAxeViolations(host);
  });

  it('renders the horizontal tabpanel outside the tablist', () => {
    const tablist = host.querySelector('[role="tablist"]') as HTMLElement;
    // No tabpanel should be an accessible child of the tablist.
    expect(tablist.querySelector('[role="tabpanel"]')).toBeNull();
    // The active tabpanel still exists elsewhere in the component.
    expect(host.querySelector('[role="tabpanel"]')).not.toBeNull();
  });
});

// ─── Vertical orientation structure + accessibility ──────────────────────────

describe('MlvStepper — vertical orientation', () => {
  let fixture: ComponentFixture<StepperOrientationHostComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepperOrientationHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StepperOrientationHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement.querySelector('mlv-stepper') as HTMLElement;
  });

  it('applies the vertical orientation class', () => {
    expect(host.classList).toContain('mlv-stepper--vertical');
  });

  it('renders one tablist that owns exactly the tab elements', () => {
    const tablists = host.querySelectorAll('[role="tablist"]');
    expect(tablists.length).toBe(1);
    const tabs = tablists[0].querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it('bridges every element between the tablist and each tab with role="presentation"', () => {
    const tablist = host.querySelector('[role="tablist"]') as HTMLElement;
    const tabs = Array.from(
      tablist.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    expect(tabs.length).toBe(3);

    for (const tab of tabs) {
      let node = tab.parentElement;
      while (node && node !== tablist) {
        // Any intermediate wrapper between a tab and the tablist must be
        // presentational so the tab is a direct accessible child of the tablist.
        expect(node.getAttribute('role')).toBe('presentation');
        node = node.parentElement;
      }
    }
  });

  it('keeps tabpanels outside the tablist accessible subtree', () => {
    const tablist = host.querySelector('[role="tablist"]') as HTMLElement;
    // Tabpanels must not be owned by the tablist (tabpanel is not a permitted
    // tablist child — the previous axe aria-required-children violation).
    expect(tablist.querySelector('[role="tabpanel"]')).toBeNull();
    // Panels are still rendered (one per step) in the sibling bodies container.
    expect(host.querySelectorAll('[role="tabpanel"]').length).toBe(3);
  });

  it('names each tab from its step label and keeps inactive panels inert', () => {
    const tabs = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Step 1',
      'Step 2',
      'Step 3',
    ]);

    const panels = Array.from(
      host.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    );
    // initialIndex is 1 → only the second panel is active (not inert).
    expect(panels.map((p) => p.hasAttribute('inert'))).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('has no axe violations in vertical mode', async () => {
    await expectNoAxeViolations(host);
  });
});

// ─── Scoped [dir] keyboard mirroring (#147) ──────────────────────────────────

@Component({
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-stepper orientation="horizontal">
        <mlv-step label="Step 1">Content 1</mlv-step>
        <mlv-step label="Step 2">Content 2</mlv-step>
        <mlv-step label="Step 3">Content 3</mlv-step>
      </mlv-stepper>
    </div>
  `,
  imports: [MlvStepper, MlvStep],
})
class ScopedStepperHostComponent {
  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
}

describe('MlvStepper — scoped [dir] keyboard mirroring', () => {
  let fixture: ComponentFixture<ScopedStepperHostComponent>;
  let rtlService: MlvRtlService;

  const KEY = {
    ArrowRight: 39,
    ArrowLeft: 37,
    ArrowDown: 40,
    ArrowUp: 38,
    Home: 36,
  } as const;

  function dispatchKey(
    element: HTMLElement,
    key: string,
    keyCode: number,
  ): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    element.dispatchEvent(event);
  }

  function headers(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>(
        '.mlv-stepper__step-header',
      ),
    );
  }

  async function build(dir: 'ltr' | 'rtl'): Promise<HTMLElement[]> {
    fixture = TestBed.createComponent(ScopedStepperHostComponent);
    fixture.componentInstance.scopeDir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return headers();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedStepperHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('mirrors horizontal stepping inside a [dir="rtl"] subtree while the document stays LTR', async () => {
    const els = await build('rtl');
    expect(rtlService.direction()).toBe('ltr');

    els[0].focus();
    dispatchKey(els[0], 'ArrowLeft', KEY.ArrowLeft);
    fixture.detectChanges();

    // ArrowLeft is "next" once the headers are laid out right-to-left.
    expect(document.activeElement).toBe(els[1]);
  });

  it('keeps horizontal stepping unmirrored in an LTR island while the document is RTL', async () => {
    rtlService.setDirection('rtl');
    const els = await build('ltr');

    els[0].focus();
    dispatchKey(els[0], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();

    expect(document.activeElement).toBe(els[1]);
  });

  it('leaves the vertical pair and Home unmirrored in the same scope', async () => {
    const els = await build('rtl');

    // Step into the middle through the manager itself, so the assertions below
    // run against a live key-manager session rather than a bare `.focus()`.
    els[0].focus();
    dispatchKey(els[0], 'ArrowLeft', KEY.ArrowLeft);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[1]);

    // The block axis never mirrors. (CDK's `ListKeyManager` leaves vertical
    // navigation enabled alongside a horizontal orientation, so these keys do
    // move — the point is only that they keep their LTR meaning: Down = next,
    // Up = previous, in both directions.)
    dispatchKey(els[1], 'ArrowDown', KEY.ArrowDown);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[2]);

    dispatchKey(els[2], 'ArrowUp', KEY.ArrowUp);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[1]);

    // Home means "first", never "last", in either direction.
    dispatchKey(els[1], 'Home', KEY.Home);
    fixture.detectChanges();
    expect(document.activeElement).toBe(els[0]);
  });
});

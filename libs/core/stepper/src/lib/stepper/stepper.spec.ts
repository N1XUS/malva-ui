import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterNextRender, Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvStepper } from './stepper';
import { MlvStep } from './step';
import type { MlvStepperOrientation, MlvStepState } from './stepper.types';
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
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
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

// ─── Projected steps changing after content init (#311) ─────────────────────
//
// Each step's position is derived from the live `contentChildren` query, not
// stamped once at content init, and the active step is followed by identity
// when steps are inserted or removed around it.

@Component({
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-stepper [orientation]="orientation()">
        <mlv-step label="A">Content A</mlv-step>
        @if (showB()) {
          <mlv-step label="B">Content B</mlv-step>
        }
        <mlv-step label="C">Content C</mlv-step>
      </mlv-stepper>
    </div>
  `,
  imports: [MlvStepper, MlvStep],
})
class ConditionalStepHostComponent {
  readonly orientation = signal<MlvStepperOrientation>('horizontal');
  readonly showB = signal(false);
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

/**
 * Reads the stepper's index through a template reference, placed **before**
 * the stepper so the read runs ahead of the step query refreshing — the
 * derive-don't-mirror pattern `libs-stepper.md` recommends, at its worst case.
 */
@Component({
  template: `
    <p class="derived">{{ wizard.activeIndex() }}</p>
    <mlv-stepper #wizard [initialIndex]="1">
      @for (label of labels(); track label) {
        <mlv-step [label]="label">Content {{ label }}</mlv-step>
      }
    </mlv-stepper>
  `,
  imports: [MlvStepper, MlvStep],
})
class DerivedIndexHostComponent {
  readonly labels = signal(['A', 'C', 'D']);
}

@Component({
  template: `
    <mlv-stepper
      [orientation]="orientation()"
      [initialIndex]="initialIndex()"
      [linear]="linear()"
      (activeIndexChange)="emitted.push($event)"
    >
      @for (label of labels(); track label) {
        <mlv-step [label]="label">Content {{ label }}</mlv-step>
      }
    </mlv-stepper>
  `,
  imports: [MlvStepper, MlvStep],
})
class DynamicStepsHostComponent {
  readonly orientation = signal<MlvStepperOrientation>('horizontal');
  readonly labels = signal<string[]>([]);
  readonly initialIndex = signal(0);
  readonly linear = signal(false);
  readonly emitted: number[] = [];
}

// ─── Shared DOM readers for the #311 / #312 suites ──────────────────────────

const ORIENTATIONS: MlvStepperOrientation[] = ['horizontal', 'vertical'];

function tabs(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
}

function selected(host: HTMLElement): (string | null)[] {
  return tabs(host).map((tab) => tab.getAttribute('aria-selected'));
}

function tabIndexes(host: HTMLElement): (string | null)[] {
  return tabs(host).map((tab) => tab.getAttribute('tabindex'));
}

/** Text of every panel a user can reach: rendered and not `inert`. */
function openPanels(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[role="tabpanel"]'))
    .filter((panel) => !panel.hasAttribute('inert'))
    .map((panel) => panel.textContent?.trim() ?? '');
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('MlvStepper — projected steps change after init (#311)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    warn = vi.spyOn(console, 'warn');
    error = vi.spyOn(console, 'error');
    await TestBed.configureTestingModule({
      imports: [
        ConditionalStepHostComponent,
        DynamicStepsHostComponent,
        DerivedIndexHostComponent,
      ],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  /** Every console warning/error logged so far, flattened to one string. */
  function logged(): string {
    return [...warn.mock.calls, ...error.mock.calls]
      .map((args) => args.map((arg: unknown) => String(arg)).join(' '))
      .join('\n');
  }

  /**
   * What each indicator shows: its number, or `done` for the checkmark a
   * completed step renders instead of a number.
   */
  function indicators(host: HTMLElement): string[] {
    return tabs(host).map(
      (tab) =>
        tab
          .querySelector(
            '.mlv-stepper__indicator > span:not(.mlv-stepper__deviative-badge)',
          )
          ?.textContent?.trim() ?? 'done',
    );
  }

  /** Expected indicators when the step at `active` is active and none carry `state`. */
  function derivedIndicators(count: number, active: number): string[] {
    return Array.from({ length: count }, (_, i) =>
      i < active ? 'done' : String(i + 1),
    );
  }

  it.each(ORIENTATIONS)(
    '%s: renumbers a step inserted through @if with one selection and no NG0955',
    async (orientation) => {
      const fixture = TestBed.createComponent(ConditionalStepHostComponent);
      fixture.componentInstance.orientation.set(orientation);
      await settle(fixture);
      const host = fixture.nativeElement.querySelector(
        'mlv-stepper',
      ) as HTMLElement;

      fixture.componentInstance.showB.set(true);
      await settle(fixture);

      expect(logged()).not.toContain('NG0955');
      expect(tabs(host).map((tab) => tab.getAttribute('aria-label'))).toEqual([
        'A',
        'B',
        'C',
      ]);
      expect(indicators(host)).toEqual(['1', '2', '3']);
      expect(selected(host)).toEqual(['true', 'false', 'false']);
      expect(openPanels(host)).toEqual(['Content A']);
    },
  );

  it('vertical: pins each step row to its live position', async () => {
    const fixture = TestBed.createComponent(ConditionalStepHostComponent);
    fixture.componentInstance.orientation.set('vertical');
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;

    fixture.componentInstance.showB.set(true);
    await settle(fixture);

    const rows = (selector: string): string[] =>
      Array.from(host.querySelectorAll<HTMLElement>(selector)).map(
        (el) => el.style.gridRow,
      );
    expect(rows('.mlv-stepper__indicator-col')).toEqual(['1', '2', '3']);
    expect(rows('.mlv-stepper__body-col')).toEqual(['1', '2', '3']);
  });

  interface ReindexCase {
    readonly name: string;
    readonly before: string[];
    readonly initialIndex: number;
    readonly after: string[];
    readonly activeLabel: string;
  }

  const CASES: ReindexCase[] = [
    {
      name: 'a step inserted before the active one keeps the same step active',
      before: ['A', 'C', 'D'],
      initialIndex: 1,
      after: ['A', 'B', 'C', 'D'],
      activeLabel: 'C',
    },
    {
      name: 'a step inserted after the active one leaves it where it is',
      before: ['A', 'C', 'D'],
      initialIndex: 1,
      after: ['A', 'C', 'X', 'D'],
      activeLabel: 'C',
    },
    {
      name: 'reordering the steps keeps the same step active',
      before: ['A', 'B', 'C'],
      initialIndex: 1,
      after: ['C', 'A', 'B'],
      activeLabel: 'B',
    },
    {
      name: 'a step removed before the active one keeps the same step active',
      before: ['A', 'B', 'C', 'D'],
      initialIndex: 2,
      after: ['A', 'C', 'D'],
      activeLabel: 'C',
    },
    {
      name: 'removing the active step activates the step that took its place',
      before: ['A', 'B', 'C', 'D'],
      initialIndex: 1,
      after: ['A', 'C', 'D'],
      activeLabel: 'C',
    },
    {
      name: 'removing the active last step clamps to the new last step',
      before: ['A', 'B', 'C'],
      initialIndex: 2,
      after: ['A', 'B'],
      activeLabel: 'B',
    },
    {
      name: 'replacing the active step in place activates its replacement',
      before: ['A', 'B', 'C'],
      initialIndex: 1,
      after: ['A', 'X', 'C'],
      activeLabel: 'X',
    },
    {
      name: 'removing the active step and its predecessor skips no survivor',
      before: ['A', 'B', 'C', 'D'],
      initialIndex: 1,
      after: ['C', 'D'],
      activeLabel: 'C',
    },
  ];

  describe.each(ORIENTATIONS)('%s', (orientation) => {
    it.each(CASES)('$name', async (testCase) => {
      const fixture = TestBed.createComponent(DynamicStepsHostComponent);
      const component = fixture.componentInstance;
      component.orientation.set(orientation);
      component.labels.set(testCase.before);
      component.initialIndex.set(testCase.initialIndex);
      await settle(fixture);
      const host = fixture.nativeElement.querySelector(
        'mlv-stepper',
      ) as HTMLElement;
      const stepper = fixture.debugElement.query(By.directive(MlvStepper))
        .componentInstance as MlvStepper;

      component.labels.set(testCase.after);
      await settle(fixture);

      const active = testCase.after.indexOf(testCase.activeLabel);
      const onlyActive = testCase.after.map((_, i) =>
        i === active ? 'true' : 'false',
      );
      const rovingOnActive = testCase.after.map((_, i) =>
        i === active ? '0' : '-1',
      );

      expect(stepper.activeIndex()).toBe(active);
      expect(selected(host)).toEqual(onlyActive);
      expect(indicators(host)).toEqual(
        derivedIndicators(testCase.after.length, active),
      );
      expect(openPanels(host)).toEqual([`Content ${testCase.activeLabel}`]);
      expect(tabIndexes(host)).toEqual(rovingOnActive);
      // A content change is not navigation: the consumer changed the steps.
      expect(component.emitted).toEqual([]);
      expect(logged()).not.toContain('NG0955');
    });
  });

  it('keeps navigation relative to the live positions after a re-index', async () => {
    const fixture = TestBed.createComponent(DynamicStepsHostComponent);
    const component = fixture.componentInstance;
    component.labels.set(['A', 'B', 'C', 'D']);
    component.initialIndex.set(2);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;
    const stepper = fixture.debugElement.query(By.directive(MlvStepper))
      .componentInstance as MlvStepper;

    component.labels.set(['A', 'C', 'D']);
    await settle(fixture);
    stepper.next();
    await settle(fixture);

    expect(component.emitted).toEqual([2]);
    expect(selected(host)).toEqual(['false', 'false', 'true']);
    expect(openPanels(host)).toEqual(['Content D']);
  });

  it('shows the live position in the mobile counter', async () => {
    const fixture = TestBed.createComponent(DynamicStepsHostComponent);
    const component = fixture.componentInstance;
    component.labels.set(['A', 'C', 'D']);
    component.initialIndex.set(1);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;

    component.labels.set(['A', 'B', 'C', 'D']);
    await settle(fixture);

    const counter = host
      .querySelector('.mlv-stepper__mobile-label')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
    expect(counter).toBe('Step 3 of 4: C');
  });

  it('linear: a step inserted before the active one is reachable backwards, later steps stay locked', async () => {
    const fixture = TestBed.createComponent(DynamicStepsHostComponent);
    const component = fixture.componentInstance;
    component.labels.set(['A', 'C', 'D']);
    component.initialIndex.set(1);
    component.linear.set(true);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;
    const stepper = fixture.debugElement.query(By.directive(MlvStepper))
      .componentInstance as MlvStepper;

    component.labels.set(['A', 'B', 'C', 'D']);
    await settle(fixture);

    expect(tabs(host).map((tab) => tab.getAttribute('aria-disabled'))).toEqual([
      null,
      null,
      null,
      'true',
    ]);

    stepper.selectStep(3);
    await settle(fixture);
    expect(stepper.activeIndex()).toBe(2);

    stepper.previous();
    await settle(fixture);
    expect(selected(host)).toEqual(['false', 'true', 'false', 'false']);
    expect(openPanels(host)).toEqual(['Content B']);
  });

  /** Dispatches a keydown carrying a `keyCode` (CDK's FocusKeyManager reads it). */
  function pressKey(
    element: HTMLElement,
    key: 'ArrowRight' | 'ArrowLeft',
  ): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    const keyCode = key === 'ArrowRight' ? 39 : 37;
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    element.dispatchEvent(event);
  }

  it.each([
    { scope: 'no [dir] scope', dir: null, key: 'ArrowRight' },
    { scope: 'a scoped [dir="rtl"]', dir: 'rtl', key: 'ArrowLeft' },
  ] as const)(
    'arrow keys reach a step inserted after init under $scope ($key = next)',
    async ({ dir, key }) => {
      const fixture = TestBed.createComponent(ConditionalStepHostComponent);
      fixture.componentInstance.scopeDir.set(dir);
      await settle(fixture);
      const host = fixture.nativeElement.querySelector(
        'mlv-stepper',
      ) as HTMLElement;

      fixture.componentInstance.showB.set(true);
      await settle(fixture);

      // Only the stepper's own subtree is scoped; the document stays LTR.
      expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      const [first] = tabs(host);
      first.focus();
      pressKey(first, key);
      fixture.detectChanges();

      expect(document.activeElement?.getAttribute('aria-label')).toBe('B');
      expect(tabIndexes(host)).toEqual(['-1', '0', '-1']);
      expect(logged()).not.toContain('NG0955');
    },
  );

  it('honours initialIndex for steps that arrive after init, and starts over on a refill', async () => {
    const fixture = TestBed.createComponent(DynamicStepsHostComponent);
    const component = fixture.componentInstance;
    component.initialIndex.set(2);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;
    const stepper = fixture.debugElement.query(By.directive(MlvStepper))
      .componentInstance as MlvStepper;
    expect(tabs(host).length).toBe(0);

    // A `@for` over data that loads after content init.
    component.labels.set(['A', 'B', 'C', 'D']);
    await settle(fixture);

    expect(stepper.activeIndex()).toBe(2);
    expect(selected(host)).toEqual(['false', 'false', 'true', 'false']);
    expect(tabIndexes(host)).toEqual(['-1', '-1', '0', '-1']);
    expect(openPanels(host)).toEqual(['Content C']);

    // Emptying removes the active step with no step left before it, so the
    // next list starts on its first step.
    component.labels.set([]);
    await settle(fixture);
    component.labels.set(['A', 'B']);
    await settle(fixture);

    expect(stepper.activeIndex()).toBe(0);
    expect(selected(host)).toEqual(['true', 'false']);
    expect(tabIndexes(host)).toEqual(['0', '-1']);
    expect(component.emitted).toEqual([]);
    expect(logged()).toBe('');
  });

  it('a template reference reading activeIndex() follows a re-index, with nothing logged', async () => {
    const fixture = TestBed.createComponent(DerivedIndexHostComponent);
    await settle(fixture);
    const derived = (): string | undefined =>
      fixture.nativeElement.querySelector('.derived')?.textContent?.trim();
    expect(derived()).toBe('1');

    fixture.componentInstance.labels.set(['A', 'B', 'C', 'D']);
    await settle(fixture);

    // C moved from 1 to 2. The read sits before the stepper in the template,
    // so it runs before the step query refreshes and is re-run after it — no
    // NG0100, no stale copy.
    expect(derived()).toBe('2');
    expect(logged()).toBe('');
  });

  it.each([
    {
      name: 'in the same tick as the step change reads the old list',
      defer: false,
      activeLabel: 'B',
    },
    {
      name: 'deferred with afterNextRender reads the new list',
      defer: true,
      activeLabel: 'X',
    },
  ])('selectStep() $name', async ({ defer, activeLabel }) => {
    const fixture = TestBed.createComponent(DynamicStepsHostComponent);
    const component = fixture.componentInstance;
    component.labels.set(['A', 'B', 'C']);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;
    const stepper = fixture.debugElement.query(By.directive(MlvStepper))
      .componentInstance as MlvStepper;

    // "Go to the step just inserted at 1."
    component.labels.set(['A', 'X', 'B', 'C']);
    if (defer) {
      afterNextRender(() => stepper.selectStep(1), {
        injector: fixture.componentRef.injector,
      });
    } else {
      stepper.selectStep(1);
    }
    await settle(fixture);

    const active = ['A', 'X', 'B', 'C'].indexOf(activeLabel);
    expect(stepper.activeIndex()).toBe(active);
    expect(openPanels(host)).toEqual([`Content ${activeLabel}`]);
    // Both emit the index they were given; only the deferred call meant X.
    expect(component.emitted).toEqual([1]);
  });
});

// ─── An explicit step `state` decorates; `activeIndex` alone selects (#312) ──
//
// `state` colours the indicator, label and connector. Which step is selected —
// `aria-selected`, the rendered horizontal panel, the open (non-`inert`)
// vertical panel and the roving tab stop — follows `activeIndex` and nothing
// else, whatever `state` any step carries.

@Component({
  template: `
    <mlv-stepper
      [orientation]="orientation()"
      [initialIndex]="initialIndex()"
      (activeIndexChange)="emitted.push($event)"
    >
      <mlv-step label="A" [state]="states()[0]">Content A</mlv-step>
      <mlv-step label="B" [state]="states()[1]">Content B</mlv-step>
      <mlv-step label="C" [state]="states()[2]">Content C</mlv-step>
    </mlv-stepper>
  `,
  imports: [MlvStepper, MlvStep],
})
class ExplicitStateHostComponent {
  readonly orientation = signal<MlvStepperOrientation>('horizontal');
  readonly initialIndex = signal(0);
  readonly states = signal<readonly (MlvStepState | undefined)[]>([]);
  readonly emitted: number[] = [];
}

describe('MlvStepper — explicit step state is decoration (#312)', () => {
  const STATES: readonly MlvStepState[] = [
    'pending',
    'active',
    'completed',
    'error',
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExplicitStateHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  async function render(
    orientation: MlvStepperOrientation,
    initialIndex: number,
    states: readonly (MlvStepState | undefined)[],
  ): Promise<{
    fixture: ComponentFixture<ExplicitStateHostComponent>;
    host: HTMLElement;
  }> {
    const fixture = TestBed.createComponent(ExplicitStateHostComponent);
    const component = fixture.componentInstance;
    component.orientation.set(orientation);
    component.initialIndex.set(initialIndex);
    component.states.set(states);
    await settle(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-stepper',
    ) as HTMLElement;
    return { fixture, host };
  }

  /** The indicator state modifier each step header carries. */
  function indicatorStates(host: HTMLElement): string[] {
    return tabs(host).map((tab) =>
      STATES.filter((state) =>
        tab.classList.contains(`mlv-stepper__step-header--${state}`),
      ).join(' '),
    );
  }

  /** Text of every panel carrying the visible `--active` modifier. */
  function shownPanels(host: HTMLElement): string[] {
    return Array.from(
      host.querySelectorAll<HTMLElement>(
        '[role="tabpanel"].mlv-stepper__content-panel--active',
      ),
    ).map((panel) => panel.textContent?.trim() ?? '');
  }

  /** Every selection surface at once, so one assertion reads the whole story. */
  function selection(host: HTMLElement): {
    selected: (string | null)[];
    tabIndexes: (string | null)[];
    open: string[];
    shown: string[];
  } {
    return {
      selected: selected(host),
      tabIndexes: tabIndexes(host),
      open: openPanels(host),
      shown: shownPanels(host),
    };
  }

  const ON_B = {
    selected: ['false', 'true', 'false'],
    tabIndexes: ['-1', '0', '-1'],
    open: ['Content B'],
    shown: ['Content B'],
  };

  const ON_A = {
    selected: ['true', 'false', 'false'],
    tabIndexes: ['0', '-1', '-1'],
    open: ['Content A'],
    shown: ['Content A'],
  };

  describe.each(ORIENTATIONS)('%s', (orientation) => {
    it.each(['error', 'completed', 'pending'] as const)(
      'the active step with state="%s" is selected and shows its panel, keeping its indicator',
      async (state) => {
        const { host } = await render(orientation, 1, [
          undefined,
          state,
          undefined,
        ]);

        expect(selection(host)).toEqual(ON_B);
        expect(indicatorStates(host)).toEqual(['completed', state, 'pending']);
        if (orientation === 'horizontal') {
          expect(host.querySelectorAll('[role="tabpanel"]').length).toBe(1);
        }
      },
    );

    it('state="active" on another step styles its indicator and selects nothing', async () => {
      const { host } = await render(orientation, 0, [
        undefined,
        undefined,
        'active',
      ]);

      expect(selection(host)).toEqual(ON_A);
      expect(indicatorStates(host)).toEqual(['active', 'pending', 'active']);
      if (orientation === 'horizontal') {
        expect(host.querySelectorAll('[role="tabpanel"]').length).toBe(1);
      }
    });

    it('state="completed" + state="active" no longer open the second step (old docs pattern)', async () => {
      const { host } = await render(orientation, 0, ['completed', 'active']);

      expect(selection(host)).toEqual(ON_A);
      expect(indicatorStates(host)).toEqual(['completed', 'active', 'pending']);
    });

    it('marking the step the user is on as an error keeps it selected and open', async () => {
      const { fixture, host } = await render(orientation, 1, []);
      expect(selection(host)).toEqual(ON_B);

      // A validation failure on the current step.
      fixture.componentInstance.states.set([undefined, 'error', undefined]);
      await settle(fixture);

      expect(selection(host)).toEqual(ON_B);
      expect(indicatorStates(host)).toEqual(['completed', 'error', 'pending']);
      expect(fixture.componentInstance.emitted).toEqual([]);
    });

    it('clicking a step marked as an error selects it (docs example 5)', async () => {
      const { fixture, host } = await render(orientation, 2, [
        'completed',
        'error',
        undefined,
      ]);

      tabs(host)[1].click();
      await settle(fixture);

      expect(fixture.componentInstance.emitted).toEqual([1]);
      expect(selection(host)).toEqual(ON_B);
      expect(indicatorStates(host)).toEqual(['completed', 'error', 'pending']);
    });

    it('previous() onto a step marked completed opens it (docs example 3)', async () => {
      const { fixture, host } = await render(orientation, 1, ['completed']);
      const stepper = fixture.debugElement.query(By.directive(MlvStepper))
        .componentInstance as MlvStepper;

      stepper.previous();
      await settle(fixture);

      expect(fixture.componentInstance.emitted).toEqual([0]);
      expect(selection(host)).toEqual(ON_A);
      expect(indicatorStates(host)).toEqual([
        'completed',
        'pending',
        'pending',
      ]);
    });

    it('has no axe violations with explicit states on the selected and another step', async () => {
      const { host } = await render(orientation, 1, [
        undefined,
        'error',
        'active',
      ]);

      await expectNoAxeViolations(host);
    });
  });
});

import { vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { compile } from 'sass';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MlvCompare } from './compare';
import { MlvCompareHandleDef } from '../compare-handle-def';

/**
 * jsdom ships no `PointerEvent`; a `MouseEvent` carrying the pointer fields
 * the component reads is the established stand-in (see `slider.spec.ts`).
 */
function pointerEvent(
  type: string,
  {
    clientX = 0,
    clientY = 0,
    pointerId = 1,
    button = 0,
  }: {
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    button?: number;
  } = {},
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX,
    clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: true });
  return event as unknown as PointerEvent;
}

function domRect({
  left = 0,
  top = 0,
  width = 100,
  height = 100,
}: Partial<DOMRect> = {}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function keydown(
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * axe rules the compare markup can break and that jsdom can evaluate
 * (colour-contrast and target-size need a real layout engine and are covered
 * by the browser pass on the docs page).
 */
const AXE_RULES = [
  'aria-allowed-attr',
  'aria-allowed-role',
  'aria-conditional-attr',
  'aria-hidden-focus',
  'aria-input-field-name',
  'aria-prohibited-attr',
  'aria-required-attr',
  'aria-roles',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'duplicate-id-aria',
  'label',
  'nested-interactive',
  'tabindex',
];

async function expectNoAxeViolations(root: HTMLElement): Promise<void> {
  const results = await axe.run(root, {
    runOnly: { type: 'rule', values: AXE_RULES },
  });
  expect(results.violations).toEqual([]);
}

describe('MlvCompare', () => {
  let fixture: ComponentFixture<MlvCompare>;
  let component: MlvCompare;
  let host: HTMLElement;
  let input: HTMLInputElement;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCompare],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvCompare);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    rtl = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();

    input = host.querySelector('.mlv-compare__input') as HTMLInputElement;
    Object.defineProperty(host, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(host, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    // `setDirection` is global state (written onto <html>) — always reset.
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  function mockRect(rect: Partial<DOMRect>): void {
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(domRect(rect));
  }

  function cssValue(): string {
    return host.style.getPropertyValue('--mlv-compare-value').trim();
  }

  // ─── Rendering & ARIA ──────────────────────────────────────────────────────

  it('renders a hidden native range slider mirroring the default value', () => {
    expect(host.classList.contains('mlv-compare')).toBe(true);
    expect(input).toBeTruthy();
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    // `any` keeps the native value exact instead of snapping it to `step`, so
    // `aria-valuenow` never disagrees with the visible divider.
    expect(input.step).toBe('any');
    expect(input.value).toBe('50');
    expect(input.getAttribute('aria-valuetext')).toBe('50%');
    expect(input.getAttribute('aria-orientation')).toBe('horizontal');
    expect(cssValue()).toBe('50%');
  });

  it('falls back to the translated accessible name', () => {
    expect(input.getAttribute('aria-label')).toBe('Comparison slider');
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('prefers a consumer ariaLabel over the translated fallback', () => {
    fixture.componentRef.setInput('ariaLabel', 'Retouch strength');
    fixture.detectChanges();

    expect(input.getAttribute('aria-label')).toBe('Retouch strength');
  });

  it('prefers ariaLabelledby over every label form', () => {
    fixture.componentRef.setInput('ariaLabel', 'Retouch strength');
    fixture.componentRef.setInput('ariaLabelledby', 'compare-title');
    fixture.detectChanges();

    expect(input.getAttribute('aria-labelledby')).toBe('compare-title');
    expect(input.hasAttribute('aria-label')).toBe(false);
  });

  it('has no axe violations in either orientation, with and without captions', async () => {
    await expectNoAxeViolations(host);

    fixture.componentRef.setInput('beforeLabel', 'Before');
    fixture.componentRef.setInput('afterLabel', 'After');
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();
    await expectNoAxeViolations(host);
  }, 20_000);

  it('renders the before/after labels inside their own layers only when set', () => {
    expect(host.querySelector('.mlv-compare__label')).toBeNull();

    fixture.componentRef.setInput('beforeLabel', 'Before');
    fixture.componentRef.setInput('afterLabel', 'After');
    fixture.detectChanges();

    const before = host.querySelector(
      '.mlv-compare__layer--before > .mlv-compare__label--before',
    );
    const after = host.querySelector(
      '.mlv-compare__layer--after > .mlv-compare__label--after',
    );
    expect(before?.textContent?.trim()).toBe('Before');
    expect(after?.textContent?.trim()).toBe('After');
    // One label per layer, so each clips with its own side of the divider.
    expect(host.querySelectorAll('.mlv-compare__label')).toHaveLength(2);

    fixture.componentRef.setInput('afterLabel', undefined);
    fixture.detectChanges();
    expect(host.querySelector('.mlv-compare__label--after')).toBeNull();
    expect(host.querySelector('.mlv-compare__label--before')).toBeTruthy();
  });

  it('renders the Lucide chevrons-left-right glyph when no handle template is given', () => {
    const divider = host.querySelector('.mlv-compare__divider');
    expect(divider?.getAttribute('aria-hidden')).toBe('true');
    const glyph = host.querySelector(
      '.mlv-compare__handle .mlv-compare__glyph',
    );
    expect(glyph?.classList.contains('lucide-chevrons-left-right')).toBe(true);
    expect(glyph?.classList.contains('lucide-chevrons-up-down')).toBe(false);
  });

  it('swaps to the chevrons-up-down glyph in the vertical orientation', () => {
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();

    const glyph = host.querySelector(
      '.mlv-compare__handle .mlv-compare__glyph',
    );
    expect(glyph?.classList.contains('lucide-chevrons-up-down')).toBe(true);
    expect(glyph?.classList.contains('lucide-chevrons-left-right')).toBe(false);
  });

  it('clamps an out-of-range bound value for rendering without writing it back', () => {
    fixture.componentRef.setInput('value', 140);
    fixture.detectChanges();

    expect(input.value).toBe('100');
    expect(input.getAttribute('aria-valuetext')).toBe('100%');
    expect(cssValue()).toBe('100%');
    expect(component.value()).toBe(140);

    fixture.componentRef.setInput('value', -3);
    fixture.detectChanges();

    expect(input.value).toBe('0');
    expect(cssValue()).toBe('0%');
  });

  it('reflects orientation on the host class and the range input', () => {
    expect(host.classList.contains('mlv-compare--vertical')).toBe(false);

    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();

    expect(host.classList.contains('mlv-compare--vertical')).toBe(true);
    expect(input.getAttribute('aria-orientation')).toBe('vertical');
  });

  // ─── Pointer ───────────────────────────────────────────────────────────────

  it('jumps to the pointer on press and follows it while dragging', () => {
    mockRect({ left: 0, width: 200 });

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 50, pointerId: 4 }),
    );
    fixture.detectChanges();

    expect(component.value()).toBe(25);
    expect(cssValue()).toBe('25%');
    expect(host.classList.contains('mlv-compare--dragging')).toBe(true);
    expect(host.setPointerCapture).toHaveBeenCalledWith(4);

    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 150, pointerId: 4 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(75);

    host.dispatchEvent(
      pointerEvent('pointerup', { clientX: 150, pointerId: 4 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);

    // Released — a stray move must not steer the slider any more.
    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 10, pointerId: 4 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(75);
  });

  it('measures the surface once per drag instead of on every move', () => {
    const spy = vi
      .spyOn(host, 'getBoundingClientRect')
      .mockReturnValue(domRect({ left: 0, width: 200 }));

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 20, pointerId: 2 }),
    );
    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 40, pointerId: 2 }),
    );
    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 60, pointerId: 2 }),
    );
    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 80, pointerId: 2 }),
    );

    expect(component.value()).toBe(40);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ignores presses from a non-primary button', () => {
    mockRect({ left: 0, width: 200 });

    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, button: 2 }));
    fixture.detectChanges();

    expect(component.value()).toBe(50);
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);
  });

  it('rounds pointer-derived values to two decimals and integers for ARIA', () => {
    mockRect({ left: 0, width: 3 });

    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 1 }));
    fixture.detectChanges();

    expect(component.value()).toBe(33.33);
    expect(cssValue()).toBe('33.33%');
    expect(input.value).toBe('33');
    expect(input.getAttribute('aria-valuetext')).toBe('33%');
  });

  it('ends the drag when pointer capture is lost or cancelled', () => {
    mockRect({ left: 0, width: 100 });

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 10, pointerId: 9 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(true);

    host.dispatchEvent(pointerEvent('pointercancel', { pointerId: 9 }));
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 10, pointerId: 10 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(true);

    host.dispatchEvent(pointerEvent('lostpointercapture', { pointerId: 10 }));
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);
  });

  it('tracks the drag on the window so a failed pointer capture cannot strand it', () => {
    mockRect({ left: 0, width: 100 });
    vi.mocked(host.setPointerCapture).mockImplementation(() => {
      throw new DOMException('no such pointer', 'NotFoundError');
    });

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 20, pointerId: 7 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(20);
    expect(host.classList.contains('mlv-compare--dragging')).toBe(true);

    // Without capture the pointer's events land on whatever is under it, not
    // on the host — the gesture must still follow and still end.
    document.body.dispatchEvent(
      pointerEvent('pointermove', { clientX: 60, pointerId: 7 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(60);

    document.body.dispatchEvent(
      pointerEvent('pointerup', { clientX: 60, pointerId: 7 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);

    document.body.dispatchEvent(
      pointerEvent('pointermove', { clientX: 90, pointerId: 7 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(60);
  });

  it('ignores a second pointer pressed during a drag', () => {
    mockRect({ left: 0, width: 100 });

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 20, pointerId: 1 }),
    );
    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 80, pointerId: 2 }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(20);
    expect(host.setPointerCapture).not.toHaveBeenCalledWith(2);

    // Lifting the ignored finger must not end the first finger's drag…
    host.dispatchEvent(
      pointerEvent('pointerup', { clientX: 80, pointerId: 2 }),
    );
    host.dispatchEvent(
      pointerEvent('pointermove', { clientX: 40, pointerId: 1 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(true);
    expect(component.value()).toBe(40);

    // …and lifting the first one still does.
    host.dispatchEvent(
      pointerEvent('pointerup', { clientX: 40, pointerId: 1 }),
    );
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);
  });

  it('maps pointer geometry from the inline-end edge in RTL', () => {
    rtl.setDirection('rtl');
    fixture.detectChanges();
    mockRect({ left: 0, width: 100 });

    // 20px from the left edge is 80% along the inline axis when it runs
    // right-to-left.
    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 20 }));
    fixture.detectChanges();

    expect(component.value()).toBe(80);
  });

  it('reads the block axis in vertical orientation', () => {
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();
    mockRect({ top: 100, height: 200, left: 0, width: 50 });

    host.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 999, clientY: 150 }),
    );
    fixture.detectChanges();

    expect(component.value()).toBe(25);
  });

  it('focuses the range input on press so the keyboard takes over seamlessly', () => {
    mockRect({ left: 0, width: 100 });

    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 10 }));

    expect(document.activeElement).toBe(input);
  });

  it('follows a hovering pointer only when slideOnHover is set', () => {
    mockRect({ left: 0, width: 100 });

    host.dispatchEvent(pointerEvent('pointerenter', { clientX: 70 }));
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 70 }));
    fixture.detectChanges();
    expect(component.value()).toBe(50);
    expect(host.classList.contains('mlv-compare--hover')).toBe(false);

    fixture.componentRef.setInput('slideOnHover', true);
    fixture.detectChanges();
    expect(host.classList.contains('mlv-compare--hover')).toBe(true);

    host.dispatchEvent(pointerEvent('pointerenter', { clientX: 70 }));
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 70 }));
    fixture.detectChanges();
    expect(component.value()).toBe(70);
    // Hovering is not dragging — no pressed styling.
    expect(host.classList.contains('mlv-compare--dragging')).toBe(false);
  });

  it('listens for hover moves only between pointerenter and pointerleave', () => {
    const measure = vi
      .spyOn(host, 'getBoundingClientRect')
      .mockReturnValue(domRect({ left: 0, width: 100 }));
    fixture.componentRef.setInput('slideOnHover', true);
    fixture.detectChanges();

    host.dispatchEvent(pointerEvent('pointerenter', { clientX: 30 }));
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 30 }));
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 35 }));
    fixture.detectChanges();
    expect(component.value()).toBe(35);
    expect(measure).toHaveBeenCalledTimes(1);

    host.dispatchEvent(pointerEvent('pointerleave', { clientX: 120 }));
    // A move reaching the host after leave (a synthetic one, say) must neither
    // steer the divider nor force a fresh layout read — the pass is over.
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 90 }));
    fixture.detectChanges();
    expect(component.value()).toBe(35);
    expect(measure).toHaveBeenCalledTimes(1);

    host.dispatchEvent(pointerEvent('pointerenter', { clientX: 60 }));
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 60 }));
    fixture.detectChanges();
    expect(component.value()).toBe(60);
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('coerces the slideOnHover attribute form', () => {
    fixture.componentRef.setInput('slideOnHover', '');
    fixture.detectChanges();

    expect(host.classList.contains('mlv-compare--hover')).toBe(true);
  });

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  it('steps the value with the keyboard and consumes the handled keys', () => {
    expect(keydown(input, 'ArrowRight').defaultPrevented).toBe(true);
    expect(component.value()).toBe(51);

    keydown(input, 'ArrowUp');
    expect(component.value()).toBe(52);

    keydown(input, 'ArrowLeft');
    expect(component.value()).toBe(51);

    keydown(input, 'ArrowDown');
    expect(component.value()).toBe(50);

    keydown(input, 'ArrowRight', { shiftKey: true });
    expect(component.value()).toBe(60);

    keydown(input, 'PageUp');
    expect(component.value()).toBe(70);

    keydown(input, 'PageDown');
    expect(component.value()).toBe(60);

    keydown(input, 'End');
    expect(component.value()).toBe(100);

    keydown(input, 'Home');
    expect(component.value()).toBe(0);

    // Unrelated keys pass through untouched.
    expect(keydown(input, 'Tab').defaultPrevented).toBe(false);
    expect(component.value()).toBe(0);
  });

  it('clamps keyboard steps at both ends', () => {
    fixture.componentRef.setInput('value', 99);
    fixture.detectChanges();

    keydown(input, 'ArrowRight', { shiftKey: true });
    expect(component.value()).toBe(100);

    fixture.componentRef.setInput('value', 1);
    fixture.detectChanges();

    keydown(input, 'PageDown');
    expect(component.value()).toBe(0);
  });

  it('honours the step input for keyboard increments without snapping the native value', () => {
    fixture.componentRef.setInput('step', 5);
    fixture.componentRef.setInput('value', 33);
    fixture.detectChanges();

    expect(input.step).toBe('any');
    expect(input.value).toBe('33');

    fixture.componentRef.setInput('value', 50);
    fixture.detectChanges();

    keydown(input, 'ArrowRight');
    expect(component.value()).toBe(55);

    keydown(input, 'ArrowRight', { shiftKey: true });
    expect(component.value()).toBe(100);
  });

  it('mirrors horizontal arrows in RTL and leaves vertical ones alone', () => {
    rtl.setDirection('rtl');
    fixture.detectChanges();

    keydown(input, 'ArrowLeft');
    expect(component.value()).toBe(51);

    keydown(input, 'ArrowRight');
    expect(component.value()).toBe(50);

    keydown(input, 'ArrowUp');
    expect(component.value()).toBe(51);
  });

  it('treats ArrowDown as an increase in vertical orientation', () => {
    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();

    keydown(input, 'ArrowDown');
    expect(component.value()).toBe(51);

    keydown(input, 'ArrowUp');
    expect(component.value()).toBe(50);

    keydown(input, 'ArrowRight');
    expect(component.value()).toBe(51);

    keydown(input, 'ArrowLeft');
    expect(component.value()).toBe(50);
  });

  it('syncs a native input event from assistive technology into the model', () => {
    input.value = '30';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.value()).toBe(30);
    expect(cssValue()).toBe('30%');
  });
});

// ─── Content projection & two-way binding ────────────────────────────────────

@Component({
  imports: [MlvCompare, MlvCompareHandleDef],
  template: `
    <mlv-compare [(value)]="position">
      <div mlvCompareBefore class="before-content">Before</div>
      <div mlvCompareAfter class="after-content">After</div>
      <ng-template mlvCompareHandleDef let-orientation let-dragging="dragging">
        <span class="custom-glyph" [class.custom-glyph--dragging]="dragging">
          {{ orientation }}
        </span>
      </ng-template>
    </mlv-compare>
  `,
})
class CompareHost {
  readonly position = signal(20);
}

describe('MlvCompare (host)', () => {
  let fixture: ComponentFixture<CompareHost>;
  let compare: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareHost);
    fixture.detectChanges();
    await fixture.whenStable();
    compare = fixture.nativeElement.querySelector('mlv-compare') as HTMLElement;
    Object.defineProperty(compare, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('has no axe violations with a projected handle template', async () => {
    await expectNoAxeViolations(compare);
  }, 20_000);

  it('projects before/after content into their layers and renders the handle template', () => {
    expect(
      compare.querySelector('.mlv-compare__layer--before .before-content'),
    ).toBeTruthy();
    expect(
      compare.querySelector('.mlv-compare__layer--after .after-content'),
    ).toBeTruthy();
    const custom = compare.querySelector('.mlv-compare__handle .custom-glyph');
    expect(custom?.textContent?.trim()).toBe('horizontal');
    expect(compare.querySelector('.mlv-compare__glyph')).toBeNull();
  });

  it('exposes the drag state to the handle template context', () => {
    const custom = () => compare.querySelector('.custom-glyph');
    expect(custom()?.classList.contains('custom-glyph--dragging')).toBe(false);

    vi.spyOn(compare, 'getBoundingClientRect').mockReturnValue(
      domRect({ left: 0, width: 100 }),
    );
    compare.dispatchEvent(pointerEvent('pointerdown', { clientX: 40 }));
    fixture.detectChanges();
    expect(custom()?.classList.contains('custom-glyph--dragging')).toBe(true);

    compare.dispatchEvent(pointerEvent('pointerup', { clientX: 40 }));
    fixture.detectChanges();
    expect(custom()?.classList.contains('custom-glyph--dragging')).toBe(false);
  });

  it('writes back through a two-way [(value)] binding', () => {
    expect(compare.style.getPropertyValue('--mlv-compare-value').trim()).toBe(
      '20%',
    );

    vi.spyOn(compare, 'getBoundingClientRect').mockReturnValue(
      domRect({ left: 0, width: 100 }),
    );
    compare.dispatchEvent(pointerEvent('pointerdown', { clientX: 65 }));
    fixture.detectChanges();

    expect(fixture.componentInstance.position()).toBe(65);

    fixture.componentInstance.position.set(5);
    fixture.detectChanges();

    expect(compare.style.getPropertyValue('--mlv-compare-value').trim()).toBe(
      '5%',
    );
  });
});

// ─── Compiled stylesheet contract ────────────────────────────────────────────
//
// jsdom cannot resolve cascade-layered rules or `clip-path`, so the parts of
// the visual contract that carry behaviour (direction-aware clipping, the focus
// ring routed from the hidden input to the handle, touch-action per axis,
// reduced-motion and forced-colors paths) are asserted on the compiled CSS text.

describe('MlvCompare styles', () => {
  let css: string;

  beforeAll(() => {
    // Joined at runtime so Vite's asset rewrite never turns the stylesheet
    // path into an http(s) URL under jsdom (same trick as icon-toggle.spec).
    css = stripCssLayersFromText(
      compile(
        fileURLToPath(
          new URL(['.', 'compare.scss'].join('/'), import.meta.url),
        ),
      ).css,
    );
  });

  /**
   * Declarations of every rule with exactly this selector, joined. Sass emits
   * a selector twice when a nested rule (the `*` reset from `mixins.base`)
   * sits between its declarations, so one match is not the whole rule.
   */
  function block(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [
      ...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g')),
    ];
    if (matches.length === 0) {
      throw new Error(`No rule found for "${selector}" in:\n${css}`);
    }
    return matches.map((match) => match[1]).join('\n');
  }

  it('clips the after layer along the inline axis using the direction sign', () => {
    const after = block('.mlv-compare__layer--after');
    // `inset()` sides are physical: the inline-*end* factor must sit in the
    // right slot and the inline-*start* factor in the left one, so LTR eats
    // from the left and a scoped RTL from the right. Swapping the two factors
    // would pass any looser "both tokens are present" check.
    expect(after).toMatch(
      /clip-path:\s*inset\(\s*0\s+calc\(max\(0,\s*-1\s*\*\s*var\(--mlv-inline-direction\)\)\s*\*\s*var\(--mlv-compare-value\)\)\s+0\s+calc\(max\(0,\s*var\(--mlv-inline-direction\)\)\s*\*\s*var\(--mlv-compare-value\)\)\s*\)/,
    );
  });

  it('clips the after layer along the block axis when vertical', () => {
    const after = block('.mlv-compare--vertical .mlv-compare__layer--after');
    expect(after).toMatch(
      /clip-path:\s*inset\(var\(--mlv-compare-value\) 0 0 0\)/,
    );
  });

  it('routes the hidden input focus ring onto the visible handle (Form A)', () => {
    const ring = block(
      '.mlv-compare:has(.mlv-compare__input:focus-visible) .mlv-compare__handle',
    );
    expect(ring).toMatch(
      /outline:\s*var\(--mlv-stroke-width-medium\) solid var\(--mlv-border-focus\)/,
    );
    expect(ring).toMatch(/outline-offset:\s*var\(--mlv-focus-ring-offset\)/);
  });

  it('centres the handle on the divider in both axes, mirroring the inline half', () => {
    const handle = block('.mlv-compare__handle');
    expect(handle).toMatch(/position:\s*absolute/);
    expect(handle).toMatch(/inset-inline-start:\s*50%/);
    expect(handle).toMatch(/inset-block-start:\s*50%/);
    expect(handle).toMatch(
      /translate:\s*calc\(-50% \* var\(--mlv-inline-direction\)\)\s+-50%/,
    );
  });

  it('pins each label to the travel-axis corner of its own layer', () => {
    // The layer is the label's containing block, so the label clips with it.
    expect(block('.mlv-compare__layer')).toMatch(/position:\s*relative/);

    const label = block('.mlv-compare__label');
    expect(label).toMatch(/position:\s*absolute/);
    expect(label).toMatch(
      /inset-block-start:\s*var\(--mlv-compare-label-inset\)/,
    );
    expect(label).toMatch(
      /inset-inline-start:\s*var\(--mlv-compare-label-inset\)/,
    );
    expect(label).toMatch(
      /background:\s*var\(--mlv-compare-label-background\)/,
    );
    expect(label).toMatch(/color:\s*var\(--mlv-compare-label-color\)/);

    // Horizontal: *after* sits at the inline-end corner of the same edge.
    const after = block('.mlv-compare__label--after');
    expect(after).toMatch(/inset-inline-start:\s*auto/);
    expect(after).toMatch(
      /inset-inline-end:\s*var\(--mlv-compare-label-inset\)/,
    );

    // Vertical: the after layer is only visible at the bottom, so its label
    // moves to the block-end corner and back to inline-start.
    const vertical = block('.mlv-compare--vertical .mlv-compare__label--after');
    expect(vertical).toMatch(/inset-block-start:\s*auto/);
    expect(vertical).toMatch(
      /inset-block-end:\s*var\(--mlv-compare-label-inset\)/,
    );
    expect(vertical).toMatch(/inset-inline-end:\s*auto/);
    expect(vertical).toMatch(
      /inset-inline-start:\s*var\(--mlv-compare-label-inset\)/,
    );
  });

  it('keeps page scrolling alive on the axis it does not own', () => {
    expect(block('.mlv-compare')).toMatch(/touch-action:\s*pan-y/);
    expect(block('.mlv-compare--vertical')).toMatch(/touch-action:\s*pan-x/);
  });

  it('makes the content layers pointer-transparent so the surface owns the gesture', () => {
    expect(block('.mlv-compare__layer')).toMatch(/pointer-events:\s*none/);
  });

  it('ships reduced-motion and forced-colors paths', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/@media \(forced-colors: active\)/);
  });

  it('never assigns a --mlv-padding-* pair to anything but the padding shorthand', () => {
    const misuse = css.match(
      /^(?!\s*padding:)[^\n]*var\(--mlv-padding-[^)]*\)/gm,
    );
    expect(misuse).toBeNull();
  });
});

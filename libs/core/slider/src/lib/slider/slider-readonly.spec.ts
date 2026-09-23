import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvSliderValue } from './slider';
import { MlvSlider } from './slider';

/**
 * #298: the thumb keydown handlers and the track pointerdown handler checked
 * only `computedDisabled()`, so a readonly slider moved on a track click, a
 * thumb drag, the arrows, Home / End and PageUp / PageDown.
 */
@Component({
  template: `
    <mlv-slider
      label="Volume"
      [range]="range()"
      [readonly]="ro()"
      [disabled]="dis()"
      [(value)]="value"
    />
  `,
  imports: [MlvSlider],
})
class Host {
  readonly range = signal(false);
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly value = signal<MlvSliderValue>(50);
}

type Mode = 'readonly' | 'disabled';

async function create(
  mode: Mode | null,
  range = false,
): Promise<ComponentFixture<Host>> {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  const host = fixture.componentInstance;
  host.range.set(range);
  host.value.set(range ? [20, 80] : 50);
  if (mode === 'readonly') host.ro.set(true);
  if (mode === 'disabled') host.dis.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function pointerEvent(
  type: string,
  clientX: number,
  pointerId = 1,
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

function mockTrack(fixture: ComponentFixture<Host>): HTMLElement {
  const track = fixture.nativeElement.querySelector(
    '.mlv-slider__track',
  ) as HTMLElement;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 10,
    width: 100,
    height: 10,
    toJSON: () => ({}),
  } as DOMRect);
  return track;
}

function thumbs(fixture: ComponentFixture<Host>): HTMLElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-slider__thumb'),
  );
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('MlvSlider — write permission (#298)', () => {
  afterEach(() => vi.restoreAllMocks());

  describe.each(['readonly', 'disabled'] as const)('while %s', (mode) => {
    it.each([
      'ArrowRight',
      'ArrowLeft',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ])('%s on the thumb does not move the value', async (key) => {
      const fixture = await create(mode);
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      thumbs(fixture)[0].dispatchEvent(event);
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe(50);
      // A readonly thumb is focusable and has no caret, so a refused slider
      // key is still cancelled or it scrolls the page. A disabled thumb is out
      // of the tab order and handles no key at all, as before #298.
      expect(event.defaultPrevented).toBe(mode === 'readonly');
    });

    it.each(['Home', 'End'])(
      '%s on either range thumb does not move the range',
      async (key) => {
        const fixture = await create(mode, true);
        for (const thumb of thumbs(fixture)) {
          thumb.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
        await settle(fixture);

        expect(fixture.componentInstance.value()).toEqual([20, 80]);
      },
    );

    it('a track click does not jump the thumb, and starts no drag', async () => {
      const fixture = await create(mode);
      const track = mockTrack(fixture);
      track.dispatchEvent(pointerEvent('pointerdown', 90));
      await settle(fixture);
      window.dispatchEvent(pointerEvent('pointermove', 10));
      window.dispatchEvent(pointerEvent('pointerup', 10));
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe(50);
      expect(
        fixture.nativeElement.querySelector('mlv-slider').classList,
      ).not.toContain('mlv-slider--dragging');
    });

    it('a thumb drag does not move the value', async () => {
      const fixture = await create(mode);
      mockTrack(fixture);
      const thumb = thumbs(fixture)[0];
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
      thumb.dispatchEvent(pointerEvent('pointerdown', 50, 4));
      window.dispatchEvent(pointerEvent('pointermove', 90, 4));
      window.dispatchEvent(pointerEvent('pointerup', 90, 4));
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe(50);
    });
  });

  describe('readonly', () => {
    it('announces aria-readonly on every thumb, and only while readonly', async () => {
      const fixture = await create('readonly', true);
      expect(
        thumbs(fixture).map((t) => t.getAttribute('aria-readonly')),
      ).toEqual(['true', 'true']);

      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      expect(
        thumbs(fixture).map((t) => t.hasAttribute('aria-readonly')),
      ).toEqual([false, false]);
    });

    it('cancels a refused key on the high range thumb too, and leaves Tab alone', async () => {
      const fixture = await create('readonly', true);
      const high = thumbs(fixture)[1];
      const end = new KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
        cancelable: true,
      });
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      high.dispatchEvent(end);
      high.dispatchEvent(tab);
      await settle(fixture);

      expect(fixture.componentInstance.value()).toEqual([20, 80]);
      expect(end.defaultPrevented).toBe(true);
      expect(tab.defaultPrevented).toBe(false);
    });

    it('a drag that outlives permission stops moving the thumb, not only the value', async () => {
      const fixture = await create(null);
      mockTrack(fixture);
      const thumb = thumbs(fixture)[0];
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
      thumb.dispatchEvent(pointerEvent('pointerdown', 50, 4));
      window.dispatchEvent(pointerEvent('pointermove', 60, 4));
      await settle(fixture);
      expect(fixture.componentInstance.value()).toBe(60);
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('60%');

      fixture.componentInstance.ro.set(true);
      await settle(fixture);
      window.dispatchEvent(pointerEvent('pointermove', 90, 4));
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe(60);
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('60%');

      window.dispatchEvent(pointerEvent('pointerup', 90, 4));
      await settle(fixture);
      expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('60%');
    });

    it('keeps the thumbs in the tab order, so the value stays readable', async () => {
      const fixture = await create('readonly', true);
      expect(thumbs(fixture).map((t) => t.getAttribute('tabindex'))).toEqual([
        '0',
        '0',
      ]);
    });

    it('moves again once readonly is lifted', async () => {
      const fixture = await create('readonly');
      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      thumbs(fixture)[0].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'End',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe(100);
    });
  });

  it('a signal-forms readonly() rule blocks a track click', async () => {
    @Component({
      template: `<mlv-slider label="Volume" [formField]="f.volume" />`,
      imports: [MlvSlider, FormField],
    })
    class SignalHost {
      readonly model = signal({ volume: 50 as MlvSliderValue });
      readonly f = form(this.model, (path) => {
        readonly(path.volume);
      });
    }

    await TestBed.configureTestingModule({
      imports: [SignalHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHost);
    await settle(fixture);
    const track = fixture.nativeElement.querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 10,
      width: 100,
      height: 10,
      toJSON: () => ({}),
    } as DOMRect);
    track.dispatchEvent(pointerEvent('pointerdown', 90));
    window.dispatchEvent(pointerEvent('pointerup', 90));
    await settle(fixture);

    expect(fixture.componentInstance.f.volume().value()).toBe(50);
  });

  describe('axe', () => {
    it.each([
      ['default', null, false],
      ['readonly', 'readonly', false],
      ['disabled', 'disabled', false],
      ['readonly range', 'readonly', true],
    ] as const)('has no violations (%s)', async (_name, mode, range) => {
      const fixture = await create(mode, range);
      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    });
  });
});

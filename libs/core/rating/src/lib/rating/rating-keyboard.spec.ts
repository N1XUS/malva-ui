import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, ViewEncapsulation } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRating } from './rating';

// ---------------------------------------------------------------------------
// Keyboard: focus and fill follow the value (#314)
//
// The keyboard suites in `rating.spec.ts` dispatch `keydown` on the host with
// no star focused, which is not how a user reaches the handler: they Tab to
// the one star holding the roving tab stop and press a key there. On that
// path two things went wrong. Focus pinned the hover preview to the focused
// star, and `_hoverValue` outranks `value()` in `_displayValue`, so the fill
// never moved; and the arrow keys moved the tab stop without moving focus, so
// focus was left on a star that had just become `tabindex="-1"`.
//
// Every test here starts by focusing the star that holds `tabindex="0"`.
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-rating [max]="5" [formControl]="ctrl" />
    <button type="button" class="outside">Outside</button>
  `,
  imports: [MlvRating, ReactiveFormsModule],
})
class WholeHostComponent {
  readonly ctrl = new FormControl<number>(0);
}

@Component({
  template: `<mlv-rating [max]="5" [step]="0.5" [formControl]="ctrl" />`,
  imports: [MlvRating, ReactiveFormsModule],
})
class HalfHostComponent {
  readonly ctrl = new FormControl<number>(0);
}

@Component({
  template: `<div dir="rtl">
    <mlv-rating [max]="5" [step]="0.5" [formControl]="ctrl" />
  </div>`,
  imports: [MlvRating, ReactiveFormsModule],
})
class ScopedRtlHostComponent {
  readonly ctrl = new FormControl<number>(0);
}

@Component({
  template: `
    <mlv-rating [max]="5" [value]="2" [readonly]="true" />
    <button type="button" class="outside">Outside</button>
  `,
  imports: [MlvRating],
})
class ReadonlyHostComponent {}

@Component({
  template: `
    <mlv-rating [max]="5" [value]="2" [disabled]="true" />
    <button type="button" class="outside">Outside</button>
  `,
  imports: [MlvRating],
})
class DisabledHostComponent {}

/**
 * The rating rendered inside a shadow root. There `document.activeElement` is
 * the shadow host, never the focused star, so "is focus inside the rating?"
 * has to be asked of the rating's own root node.
 */
@Component({
  selector: 'rating-shadow-host',
  template: `<mlv-rating [max]="5" [formControl]="ctrl" />`,
  imports: [MlvRating, ReactiveFormsModule],
  encapsulation: ViewEncapsulation.ShadowDom,
})
class ShadowHostComponent {
  readonly ctrl = new FormControl<number>(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createFixture<T>(
  hostClass: Type<T>,
  value?: number,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  if (value !== undefined) {
    (
      fixture.componentInstance as { ctrl: FormControl<number | null> }
    ).ctrl.setValue(value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function ratingHost(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-rating') as HTMLElement;
}

function getStars(fixture: ComponentFixture<unknown>): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-rating__star'),
  );
}

/** The `clip-path` of every star's filled layer, in star order. */
function clipPaths(fixture: ComponentFixture<unknown>): string[] {
  return getStars(fixture).map(
    (star) =>
      (star.querySelector('.mlv-rating__icon--filled') as SVGElement).style
        .clipPath,
  );
}

function pressed(fixture: ComponentFixture<unknown>): (string | null)[] {
  return getStars(fixture).map((star) => star.getAttribute('aria-pressed'));
}

/**
 * One-based position of the focused star, `0` when focus is on none of this
 * fixture's stars. A number rather than an element so a failing assertion
 * prints something short.
 */
function focusedStar(fixture: ComponentFixture<unknown>): number {
  return getStars(fixture).indexOf(document.activeElement as never) + 1;
}

/** One-based positions of every star holding `tabindex="0"`. */
function tabStops(fixture: ComponentFixture<unknown>): number[] {
  return getStars(fixture)
    .map((star, i) => (star.getAttribute('tabindex') === '0' ? i + 1 : 0))
    .filter((position) => position > 0);
}

/** Tabs into the rating the way a user does: onto the star holding the stop. */
async function focusTabStop(fixture: ComponentFixture<unknown>): Promise<void> {
  const stops = getStars(fixture).filter(
    (star) => star.getAttribute('tabindex') === '0',
  );
  expect(stops.length).toBe(1);
  stops[0].focus();
  fixture.detectChanges();
  await fixture.whenStable();
}

/** Presses `key` on whatever element holds focus, as the browser does. */
async function press(
  fixture: ComponentFixture<unknown>,
  key: string,
): Promise<void> {
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  fixture.detectChanges();
  await fixture.whenStable();
}

const FULL = 'inset(0 0% 0 0)';
const HALF = 'inset(0 50% 0 0)';
const EMPTY = 'inset(0 100% 0 0)';
const RTL_FULL = 'inset(0 0 0 0%)';
const RTL_HALF = 'inset(0 0 0 50%)';
const RTL_EMPTY = 'inset(0 0 0 100%)';

/**
 * jsdom's own `offsetX` descriptor, captured before any test stubs it, so the
 * Enter / Space suite can restore the getter rather than delete it.
 */
const NATIVE_OFFSET_X = Object.getOwnPropertyDescriptor(
  MouseEvent.prototype,
  'offsetX',
);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvRating keyboard: focus and fill follow the value (#314)', () => {
  describe('whole stars', () => {
    it('ArrowRight ×2 from 2 fills four stars and focuses the fourth, which holds the tab stop', async () => {
      const fixture = await createFixture(WholeHostComponent, 2);
      await focusTabStop(fixture);
      expect(focusedStar(fixture)).toBe(2);

      await press(fixture, 'ArrowRight');
      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedStar(fixture)).toBe(3);
      expect(tabStops(fixture)).toEqual([3]);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, EMPTY, EMPTY]);

      await press(fixture, 'ArrowRight');
      expect(fixture.componentInstance.ctrl.value).toBe(4);
      expect(focusedStar(fixture)).toBe(4);
      expect(tabStops(fixture)).toEqual([4]);
      expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, FULL, EMPTY]);
      expect(pressed(fixture)).toEqual([
        'true',
        'true',
        'true',
        'true',
        'false',
      ]);
    });

    it.each([
      ['ArrowUp', 4, [FULL, FULL, FULL, FULL, EMPTY]],
      ['ArrowRight', 4, [FULL, FULL, FULL, FULL, EMPTY]],
      ['ArrowDown', 2, [FULL, FULL, EMPTY, EMPTY, EMPTY]],
      ['ArrowLeft', 2, [FULL, FULL, EMPTY, EMPTY, EMPTY]],
      ['End', 5, [FULL, FULL, FULL, FULL, FULL]],
    ] as const)(
      '%s from 3 moves focus and fill to %i',
      async (key, expected, fill) => {
        const fixture = await createFixture(WholeHostComponent, 3);
        await focusTabStop(fixture);

        await press(fixture, key);

        expect(fixture.componentInstance.ctrl.value).toBe(expected);
        expect(focusedStar(fixture)).toBe(expected);
        expect(tabStops(fixture)).toEqual([expected]);
        expect(clipPaths(fixture)).toEqual(fill);
      },
    );

    it('Home clears the rating, empties every star and leaves focus and the stop on the first', async () => {
      const fixture = await createFixture(WholeHostComponent, 3);
      await focusTabStop(fixture);

      await press(fixture, 'Home');

      expect(fixture.componentInstance.ctrl.value).toBe(0);
      expect(focusedStar(fixture)).toBe(1);
      expect(tabStops(fixture)).toEqual([1]);
      expect(clipPaths(fixture)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
      expect(pressed(fixture)).toEqual([
        'false',
        'false',
        'false',
        'false',
        'false',
      ]);
    });

    it('focusing an unrated control does not paint a star it does not hold', async () => {
      const fixture = await createFixture(WholeHostComponent);
      await focusTabStop(fixture);

      expect(focusedStar(fixture)).toBe(1);
      expect(clipPaths(fixture)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
    });

    it('ArrowLeft from 1 reaches 0 and keeps focus on the first star', async () => {
      const fixture = await createFixture(WholeHostComponent, 1);
      await focusTabStop(fixture);

      await press(fixture, 'ArrowLeft');

      expect(fixture.componentInstance.ctrl.value).toBe(0);
      expect(focusedStar(fixture)).toBe(1);
      expect(clipPaths(fixture)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
    });

    it('moves focus from the host itself onto the star holding the stop', async () => {
      // The host is `tabindex="-1"`, so a click between two stars focuses it.
      const fixture = await createFixture(WholeHostComponent, 2);
      ratingHost(fixture).focus();
      expect(document.activeElement).toBe(ratingHost(fixture));

      await press(fixture, 'ArrowRight');

      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedStar(fixture)).toBe(3);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, EMPTY, EMPTY]);
    });

    it('does not pull focus in from outside the rating on a keydown it did not originate', async () => {
      const fixture = await createFixture(WholeHostComponent, 2);
      const outside = fixture.nativeElement.querySelector(
        '.outside',
      ) as HTMLButtonElement;
      outside.focus();

      ratingHost(fixture).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(document.activeElement).toBe(outside);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, EMPTY, EMPTY]);
    });
  });

  describe('half stars', () => {
    it('steps by 0.5, painting the half star and focusing the star it sits in', async () => {
      const fixture = await createFixture(HalfHostComponent, 2);
      await focusTabStop(fixture);
      expect(focusedStar(fixture)).toBe(2);

      await press(fixture, 'ArrowRight');
      expect(fixture.componentInstance.ctrl.value).toBe(2.5);
      expect(focusedStar(fixture)).toBe(3);
      expect(tabStops(fixture)).toEqual([3]);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, HALF, EMPTY, EMPTY]);
      // `aria-pressed` answers "is the value at least this star": 2.5 is not 3.
      expect(pressed(fixture)).toEqual([
        'true',
        'true',
        'false',
        'false',
        'false',
      ]);

      await press(fixture, 'ArrowRight');
      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedStar(fixture)).toBe(3);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, EMPTY, EMPTY]);
      expect(pressed(fixture)[2]).toBe('true');

      await press(fixture, 'ArrowLeft');
      await press(fixture, 'ArrowLeft');
      expect(fixture.componentInstance.ctrl.value).toBe(2);
      expect(focusedStar(fixture)).toBe(2);
      expect(tabStops(fixture)).toEqual([2]);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, EMPTY, EMPTY, EMPTY]);
    });

    it('focusing a half-rated control keeps the half star half filled', async () => {
      const fixture = await createFixture(HalfHostComponent, 2.5);
      await focusTabStop(fixture);

      expect(focusedStar(fixture)).toBe(3);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, HALF, EMPTY, EMPTY]);
    });

    it('ArrowLeft from 0.5 reaches 0 on the first star', async () => {
      const fixture = await createFixture(HalfHostComponent, 0.5);
      await focusTabStop(fixture);
      expect(clipPaths(fixture)).toEqual([HALF, EMPTY, EMPTY, EMPTY, EMPTY]);

      await press(fixture, 'ArrowLeft');

      expect(fixture.componentInstance.ctrl.value).toBe(0);
      expect(focusedStar(fixture)).toBe(1);
      expect(clipPaths(fixture)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
    });
  });

  describe('direction', () => {
    let rtlService: MlvRtlService | null = null;

    afterEach(() => {
      rtlService?.setDirection('ltr');
      rtlService = null;
      document.documentElement.removeAttribute('dir');
    });

    it('mirrors the horizontal arrows under a global RTL flip, focus and fill included', async () => {
      const fixture = await createFixture(HalfHostComponent, 3);
      rtlService = TestBed.inject(MlvRtlService);
      rtlService.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      await focusTabStop(fixture);

      // ArrowLeft is "next" in RTL.
      await press(fixture, 'ArrowLeft');
      expect(fixture.componentInstance.ctrl.value).toBe(3.5);
      expect(focusedStar(fixture)).toBe(4);
      expect(clipPaths(fixture)).toEqual([
        RTL_FULL,
        RTL_FULL,
        RTL_FULL,
        RTL_HALF,
        RTL_EMPTY,
      ]);

      await press(fixture, 'ArrowRight');
      await press(fixture, 'ArrowRight');
      expect(fixture.componentInstance.ctrl.value).toBe(2.5);
      expect(focusedStar(fixture)).toBe(3);
      expect(clipPaths(fixture)).toEqual([
        RTL_FULL,
        RTL_FULL,
        RTL_HALF,
        RTL_EMPTY,
        RTL_EMPTY,
      ]);

      // The vertical pair never mirrors.
      await press(fixture, 'ArrowUp');
      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedStar(fixture)).toBe(3);
      await press(fixture, 'ArrowDown');
      await press(fixture, 'ArrowDown');
      expect(fixture.componentInstance.ctrl.value).toBe(2);
      expect(focusedStar(fixture)).toBe(2);
    });

    it('mirrors under a scoped [dir="rtl"] while the document stays LTR', async () => {
      const fixture = await createFixture(ScopedRtlHostComponent, 3);
      expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      await focusTabStop(fixture);

      await press(fixture, 'ArrowLeft');
      expect(fixture.componentInstance.ctrl.value).toBe(3.5);
      expect(focusedStar(fixture)).toBe(4);
      expect(tabStops(fixture)).toEqual([4]);
      expect(clipPaths(fixture)).toEqual([
        RTL_FULL,
        RTL_FULL,
        RTL_FULL,
        RTL_HALF,
        RTL_EMPTY,
      ]);

      await press(fixture, 'End');
      expect(focusedStar(fixture)).toBe(5);
      await press(fixture, 'Home');
      expect(fixture.componentInstance.ctrl.value).toBe(0);
      expect(focusedStar(fixture)).toBe(1);
      expect(clipPaths(fixture)).toEqual([
        RTL_EMPTY,
        RTL_EMPTY,
        RTL_EMPTY,
        RTL_EMPTY,
        RTL_EMPTY,
      ]);
    });
  });

  describe('readonly and disabled', () => {
    it.each([
      ['readonly', ReadonlyHostComponent],
      ['disabled', DisabledHostComponent],
    ] as const)(
      'ignores every key and moves no focus when %s',
      async (_state, hostClass) => {
        const fixture = await createFixture<unknown>(hostClass);
        const outside = fixture.nativeElement.querySelector(
          '.outside',
        ) as HTMLButtonElement;
        outside.focus();
        const before = clipPaths(fixture);
        expect(before).toEqual([FULL, FULL, EMPTY, EMPTY, EMPTY]);

        for (const key of ['ArrowRight', 'ArrowUp', 'End', 'Home']) {
          ratingHost(fixture).dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              bubbles: true,
              cancelable: true,
            }),
          );
          fixture.detectChanges();
          await fixture.whenStable();
        }

        expect(document.activeElement).toBe(outside);
        expect(clipPaths(fixture)).toEqual(before);
        // Nothing to Tab to either: the host drops out of the focus order and
        // every star is natively disabled, which a browser never focuses
        // (jsdom does, so this asserts the attribute rather than calling
        // `focus()` on it).
        expect(ratingHost(fixture).hasAttribute('tabindex')).toBe(false);
        expect(getStars(fixture).map((star) => star.disabled)).toEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );
  });

  describe('hover preview', () => {
    it('shows the keyboard value over a resting pointer, previews the next move and restores on leave', async () => {
      const fixture = await createFixture(WholeHostComponent, 2);
      await focusTabStop(fixture);
      const stars = getStars(fixture);

      // A pointer resting over star 5 previews it.
      stars[4].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      fixture.detectChanges();
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, FULL, FULL]);

      // The keyboard is the newer input, so its value is what is shown.
      await press(fixture, 'ArrowLeft');
      expect(fixture.componentInstance.ctrl.value).toBe(1);
      expect(clipPaths(fixture)).toEqual([FULL, EMPTY, EMPTY, EMPTY, EMPTY]);

      // A later pointer move still previews…
      stars[3].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      fixture.detectChanges();
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, FULL, EMPTY]);

      // …and leaving restores the committed keyboard value.
      ratingHost(fixture).dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: false }),
      );
      fixture.detectChanges();
      expect(clipPaths(fixture)).toEqual([FULL, EMPTY, EMPTY, EMPTY, EMPTY]);
      expect(fixture.componentInstance.ctrl.value).toBe(1);
    });
  });

  describe('hover preview when focus does not move', () => {
    it('clears a resting preview on a keyboard change that stays on the focused star', async () => {
      // 2.5 → 3 stays inside star 3, so no star blurs: the preview has to be
      // dropped by the key handler itself, not by a focus move.
      const fixture = await createFixture(HalfHostComponent, 2.5);
      await focusTabStop(fixture);
      const stars = getStars(fixture);

      stars[4].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      fixture.detectChanges();
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, FULL, FULL]);

      await press(fixture, 'ArrowRight');

      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedStar(fixture)).toBe(3);
      expect(clipPaths(fixture)).toEqual([FULL, FULL, FULL, EMPTY, EMPTY]);
    });
  });

  describe('Enter / Space on the focused star', () => {
    // jsdom defines `offsetX` as a native getter on `MouseEvent.prototype`, and
    // Vitest shares one jsdom window across the files a worker runs. Deleting
    // the stub would delete jsdom's getter with it for every later file, so
    // the original descriptor is put back instead (as in `rating.spec.ts`).
    afterEach(() => {
      if (NATIVE_OFFSET_X) {
        Object.defineProperty(MouseEvent.prototype, 'offsetX', NATIVE_OFFSET_X);
      } else {
        delete (MouseEvent.prototype as unknown as Record<string, unknown>)[
          'offsetX'
        ];
      }
    });

    /**
     * What Chrome dispatches for Enter or Space on a focused `<button>`,
     * measured on the docs page: a `click` with `detail === 0`, `clientX` 0
     * and `offsetX` 0 on a 32px star. jsdom reports both widths as 0, which
     * would hide the defect, so they are pinned to the measured values.
     */
    async function activateFocusedStar(
      fixture: ComponentFixture<unknown>,
    ): Promise<void> {
      const star = document.activeElement as HTMLButtonElement;
      Object.defineProperty(star, 'offsetWidth', {
        configurable: true,
        value: 32,
      });
      Object.defineProperty(MouseEvent.prototype, 'offsetX', {
        configurable: true,
        get: () => 0,
      });
      star.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it.each([
      ['LTR', HalfHostComponent],
      ['scoped RTL', ScopedRtlHostComponent],
    ] as const)(
      'commits the whole star its label names, not a half read from a pointer that is not there (%s)',
      async (_direction, hostClass) => {
        const fixture = await createFixture<unknown>(hostClass, 3);
        await focusTabStop(fixture);
        expect(focusedStar(fixture)).toBe(3);

        // "Rate 3 out of 5" on a rating of 3 keeps it at 3…
        await activateFocusedStar(fixture);
        expect(
          (fixture.componentInstance as HalfHostComponent).ctrl.value,
        ).toBe(3);

        // …and after ArrowDown to 2.5, still on star 3, it commits 3.
        await press(fixture, 'ArrowDown');
        expect(
          (fixture.componentInstance as HalfHostComponent).ctrl.value,
        ).toBe(2.5);
        expect(focusedStar(fixture)).toBe(3);
        await activateFocusedStar(fixture);
        expect(
          (fixture.componentInstance as HalfHostComponent).ctrl.value,
        ).toBe(3);
      },
    );
  });

  describe('inside a shadow root', () => {
    it('moves focus onto the new stop when the rating lives in a shadow root', async () => {
      const fixture = await createFixture(ShadowHostComponent, 2);
      const root = (fixture.nativeElement as HTMLElement).shadowRoot;
      expect(root).not.toBeNull();
      const stars = Array.from(
        (root as ShadowRoot).querySelectorAll<HTMLButtonElement>(
          '.mlv-rating__star',
        ),
      );
      /** One-based position of the star focused inside the shadow root. */
      const focusedInShadow = (): number =>
        stars.indexOf((root as ShadowRoot).activeElement as never) + 1;

      stars[1].focus();
      expect(focusedInShadow()).toBe(2);
      // The document only sees the shadow host, which is outside the rating.
      expect(document.activeElement === fixture.nativeElement).toBe(true);

      stars[1].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.ctrl.value).toBe(3);
      expect(focusedInShadow()).toBe(3);
      expect(stars.map((star) => star.getAttribute('tabindex'))).toEqual([
        '-1',
        '-1',
        '0',
        '-1',
        '-1',
      ]);
    });
  });

  describe('forms', () => {
    it('marks the control dirty on a keyboard change and touched only when focus leaves the rating', async () => {
      const fixture = await createFixture(WholeHostComponent, 2);
      const { ctrl } = fixture.componentInstance;
      await focusTabStop(fixture);
      expect(ctrl.dirty).toBe(false);

      // Two stars crossed: focus moves between stars, which is not the user
      // leaving the control.
      await press(fixture, 'ArrowRight');
      await press(fixture, 'ArrowRight');
      expect(ctrl.value).toBe(4);
      expect(ctrl.dirty).toBe(true);
      expect(ctrl.touched).toBe(false);

      (fixture.nativeElement.querySelector('.outside') as HTMLElement).focus();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(ctrl.touched).toBe(true);
    });
  });
});

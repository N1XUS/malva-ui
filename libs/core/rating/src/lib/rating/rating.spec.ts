import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRating } from './rating';

/**
 * `offsetX` is stubbed on `MouseEvent.prototype` by the half-star tests — jsdom
 * reports 0 for it. Captured once here and restored after every test so a stub
 * cannot leak into a later suite in this file.
 */
const NATIVE_OFFSET_X = Object.getOwnPropertyDescriptor(
  MouseEvent.prototype,
  'offsetX',
);

afterEach(() => {
  if (NATIVE_OFFSET_X) {
    Object.defineProperty(MouseEvent.prototype, 'offsetX', NATIVE_OFFSET_X);
  } else {
    delete (MouseEvent.prototype as unknown as Record<string, unknown>)[
      'offsetX'
    ];
  }
});

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

@Component({
  template: `<mlv-rating [max]="5" />`,
  imports: [MlvRating],
})
class BasicHostComponent {}

@Component({
  template: `<mlv-rating [max]="5" [readonly]="true" />`,
  imports: [MlvRating],
})
class ReadonlyHostComponent {}

@Component({
  template: `<mlv-rating [max]="5" [disabled]="true" />`,
  imports: [MlvRating],
})
class DisabledHostComponent {}

@Component({
  template: `<mlv-rating [max]="5" [formControl]="ctrl" />`,
  imports: [MlvRating, ReactiveFormsModule],
})
class ReactiveHostComponent {
  ctrl = new FormControl<number>(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStars(fixture: ComponentFixture<unknown>): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-rating__star'),
  );
}

function filledIcon(star: HTMLButtonElement): SVGElement {
  return star.querySelector('.mlv-rating__icon--filled') as SVGElement;
}

async function createFixture<T>(
  hostClass: Type<T>,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvRating', () => {
  describe('rendering', () => {
    let fixture: ComponentFixture<BasicHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
    });

    it('renders the correct number of star buttons', () => {
      expect(getStars(fixture).length).toBe(5);
    });

    it('has role="group" on the host', () => {
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.getAttribute('role')).toBe('group');
    });

    it('gives each star an aria-label', () => {
      const stars = getStars(fixture);
      expect(stars[0].getAttribute('aria-label')).toBe('Rate 1 out of 5');
      expect(stars[4].getAttribute('aria-label')).toBe('Rate 5 out of 5');
    });

    it('starts with all stars unfilled (clip-path 100%)', () => {
      getStars(fixture).forEach((star) => {
        const icon = filledIcon(star);
        expect(icon.style.clipPath).toBe('inset(0 100% 0 0)');
      });
    });

    it('exposes exactly one star in the tab order (roving tabindex)', () => {
      const stars = getStars(fixture);
      const tabbable = stars.filter((s) => s.getAttribute('tabindex') === '0');
      expect(tabbable.length).toBe(1);
      // With no value, the first star is the tab stop.
      expect(stars[0].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('roving tabindex', () => {
    it('moves the single tab stop to the star covering the value', async () => {
      const fixture = await createFixture(ReactiveHostComponent);
      fixture.componentInstance.ctrl.setValue(3);
      fixture.detectChanges();
      await fixture.whenStable();
      const stars = getStars(fixture);
      const tabbable = stars.filter((s) => s.getAttribute('tabindex') === '0');
      expect(tabbable.length).toBe(1);
      expect(stars[2].getAttribute('tabindex')).toBe('0');
    });

    it('keeps all stars out of the tab order when read-only', async () => {
      const fixture = await createFixture(ReadonlyHostComponent);
      const stars = getStars(fixture);
      stars.forEach((s) => expect(s.getAttribute('tabindex')).toBe('-1'));
    });
  });

  describe('click interaction', () => {
    let fixture: ComponentFixture<BasicHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
    });

    it('fills stars up to and including clicked star', () => {
      const stars = getStars(fixture);
      // `step` is 1 here, so `_onStarClick` short-circuits before
      // `_isLeadingHalf` and the click resolves to the whole star regardless
      // of where inside the button it landed — no geometry stub needed.
      stars[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      // Stars 1-3 should be fully filled (clip-path: inset(0 0% 0 0))
      expect(filledIcon(stars[0]).style.clipPath).toBe('inset(0 0% 0 0)');
      expect(filledIcon(stars[1]).style.clipPath).toBe('inset(0 0% 0 0)');
      expect(filledIcon(stars[2]).style.clipPath).toBe('inset(0 0% 0 0)');
      // Star 4 should be empty
      expect(filledIcon(stars[3]).style.clipPath).toBe('inset(0 100% 0 0)');
    });
  });

  describe('half-star precision', () => {
    it('shows 50% fill (half-star) for fractional value 2.5', async () => {
      @Component({
        template: `<mlv-rating [max]="5" [step]="0.5" [formControl]="ctrl" />`,
        imports: [MlvRating, ReactiveFormsModule],
      })
      class HalfReactiveHost {
        ctrl = new FormControl<number>(0);
      }
      await TestBed.configureTestingModule({
        imports: [HalfReactiveHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      const f = TestBed.createComponent(HalfReactiveHost);
      f.detectChanges();
      f.componentInstance.ctrl.setValue(2.5);
      f.detectChanges();
      await f.whenStable();
      const stars = getStars(f);
      // Stars 1 and 2 fully filled
      expect(filledIcon(stars[0]).style.clipPath).toBe('inset(0 0% 0 0)');
      expect(filledIcon(stars[1]).style.clipPath).toBe('inset(0 0% 0 0)');
      // Star 3 half filled (50% clipped from right)
      expect(filledIcon(stars[2]).style.clipPath).toBe('inset(0 50% 0 0)');
      // Stars 4 and 5 empty
      expect(filledIcon(stars[3]).style.clipPath).toBe('inset(0 100% 0 0)');
    });
  });

  describe('read-only mode', () => {
    let fixture: ComponentFixture<ReadonlyHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(ReadonlyHostComponent);
    });

    it('adds readonly class to host', () => {
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.classList.contains('mlv-rating--readonly')).toBe(true);
    });

    it('disables all star buttons', () => {
      getStars(fixture).forEach((star) => {
        expect(star.disabled).toBe(true);
      });
    });
  });

  describe('disabled state', () => {
    let fixture: ComponentFixture<DisabledHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(DisabledHostComponent);
    });

    it('adds disabled class to host', () => {
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.classList.contains('mlv-rating--disabled')).toBe(true);
    });

    it('disables all star buttons', () => {
      getStars(fixture).forEach((star) => {
        expect(star.disabled).toBe(true);
      });
    });
  });

  describe('keyboard navigation', () => {
    let fixture: ComponentFixture<ReactiveHostComponent>;
    let host: ReactiveHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(ReactiveHostComponent);
      host = fixture.componentInstance;
      host.ctrl.setValue(3);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    function keydown(key: string): void {
      const el = fixture.nativeElement.querySelector('mlv-rating');
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
    }

    it('ArrowRight increments by step', () => {
      keydown('ArrowRight');
      expect(host.ctrl.value).toBe(4);
    });

    it('ArrowLeft decrements by step', () => {
      keydown('ArrowLeft');
      expect(host.ctrl.value).toBe(2);
    });

    it('End sets value to max', () => {
      keydown('End');
      expect(host.ctrl.value).toBe(5);
    });

    it('Home sets value to 0', () => {
      keydown('Home');
      expect(host.ctrl.value).toBe(0);
    });

    it('ArrowRight does not exceed max', () => {
      host.ctrl.setValue(5);
      fixture.detectChanges();
      keydown('ArrowRight');
      expect(host.ctrl.value).toBe(5);
    });

    it('ArrowLeft does not go below 0', () => {
      host.ctrl.setValue(0);
      fixture.detectChanges();
      keydown('ArrowLeft');
      expect(host.ctrl.value).toBe(0);
    });
  });

  describe('validation state', () => {
    it('reflects the inherited state input as a host modifier class', async () => {
      @Component({
        template: `<mlv-rating [max]="5" state="error" />`,
        imports: [MlvRating],
      })
      class StateHost {}
      const fixture = await createFixture(StateHost);
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.classList.contains('mlv-rating--state-error')).toBe(true);
    });

    it('defaults to the default state class', async () => {
      const fixture = await createFixture(BasicHostComponent);
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.classList.contains('mlv-rating--state-default')).toBe(true);
    });
  });

  describe('CVA integration', () => {
    let fixture: ComponentFixture<ReactiveHostComponent>;
    let host: ReactiveHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(ReactiveHostComponent);
      host = fixture.componentInstance;
    });

    it('writeValue renders the correct fill state', async () => {
      host.ctrl.setValue(3);
      fixture.detectChanges();
      await fixture.whenStable();
      const stars = getStars(fixture);
      expect(filledIcon(stars[0]).style.clipPath).toBe('inset(0 0% 0 0)');
      expect(filledIcon(stars[2]).style.clipPath).toBe('inset(0 0% 0 0)');
      expect(filledIcon(stars[3]).style.clipPath).toBe('inset(0 100% 0 0)');
    });

    it('writeValue null resets to 0', async () => {
      host.ctrl.setValue(4);
      fixture.detectChanges();
      await fixture.whenStable();
      host.ctrl.setValue(null);
      fixture.detectChanges();
      await fixture.whenStable();
      getStars(fixture).forEach((star) => {
        expect(filledIcon(star).style.clipPath).toBe('inset(0 100% 0 0)');
      });
    });

    it('disables stars when control is disabled', async () => {
      host.ctrl.disable();
      fixture.detectChanges();
      await fixture.whenStable();
      // Disabled via host class (mlv-rating--disabled)
      const el = fixture.nativeElement.querySelector('mlv-rating');
      expect(el.classList.contains('mlv-rating--disabled')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Hover preview
//
// The `mousemove` listener is bound with `fromEvent` rather than a template
// `(mousemove)` binding, so it needs its own coverage: nothing in the template
// tells the reader the handler is still wired.
// ---------------------------------------------------------------------------

describe('MlvRating hover preview', () => {
  /** Pins `offsetX` and the star's rendered width — both are 0 under jsdom. */
  function stubHalfGeometry(star: HTMLButtonElement, offsetX: number): void {
    Object.defineProperty(MouseEvent.prototype, 'offsetX', {
      configurable: true,
      get: () => offsetX,
    });
    Object.defineProperty(star, 'offsetWidth', {
      configurable: true,
      value: 32,
    });
  }

  it('previews the hovered star without committing a value', async () => {
    const fixture = await createFixture(BasicHostComponent);
    const stars = getStars(fixture);

    stars[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();

    expect(filledIcon(stars[0]).style.clipPath).toBe('inset(0 0% 0 0)');
    expect(filledIcon(stars[1]).style.clipPath).toBe('inset(0 0% 0 0)');
    expect(filledIcon(stars[2]).style.clipPath).toBe('inset(0 0% 0 0)');
    expect(filledIcon(stars[3]).style.clipPath).toBe('inset(0 100% 0 0)');
    // The preview must not write through to the model.
    stars.forEach((star) =>
      expect(star.getAttribute('aria-pressed')).toBe('false'),
    );
  });

  it('previews a half star on the leading half when step is 0.5', async () => {
    @Component({
      template: `<mlv-rating [max]="5" [step]="0.5" />`,
      imports: [MlvRating],
    })
    class HalfHost {}

    const fixture = await createFixture(HalfHost);
    const stars = getStars(fixture);
    stubHalfGeometry(stars[2], 10);

    stars[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();

    expect(filledIcon(stars[1]).style.clipPath).toBe('inset(0 0% 0 0)');
    expect(filledIcon(stars[2]).style.clipPath).toBe('inset(0 50% 0 0)');
    expect(filledIcon(stars[3]).style.clipPath).toBe('inset(0 100% 0 0)');
  });

  it('clears the preview when the pointer leaves the host', async () => {
    const fixture = await createFixture(BasicHostComponent);
    const stars = getStars(fixture);
    const host = fixture.nativeElement.querySelector(
      'mlv-rating',
    ) as HTMLElement;

    stars[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();
    expect(filledIcon(stars[0]).style.clipPath).toBe('inset(0 0% 0 0)');

    host.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    fixture.detectChanges();

    getStars(fixture).forEach((star) =>
      expect(filledIcon(star).style.clipPath).toBe('inset(0 100% 0 0)'),
    );
  });

  it('ignores the pointer in read-only mode', async () => {
    const fixture = await createFixture(ReadonlyHostComponent);
    const stars = getStars(fixture);

    stars[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();

    getStars(fixture).forEach((star) =>
      expect(filledIcon(star).style.clipPath).toBe('inset(0 100% 0 0)'),
    );
  });

  it('ignores a pointer move that lands between stars', async () => {
    const fixture = await createFixture(BasicHostComponent);
    const host = fixture.nativeElement.querySelector(
      'mlv-rating',
    ) as HTMLElement;

    host.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    fixture.detectChanges();

    getStars(fixture).forEach((star) =>
      expect(filledIcon(star).style.clipPath).toBe('inset(0 100% 0 0)'),
    );
  });
});

// ---------------------------------------------------------------------------
// Pointer-listener delegation
//
// `mousemove` is the only listener here that fires continuously while the
// pointer is over the component, and it is deliberately bound once on the host
// with `fromEvent` instead of per-star in the template — issue #16, landed in
// PR #113.
// Both forms produce identical hover behaviour, so every behavioural test in
// this file passes either way — this suite is what actually pins the shape.
// ---------------------------------------------------------------------------

describe('MlvRating pointer-listener delegation', () => {
  /**
   * Tallies every `addEventListener` call made on an element while `host` is
   * created, keyed `"<type>@<tagName>"`.
   */
  async function tallyListeners(
    hostClass: Type<unknown>,
  ): Promise<Record<string, number>> {
    const original = EventTarget.prototype.addEventListener;
    const seen: string[] = [];

    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      ...rest: unknown[]
    ) {
      if (this instanceof Element) {
        seen.push(`${type}@${this.tagName.toLowerCase()}`);
      }
      return (original as unknown as (...args: unknown[]) => void).apply(this, [
        type,
        ...rest,
      ]);
    } as typeof EventTarget.prototype.addEventListener;

    try {
      await createFixture(hostClass);
    } finally {
      EventTarget.prototype.addEventListener = original;
    }

    const tally: Record<string, number> = {};
    for (const entry of seen) tally[entry] = (tally[entry] ?? 0) + 1;
    return tally;
  }

  it('binds mousemove once on the host and never on a star', async () => {
    const tally = await tallyListeners(BasicHostComponent);

    expect(tally['mousemove@mlv-rating'] ?? 0).toBe(1);
    expect(tally['mousemove@button'] ?? 0).toBe(0);
  });

  it('keeps a single mousemove listener as max grows', async () => {
    @Component({
      template: `<mlv-rating [max]="20" />`,
      imports: [MlvRating],
    })
    class WideHost {}

    const tally = await tallyListeners(WideHost);

    // One delegated listener regardless of star count — the per-star form
    // scaled with `max`.
    expect(tally['mousemove@mlv-rating'] ?? 0).toBe(1);
    expect(tally['mousemove@button'] ?? 0).toBe(0);
    // Sanity: the stars really were rendered, so the counts above are not
    // zero simply because nothing was created.
    expect(tally['click@button'] ?? 0).toBe(20);
  });

  it('performs no layout read on the whole-star path', async () => {
    const reads = { whole: 0, half: 0 };

    async function countGeometryReads(
      hostClass: Type<unknown>,
      bucket: 'whole' | 'half',
    ): Promise<void> {
      const fixture = await createFixture(hostClass);
      const stars = getStars(fixture);
      stars.forEach((star) =>
        Object.defineProperty(star, 'offsetWidth', {
          configurable: true,
          get: () => {
            reads[bucket]++;
            return 32;
          },
        }),
      );
      for (let i = 0; i < 50; i++) {
        stars[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      }
    }

    @Component({
      template: `<mlv-rating [max]="5" [step]="0.5" />`,
      imports: [MlvRating],
    })
    class HalfStepHost {}

    await countGeometryReads(BasicHostComponent, 'whole');
    TestBed.resetTestingModule();
    await countGeometryReads(HalfStepHost, 'half');

    // Whole-star ratings short-circuit before `_isLeadingHalf`, so a hover
    // sweep performs no layout read at all. This half is the contract.
    expect(reads.whole).toBe(0);
    // Half-star precision does need the star's width to place the midpoint.
    // Deliberately not an exact count: how often it is read is an
    // implementation detail, and caching it per hover-enter would be a valid
    // change this test must not block.
    expect(reads.half).toBeGreaterThan(0);
  });
});

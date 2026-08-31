import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRating } from './rating';

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
      // Click star 3 — simulate center of button (right half → full star)
      Object.defineProperty(MouseEvent.prototype, 'offsetX', {
        configurable: true,
        get: () => 16,
      });
      Object.defineProperty(MouseEvent.prototype, 'offsetWidth', {
        configurable: true,
        get: () => 32,
      });
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

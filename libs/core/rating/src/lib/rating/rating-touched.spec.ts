import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRating } from './rating';

@Component({
  template: `
    <mlv-rating [max]="5" [formControl]="ctrl" />
    <button type="button" class="outside">Outside</button>
  `,
  imports: [MlvRating, ReactiveFormsModule],
})
class ReviewHost {
  readonly ctrl = new FormControl(0, { nonNullable: true });
}

/**
 * #347 (owner decision D22): the rating reports touched when focus leaves the
 * rating — the stars and the `tabindex="-1"` host a click between two stars
 * focuses are one control. #314 covered the arrow-key move with a flag; the
 * pointer moves and the host were still wrong. Every assertion reads a
 * primitive, so a failure never pretty-prints a component.
 */
describe('MlvRating — touched timing (#347)', () => {
  let fixture: ComponentFixture<ReviewHost>;
  let ctrl: FormControl<number>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ReviewHost);
    ctrl = fixture.componentInstance.ctrl;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function stars(): HTMLButtonElement[] {
    return Array.from(
      root().querySelectorAll<HTMLButtonElement>('.mlv-rating__star'),
    );
  }

  function ratingHost(): HTMLElement {
    return root().querySelector('mlv-rating') as HTMLElement;
  }

  function outside(): HTMLButtonElement {
    return root().querySelector('.outside') as HTMLButtonElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('does not touch when a pointer moves focus from one star to another', async () => {
    stars()[0].focus();
    stars()[0].click();
    await settle();

    // A pointer press on a star focuses that `<button>` (Chrome, Firefox)
    // before its click lands.
    stars()[2].focus();
    stars()[2].click();
    await settle();

    expect(ctrl.value).toBe(3);
    expect(ctrl.touched).toBe(false);
  });

  it('does not touch when focus moves from a star to the host between the stars', async () => {
    stars()[1].focus();
    ratingHost().focus();
    await settle();

    expect(ctrl.touched).toBe(false);
  });

  it('marks the control touched when focus leaves from the host', async () => {
    ratingHost().focus();
    await settle();

    outside().focus();
    await settle();

    expect(ctrl.touched).toBe(true);
  });

  it('marks the control touched when focus leaves from a star', async () => {
    stars()[3].focus();
    outside().focus();
    await settle();

    expect(ctrl.touched).toBe(true);
  });
});

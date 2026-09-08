import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvLabel } from './label';

@Component({
  imports: [MlvLabel],
  template: `<mlv-label [for]="'field-1'" [required]="required()"
    >Email</mlv-label
  >`,
})
class HostComponent {
  readonly required = signal(false);
}

/**
 * Drives `for` through the widened write type. `_ownLabelFor()` on
 * `MlvSignalFormUiControlBase` hands this input `string | null` (#216), and
 * `null` has to mean the same as `''` — emit no attribute — rather than
 * `for="null"` or `for=""`.
 */
@Component({
  imports: [MlvLabel],
  template: `<mlv-label [for]="target()">Email</mlv-label>`,
})
class NullableForHost {
  readonly target = signal<string | null | undefined>('field-1');
}

describe('MlvLabel', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('renders the label text against the referenced control', () => {
    const label = fixture.nativeElement.querySelector(
      'label',
    ) as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('field-1');
    expect(label.textContent?.trim()).toBe('Email');
  });

  it('renders no required marker by default', () => {
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).toBeNull();
  });

  it('renders the asterisk marker plus a visually hidden translated word when required', async () => {
    fixture.componentInstance.required.set(true);
    await fixture.whenStable();

    const marker = fixture.nativeElement.querySelector(
      '.mlv-label__required',
    ) as HTMLElement;
    expect(marker.textContent).toBe('*');
    // The visual marker itself must stay out of the a11y tree; the adjacent
    // visually-hidden node carries the announced word.
    expect(marker.getAttribute('aria-hidden')).toBe('true');
    expect(
      (
        fixture.nativeElement.querySelector(
          '.cdk-visually-hidden',
        ) as HTMLElement
      ).textContent?.trim(),
    ).toBe('required');
  });
});

describe('MlvLabel — a nullish `for` emits no attribute (#216)', () => {
  async function render(): Promise<{
    fixture: ComponentFixture<NullableForHost>;
    label: () => HTMLLabelElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [NullableForHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NullableForHost);
    await fixture.whenStable();
    return {
      fixture,
      label: () =>
        fixture.nativeElement.querySelector('label') as HTMLLabelElement,
    };
  }

  it('renders the attribute for a real id', async () => {
    const { label } = await render();

    expect(label().getAttribute('for')).toBe('field-1');
  });

  for (const [name, value] of [
    ['null', null],
    ['undefined', undefined],
    ['the empty string', ''],
  ] as const) {
    it(`emits no \`for\` at all for ${name}`, async () => {
      const { fixture, label } = await render();
      fixture.componentInstance.target.set(value);
      await fixture.whenStable();

      // Not `for=""`, not `for="null"` — the attribute is absent, because a
      // `for` that names nothing reads as an association while focusing
      // nothing (#197).
      expect(label().hasAttribute('for')).toBe(false);
    });
  }

  it('round-trips back to a real id after a nullish value', async () => {
    const { fixture, label } = await render();
    fixture.componentInstance.target.set(null);
    await fixture.whenStable();
    expect(label().hasAttribute('for')).toBe(false);

    fixture.componentInstance.target.set('field-2');
    await fixture.whenStable();

    expect(label().getAttribute('for')).toBe('field-2');
  });
});

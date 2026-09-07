import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvStatusIndicator } from './status-indicator';

describe('MlvStatusIndicator', () => {
  let component: MlvStatusIndicator;
  let fixture: ComponentFixture<MlvStatusIndicator>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvStatusIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvStatusIndicator);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies the block class and defaults to the "default" tone', () => {
    expect(host.classList.contains('mlv-status-indicator')).toBe(true);
    expect(host.classList.contains('mlv-status-indicator--tone-default')).toBe(
      true,
    );
  });

  it('reflects the tone input into a modifier class', () => {
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--tone-success')).toBe(
      true,
    );
    expect(host.classList.contains('mlv-status-indicator--tone-default')).toBe(
      false,
    );
  });

  it('supports every semantic tone as a modifier class', () => {
    const tones = [
      'default',
      'primary',
      'secondary',
      'accent',
      'success',
      'info',
      'warning',
      'danger',
    ] as const;
    for (const tone of tones) {
      fixture.componentRef.setInput('tone', tone);
      fixture.detectChanges();
      expect(
        host.classList.contains(`mlv-status-indicator--tone-${tone}`),
      ).toBe(true);
    }
  });

  it('does not add the pulse class by default', () => {
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(false);
  });

  it('adds the pulse class when pulse is enabled', () => {
    fixture.componentRef.setInput('pulse', true);
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(true);
  });

  it('coerces the pulse attribute (bare attribute usage) to true', () => {
    fixture.componentRef.setInput('pulse', '');
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(true);
  });

  it('is decorative (aria-hidden, no role/name) when unlabeled', () => {
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('aria-label')).toBeNull();
  });

  it('exposes role="img" and an accessible name when labeled', () => {
    fixture.componentRef.setInput('ariaLabel', 'Online');
    fixture.detectChanges();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Online');
    expect(host.getAttribute('aria-hidden')).toBeNull();
  });

  it('defaults the dot size to 0.5rem and converts the size input to rem', () => {
    expect(host.style.getPropertyValue('--mlv-status-indicator-size')).toBe(
      '0.5rem',
    );
    fixture.componentRef.setInput('size', 16);
    fixture.detectChanges();
    expect(host.style.getPropertyValue('--mlv-status-indicator-size')).toBe(
      '1rem',
    );
  });
});

/**
 * Accessibility sweep.
 *
 * The dot renders no content at all, so its meaning lives entirely in three
 * mutually-dependent host attributes: with an `ariaLabel` it becomes a named
 * `role="img"`, and without one it becomes `aria-hidden="true"` so a bare
 * coloured dot is not announced as an anonymous graphic. Both branches are
 * swept — the unnamed one beside the visible text it is decorating, which is
 * the arrangement that makes hiding it correct rather than lossy.
 */
describe('MlvStatusIndicator accessibility', () => {
  @Component({
    imports: [MlvStatusIndicator],
    template: `
      @for (tone of tones; track tone) {
        <span class="row">
          <mlv-status-indicator [tone]="tone" />
          {{ tone }}
        </span>
      }

      <mlv-status-indicator tone="success" ariaLabel="Online" id="named" />
      <mlv-status-indicator tone="danger" pulse ariaLabel="Recording" />
      <mlv-status-indicator tone="info" pulse [size]="12" id="decorative" />
    `,
  })
  class StatusIndicatorA11yHost {
    readonly tones = [
      'default',
      'primary',
      'secondary',
      'accent',
      'info',
      'success',
      'warning',
      'danger',
    ] as const;
  }

  it('has no axe violations for named and decorative dots alike', async () => {
    await TestBed.configureTestingModule({
      imports: [StatusIndicatorA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatusIndicatorA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    // State: the two named dots are `role="img"` and not hidden; the nine
    // unnamed ones are hidden and carry no role, so there is no nameless
    // `role="img"` anywhere.
    const named = [...el.querySelectorAll('mlv-status-indicator[role="img"]')];
    expect(named).toHaveLength(2);
    expect(named.every((d) => d.getAttribute('aria-hidden') === null)).toBe(
      true,
    );
    const hidden = [
      ...el.querySelectorAll('mlv-status-indicator[aria-hidden="true"]'),
    ];
    expect(hidden).toHaveLength(9);
    expect(hidden.every((d) => d.getAttribute('role') === null)).toBe(true);
    expect(el.querySelector('#named')?.getAttribute('aria-label')).toBe(
      'Online',
    );
    expect(el.querySelector('#decorative')?.getAttribute('role')).toBeNull();

    await expectNoAxeViolations(el);
  });
});

import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvDivider } from './divider';

describe('MlvDivider', () => {
  @Component({
    template: `<mlv-divider
      [orientation]="orientation()"
      [dashed]="dashed()"
      [muted]="muted()"
      >{{ label() }}</mlv-divider
    >`,
    imports: [MlvDivider],
  })
  class TestHostComponent {
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
    dashed = signal(false);
    muted = signal(false);
    label = signal('');
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    el = fixture.nativeElement.querySelector('mlv-divider');
  });

  it('should create', () => {
    expect(el).toBeTruthy();
  });

  it('should have role="separator"', () => {
    expect(el.getAttribute('role')).toBe('separator');
  });

  it('should apply horizontal class by default', () => {
    expect(el.classList.contains('mlv-divider--horizontal')).toBe(true);
  });

  it('should apply aria-orientation="horizontal" by default', () => {
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('should apply vertical class when orientation is vertical', async () => {
    host.orientation.set('vertical');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--vertical')).toBe(true);
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('should apply dashed class when dashed=true', async () => {
    host.dashed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--dashed')).toBe(true);
  });

  it('should apply muted class when muted=true', async () => {
    host.muted.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--muted')).toBe(true);
  });

  it('should project label content', async () => {
    host.label.set('OR');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.textContent?.trim()).toBe('OR');
  });

  it('should have mlv-divider base class', () => {
    expect(el.classList.contains('mlv-divider')).toBe(true);
  });
});

/**
 * Accessibility sweep.
 *
 * The divider's entire contract is ARIA: a static `role="separator"` plus an
 * `aria-orientation` bound to the `orientation` input. Both orientations are
 * swept, and both the bare rule and the labelled variant — a separator with
 * projected text is the render where the role and the content have to agree.
 */
describe('MlvDivider accessibility', () => {
  @Component({
    imports: [MlvDivider],
    template: `
      <mlv-divider />
      <mlv-divider dashed muted />
      <mlv-divider>Section</mlv-divider>
      <mlv-divider orientation="vertical" />
      <mlv-divider orientation="vertical" dashed>or</mlv-divider>
    `,
  })
  class DividerA11yHost {}

  it('has no axe violations in both orientations, bare and labelled', async () => {
    await TestBed.configureTestingModule({
      imports: [DividerA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(DividerA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: five separators, each announcing its own orientation.
    const separators = [...host.querySelectorAll('[role="separator"]')];
    expect(separators).toHaveLength(5);
    expect(separators.map((el) => el.getAttribute('aria-orientation'))).toEqual(
      ['horizontal', 'horizontal', 'horizontal', 'vertical', 'vertical'],
    );

    await expectNoAxeViolations(host);
  });
});

import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvToolbar } from './toolbar';
import { MlvToolbarSpacer } from './toolbar-spacer';

@Component({
  imports: [MlvToolbar, MlvToolbarSpacer],
  template: `
    <mlv-toolbar [gap]="gap()" [equalSize]="equalSize()">
      <button>Left</button>
      <mlv-toolbar-spacer />
      <button>Right</button>
    </mlv-toolbar>
  `,
})
class ToolbarTestHostComponent {
  gap = signal(0.25);
  equalSize = signal(false);
}

describe('MlvToolbar', () => {
  let fixture: ComponentFixture<ToolbarTestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarTestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarTestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('should apply default gap', () => {
    const toolbar = fixture.nativeElement.querySelector(
      '.mlv-toolbar',
    ) as HTMLElement;
    expect(toolbar.style.gap).toBe('0.25rem');
  });

  it('should apply custom gap', async () => {
    fixture.componentInstance.gap.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector(
      '.mlv-toolbar',
    ) as HTMLElement;
    expect(toolbar.style.gap).toBe('1rem');
  });

  it('should apply equal size class', async () => {
    fixture.componentInstance.equalSize.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
    expect(toolbar.classList.contains('mlv-toolbar--equal')).toBe(true);
  });

  it('should render spacer', () => {
    const spacer = fixture.nativeElement.querySelector('.mlv-toolbar-spacer');
    expect(spacer).toBeTruthy();
  });
});

/**
 * Accessibility sweep — plain toolbar.
 *
 * `mlv-toolbar` adds no role on purpose (the WAI-ARIA toolbar pattern is opt-in
 * through `mlvToolbarRoving`, swept in `toolbar-widget.spec.ts`), so what this
 * sweep covers is the layout container itself and `mlv-toolbar-spacer` — an
 * element that renders literally nothing, which is precisely the shape that
 * breaks a parent claiming `role="list"` or `role="toolbar"` around it. Both
 * text and icon-only children are included, since an icon-only control in a
 * toolbar is where a missing name shows up.
 */
describe('MlvToolbar accessibility', () => {
  @Component({
    imports: [MlvToolbar, MlvToolbarSpacer],
    template: `
      <mlv-toolbar>
        <button type="button">Save</button>
        <mlv-toolbar-spacer />
        <button type="button" aria-label="More options">
          <svg aria-hidden="true"></svg>
        </button>
      </mlv-toolbar>

      <mlv-toolbar equalSize [gap]="0.5">
        <button type="button">One</button>
        <button type="button">Two</button>
        <a href="/three">Three</a>
      </mlv-toolbar>
    `,
  })
  class ToolbarA11yHost {}

  it('has no axe violations for plain and equal-size toolbars', async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(ToolbarA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: two containers, neither claiming a role, and the spacer really is
    // an empty element sitting between two named controls.
    const bars = [...host.querySelectorAll('mlv-toolbar')];
    expect(bars).toHaveLength(2);
    expect(bars.every((el) => el.getAttribute('role') === null)).toBe(true);
    const spacer = host.querySelector('mlv-toolbar-spacer') as HTMLElement;
    expect(spacer.childElementCount).toBe(0);
    expect((spacer.textContent ?? '').trim()).toBe('');

    await expectNoAxeViolations(host);
  });
});

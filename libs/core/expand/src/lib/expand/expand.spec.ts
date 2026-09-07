import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvExpand } from './expand';
import { MlvExpandContent } from './expand-content';

describe('MlvExpand', () => {
  let component: MlvExpand;
  let fixture: ComponentFixture<MlvExpand>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvExpand],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvExpand);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be closed by default', () => {
    expect(component.opened()).toBe(false);
  });

  it('should render body when open is true', async () => {
    component.opened.set(true);
    fixture.detectChanges();
    const body = fixture.debugElement.query(By.css('.mlv-expand__body'));
    expect(body).toBeTruthy();
  });

  it('should not render body when open is false', () => {
    const body = fixture.debugElement.query(By.css('.mlv-expand__body'));
    expect(body).toBeNull();
  });

  it('should toggle open state', () => {
    expect(component.opened()).toBe(false);
    component.toggle();
    expect(component.opened()).toBe(true);
    component.toggle();
    expect(component.opened()).toBe(false);
  });

  it('should not toggle when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    component.toggle();
    expect(component.opened()).toBe(false);
  });

  it('should apply mlv-expand--disabled class when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-expand--disabled'),
    ).toBe(true);
  });

  it('does not mark the body inert while open (content stays interactive)', () => {
    component.opened.set(true);
    fixture.detectChanges();
    const body = fixture.debugElement.query(By.css('.mlv-expand__body'));
    expect(body.nativeElement.hasAttribute('inert')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MlvExpand — collapsed content is not focusable
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-expand [(opened)]="isOpen">
      <button class="inner-focusable">Focusable</button>
    </mlv-expand>
  `,
  imports: [MlvExpand],
})
class FocusableHostComponent {
  isOpen = signal(false);
}

describe('MlvExpand — collapsed content focusability', () => {
  it('removes focusable content from the tab order when collapsed', async () => {
    const f = TestBed.createComponent(FocusableHostComponent);
    f.detectChanges();
    await f.whenStable();

    // Open: the focusable button is present and reachable.
    f.componentInstance.isOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    const body = f.debugElement.query(By.css('.mlv-expand__body'));
    expect(f.debugElement.query(By.css('.inner-focusable'))).not.toBeNull();
    // While open the body is interactive (not inert).
    expect(body.nativeElement.hasAttribute('inert')).toBe(false);

    // Collapse: the content is no longer in the DOM, so it cannot be tabbed to.
    f.componentInstance.isOpen.set(false);
    f.detectChanges();
    await f.whenStable();
    expect(f.debugElement.query(By.css('.inner-focusable'))).toBeNull();
  });
});

@Component({
  template: `
    <mlv-expand [(opened)]="isOpen">
      <ng-template mlvExpandContent>
        <span class="lazy-content">lazy</span>
      </ng-template>
    </mlv-expand>
  `,
  imports: [MlvExpand, MlvExpandContent],
})
class LazyHostComponent {
  isOpen = signal(false);
}

describe('MlvExpand — lazy content', () => {
  it('should not render lazy content until first open', async () => {
    const f = TestBed.createComponent(LazyHostComponent);
    f.detectChanges();
    await f.whenStable();

    expect(f.debugElement.query(By.css('.lazy-content'))).toBeNull();

    f.componentInstance.isOpen.set(true);
    f.detectChanges();
    await f.whenStable();

    expect(f.debugElement.query(By.css('.lazy-content'))).toBeTruthy();
  });
});

@Component({
  imports: [MlvExpand, MlvExpandContent],
  template: `
    <h2 id="details-heading">Shipping details</h2>
    <button
      type="button"
      [attr.aria-expanded]="eager()"
      aria-controls="details-panel"
      (click)="eager.set(!eager())"
    >
      Details
    </button>
    <mlv-expand
      id="details-panel"
      [(opened)]="eager"
      ariaLabelledBy="details-heading"
    >
      <p>Eager body</p>
      <a href="#tracking">Track this order</a>
    </mlv-expand>

    <mlv-expand [(opened)]="lazy" ariaLabel="Advanced options">
      <ng-template mlvExpandContent>
        <button type="button">Lazy control</button>
      </ng-template>
    </mlv-expand>

    <mlv-expand disabled>
      <p>Never openable</p>
    </mlv-expand>
  `,
})
class ExpandA11yHost {
  readonly eager = signal(false);
  readonly lazy = signal(false);
}

/**
 * Accessibility sweeps — `mlv-expand`.
 *
 * The panel renders nothing at all while closed, so the closed and open
 * renderings are genuinely different markup rather than one markup with a
 * class on it — a default-state sweep would assert nothing about the body.
 * Open, the body becomes a `role="region"` if and only if the consumer gave it
 * a name, and `aria-labelledby` has to resolve to an element that exists; both
 * naming paths are swept, rooted at the fixture so the referenced heading is in
 * scope. The lazy path is swept separately because its content is constructed
 * on first open by a different code path than `<ng-content>`.
 */
describe('MlvExpand accessibility', () => {
  let a11yFixture: ComponentFixture<ExpandA11yHost>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ExpandA11yHost],
    }).compileComponents();

    a11yFixture = TestBed.createComponent(ExpandA11yHost);
    root = a11yFixture.nativeElement as HTMLElement;
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  });

  it('has no axe violations with every panel closed', async () => {
    // State: no body element exists at all, so the trigger's `aria-controls`
    // points at the still-empty `mlv-expand` host and reports collapsed.
    expect(root.querySelectorAll('.mlv-expand__body')).toHaveLength(0);
    expect(
      root
        .querySelector('button[aria-controls]')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with the eager panel open and labelled by a heading', async () => {
    a11yFixture.componentInstance.eager.set(true);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: the body exists and claims `role="region"`, named by an element
    // that must actually be in the document for the name to resolve.
    const body = root.querySelector('.mlv-expand__body') as HTMLElement;
    expect(body.getAttribute('role')).toBe('region');
    const labelledBy = body.getAttribute('aria-labelledby') as string;
    expect(root.querySelectorAll(`#${labelledBy}`)).toHaveLength(1);
    expect(root.querySelector('a[href="#tracking"]')).not.toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with the lazy panel open and labelled inline', async () => {
    a11yFixture.componentInstance.lazy.set(true);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: the deferred template is constructed for the first time, inside a
    // region named by `aria-label` rather than by reference.
    const body = root.querySelector('.mlv-expand__body') as HTMLElement;
    expect(body.getAttribute('role')).toBe('region');
    expect(body.getAttribute('aria-label')).toBe('Advanced options');
    expect(body.querySelector('button')?.textContent).toContain('Lazy control');

    await expectNoAxeViolations(root);
  });

  it('has no axe violations for an unnamed open panel', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MlvExpand],
    }).compileComponents();
    const bare = TestBed.createComponent(MlvExpand);
    bare.componentInstance.opened.set(true);
    bare.detectChanges();
    await bare.whenStable();

    // State: with no name the body deliberately claims no role, so it never
    // becomes an unnamed `region` — the thing `aria-region-name` would flag.
    const body = (bare.nativeElement as HTMLElement).querySelector(
      '.mlv-expand__body',
    ) as HTMLElement;
    expect(body.hasAttribute('role')).toBe(false);

    await expectNoAxeViolations(bare.nativeElement as HTMLElement);
  });
});

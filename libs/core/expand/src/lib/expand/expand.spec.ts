import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
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

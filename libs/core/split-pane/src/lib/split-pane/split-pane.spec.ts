import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvSplitPane } from './split-pane';
import { MlvSplitPanePanel } from './split-pane-panel';

// ─── Test host components ─────────────────────────────────────────────────────

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane>
      <mlv-split-pane-panel [size]="30">Panel 1</mlv-split-pane-panel>
      <mlv-split-pane-panel>Panel 2</mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
class BasicSplitPaneHost {}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane orientation="vertical">
      <mlv-split-pane-panel [size]="40">Top</mlv-split-pane-panel>
      <mlv-split-pane-panel>Bottom</mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
class VerticalSplitPaneHost {}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MlvSplitPane', () => {
  let fixture: ComponentFixture<BasicSplitPaneHost>;
  let splitPaneEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicSplitPaneHost, VerticalSplitPaneHost],
    }).compileComponents();

    fixture = TestBed.createComponent(BasicSplitPaneHost);
    fixture.detectChanges();
    await fixture.whenStable();
    splitPaneEl = fixture.debugElement.query(
      By.directive(MlvSplitPane),
    ).nativeElement;
  });

  it('should create', () => {
    const component = fixture.debugElement.query(By.directive(MlvSplitPane));
    expect(component).toBeTruthy();
  });

  it('should default to horizontal orientation', () => {
    const component = fixture.debugElement.query(By.directive(MlvSplitPane))
      .componentInstance as MlvSplitPane;
    expect(component.orientation()).toBe('horizontal');
  });

  it('should apply horizontal class by default', () => {
    expect(splitPaneEl.classList.contains('mlv-split-pane--horizontal')).toBe(
      true,
    );
  });

  it('should apply vertical class when orientation is vertical', () => {
    const verticalFixture = TestBed.createComponent(VerticalSplitPaneHost);
    verticalFixture.detectChanges();
    const el = verticalFixture.debugElement.query(
      By.directive(MlvSplitPane),
    ).nativeElement;
    expect(el.classList.contains('mlv-split-pane--vertical')).toBe(true);
    expect(el.classList.contains('mlv-split-pane--horizontal')).toBe(false);
  });

  it('should render a drag handle between panels', () => {
    const handle = splitPaneEl.querySelector('.mlv-split-pane__handle');
    expect(handle).toBeTruthy();
  });

  it('should have role="separator" on handle', () => {
    const handle = splitPaneEl.querySelector('.mlv-split-pane__handle');
    expect(handle?.getAttribute('role')).toBe('separator');
  });

  it('should have tabindex="0" on handle for keyboard access', () => {
    const handle = splitPaneEl.querySelector('.mlv-split-pane__handle');
    expect(handle?.getAttribute('tabindex')).toBe('0');
  });

  it('should set aria-orientation="vertical" on handle in horizontal mode', () => {
    const handle = splitPaneEl.querySelector('.mlv-split-pane__handle');
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('should set aria-orientation="horizontal" on handle in vertical mode', () => {
    const verticalFixture = TestBed.createComponent(VerticalSplitPaneHost);
    verticalFixture.detectChanges();
    const el = verticalFixture.debugElement.query(
      By.directive(MlvSplitPane),
    ).nativeElement;
    const handle = el.querySelector('.mlv-split-pane__handle');
    expect(handle?.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('should apply grid-template-columns in horizontal mode', () => {
    const gridTemplate = splitPaneEl.style.getPropertyValue(
      'grid-template-columns',
    );
    expect(gridTemplate).toBeTruthy();
  });

  it('should render two panels', () => {
    const panels = fixture.debugElement.queryAll(
      By.directive(MlvSplitPanePanel),
    );
    expect(panels.length).toBe(2);
  });
});

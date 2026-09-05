import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvRtlService } from '@malva-ui/cdk/utils';
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

describe('MlvSplitPane — scoped direction', () => {
  let fixture: ComponentFixture<BasicSplitPaneHost>;
  let handle: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicSplitPaneHost],
    }).compileComponents();

    fixture = TestBed.createComponent(BasicSplitPaneHost);
    fixture.detectChanges();
    await fixture.whenStable();
    handle = fixture.debugElement
      .query(By.directive(MlvSplitPane))
      .nativeElement.querySelector('.mlv-split-pane__handle') as HTMLElement;
  });

  afterEach(() => {
    // `setDirection` is global state (it writes `dir` onto <html>) — reset both
    // the service and the attribute so a direction never leaks into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  function keydown(key: string): void {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  it('mirrors handle arrows inside a scoped [dir="rtl"] subtree while the document stays LTR', () => {
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(handle.getAttribute('aria-valuenow')).toBe('30');

    // ArrowLeft grows the inline-first panel once the axis runs right-to-left.
    keydown('ArrowLeft');
    expect(handle.getAttribute('aria-valuenow')).toBe('31');

    keydown('ArrowRight');
    expect(handle.getAttribute('aria-valuenow')).toBe('30');

    // Vertical arrows are inert in a horizontal split and never mirror.
    keydown('ArrowUp');
    expect(handle.getAttribute('aria-valuenow')).toBe('30');

    // Home/End are direction-agnostic: Home pins the leading panel at its min.
    keydown('Home');
    expect(handle.getAttribute('aria-valuenow')).toBe('5');

    scope.removeAttribute('dir');
  });

  it('leaves a scoped [dir="ltr"] island unmirrored while the document is RTL', () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');
    fixture.detectChanges();

    keydown('ArrowRight');
    expect(handle.getAttribute('aria-valuenow')).toBe('31');

    scope.removeAttribute('dir');
  });
});

import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, ErrorHandler, signal } from '@angular/core';
import { MlvToolbar } from './toolbar';
import { MlvToolbarRoving, MlvToolbarWidget } from './toolbar-widget';

/** Collects errors that Angular routes through its ErrorHandler (e.g. NG0950). */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

@Component({
  imports: [MlvToolbar, MlvToolbarRoving, MlvToolbarWidget],
  template: `
    <mlv-toolbar mlvToolbarRoving [wrap]="wrap()">
      <button mlvToolbarWidget>Save</button>
      <button mlvToolbarWidget [disabled]="secondDisabled()">Print</button>
      <button mlvToolbarWidget>Share</button>
    </mlv-toolbar>
  `,
})
class ActionToolbarHost {
  wrap = signal(true);
  secondDisabled = signal(false);
}

@Component({
  imports: [MlvToolbar, MlvToolbarRoving, MlvToolbarWidget],
  template: `
    <mlv-toolbar mlvToolbarRoving [(value)]="selected">
      <button mlvToolbarWidget="left">Left</button>
      <button mlvToolbarWidget="center">Center</button>
      <button mlvToolbarWidget="right">Right</button>
    </mlv-toolbar>
  `,
})
class SelectionToolbarHost {
  selected = signal<string[]>([]);
}

describe('Toolbar roving directives', () => {
  describe('MlvToolbarRoving + MlvToolbarWidget', () => {
    let fixture: ComponentFixture<ActionToolbarHost>;
    let errorHandler: CapturingErrorHandler;

    beforeEach(async () => {
      errorHandler = new CapturingErrorHandler();
      await TestBed.configureTestingModule({
        imports: [ActionToolbarHost],
        providers: [{ provide: ErrorHandler, useValue: errorHandler }],
      }).compileComponents();

      fixture = TestBed.createComponent(ActionToolbarHost);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    function widgets(): HTMLButtonElement[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[];
    }

    function pressKey(key: string): void {
      const toolbar = fixture.nativeElement.querySelector(
        '[role="toolbar"]',
      ) as HTMLElement;
      toolbar.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
    }

    it('should apply role="toolbar" to the host element', () => {
      const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
      expect(toolbar.getAttribute('role')).toBe('toolbar');
    });

    it('should make the toolbar a single tab stop (roving tabindex)', () => {
      const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
      expect(toolbar.getAttribute('tabindex')).toBe('-1');
      const [first, second, third] = widgets();
      expect(first.getAttribute('tabindex')).toBe('0');
      expect(second.getAttribute('tabindex')).toBe('-1');
      expect(third.getAttribute('tabindex')).toBe('-1');
    });

    it('should NOT raise NG0950 for value-less action widgets', () => {
      const ng0950 = errorHandler.errors.find((e) =>
        String((e as { message?: string })?.message ?? e).includes('NG0950'),
      );
      expect(ng0950).toBeUndefined();
    });

    it('should move the roving tabindex with ArrowRight', () => {
      pressKey('ArrowRight');
      const [first, second] = widgets();
      expect(first.getAttribute('tabindex')).toBe('-1');
      expect(second.getAttribute('tabindex')).toBe('0');
    });

    it('should move the roving tabindex back with ArrowLeft', () => {
      pressKey('ArrowRight');
      pressKey('ArrowLeft');
      const [first, second] = widgets();
      expect(first.getAttribute('tabindex')).toBe('0');
      expect(second.getAttribute('tabindex')).toBe('-1');
    });

    it('should jump to the last widget with End and the first with Home', () => {
      pressKey('End');
      let items = widgets();
      expect(items[2].getAttribute('tabindex')).toBe('0');

      pressKey('Home');
      items = widgets();
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });

    it('should wrap from last to first when wrap is enabled', () => {
      pressKey('End');
      pressKey('ArrowRight');
      const items = widgets();
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });

    it('should not wrap when wrap is disabled', async () => {
      fixture.componentInstance.wrap.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      pressKey('End');
      pressKey('ArrowRight');
      const items = widgets();
      expect(items[2].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('selection group', () => {
    let fixture: ComponentFixture<SelectionToolbarHost>;
    let host: SelectionToolbarHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SelectionToolbarHost],
      }).compileComponents();

      fixture = TestBed.createComponent(SelectionToolbarHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should feed each widget value into the toolbar selection model on click', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.selected()).toContain('center');
    });
  });
});

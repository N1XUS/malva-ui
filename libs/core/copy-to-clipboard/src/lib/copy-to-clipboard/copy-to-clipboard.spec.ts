import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Clipboard } from '@angular/cdk/clipboard';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvCopyToClipboard } from './copy-to-clipboard';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

/**
 * Test host that projects static content. Used to exercise the textContent
 * fallback path when no explicit value is provided.
 */
@Component({
  selector: 'mlv-test-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `
    <mlv-copy-to-clipboard (copied)="onCopied($event)"
      >projected-value</mlv-copy-to-clipboard
    >
  `,
})
class TestHostComponent {
  copiedEvents: string[] = [];

  onCopied(text: string): void {
    this.copiedEvents.push(text);
  }
}

describe('MlvCopyToClipboard', () => {
  // The implementation uses CDK Clipboard.copy() (returns boolean). The
  // spy mirrors that contract and is provided to TestBed via the Clipboard
  // token override; older variants of this suite mocked navigator.clipboard
  // directly which no longer matches the runtime path.
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let resizeEvents$: Subject<ResizeObserverEntry[]>;
  const clipboardStub = {
    copy: (text: string) => writeTextSpy(text),
  };
  const resizeObserverStub = {
    observe: () => resizeEvents$.asObservable(),
  };

  beforeEach(() => {
    vi.useFakeTimers();

    writeTextSpy = vi.fn().mockReturnValue(true);
    resizeEvents$ = new Subject<ResizeObserverEntry[]>();
  });

  afterEach(() => {
    vi.useRealTimers();
    resizeEvents$.complete();
  });

  // ── Standalone component tests (setInput-driven) ──────────────────────────

  describe('standalone', () => {
    let fixture: ComponentFixture<MlvCopyToClipboard>;
    let component: MlvCopyToClipboard;
    let hostEl: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MlvCopyToClipboard],
        providers: [
          provideMlvI18nTesting(),
          { provide: Clipboard, useValue: clipboardStub },
          { provide: MlvResizeObserverService, useValue: resizeObserverStub },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(MlvCopyToClipboard);
      component = fixture.componentInstance;
      hostEl = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    // ── Creation ─────────────────────────────────────────────────────────────

    it('creates without error', () => {
      expect(component).toBeTruthy();
    });

    it('applies the mlv-copy-to-clipboard block class to the host', () => {
      expect(hostEl.classList).toContain('mlv-copy-to-clipboard');
    });

    it('sets role="button" on the host', () => {
      expect(hostEl.getAttribute('role')).toBe('button');
    });

    it('tracks its width for the horizontal mask layers', async () => {
      resizeEvents$.next([
        { contentRect: { width: 200 } } as ResizeObserverEntry,
      ]);
      fixture.detectChanges();

      expect(
        hostEl.style.getPropertyValue(
          '--mlv-copy-to-clipboard-mask-leading-width',
        ),
      ).toBe('102px');
      expect(
        hostEl.style.getPropertyValue(
          '--mlv-copy-to-clipboard-mask-trailing-width',
        ),
      ).toBe('100px');
    });

    it('sets tabindex="0" when enabled', () => {
      expect(hostEl.getAttribute('tabindex')).toBe('0');
    });

    it('does not set aria-disabled when enabled', () => {
      expect(hostEl.getAttribute('aria-disabled')).toBeNull();
    });

    it('uses the default aria-label when no value is set', () => {
      expect(hostEl.getAttribute('aria-label')).toBe('Copy to clipboard');
    });

    it('renders an aria-live="polite" live region', () => {
      const live = fixture.debugElement.query(
        By.css('.mlv-copy-to-clipboard__live'),
      );
      expect(live).not.toBeNull();
      expect(live.nativeElement.getAttribute('aria-live')).toBe('polite');
    });

    // ── Copy with explicit value ─────────────────────────────────────────────

    describe('with explicit value', () => {
      beforeEach(async () => {
        fixture.componentRef.setInput('value', 'sk_live_explicit_value');
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it('writes the explicit value to the clipboard on click', async () => {
        hostEl.click();
        await Promise.resolve();
        expect(writeTextSpy).toHaveBeenCalledWith('sk_live_explicit_value');
      });

      it('flips isCopied() to true after a successful copy', async () => {
        expect(component.isCopied()).toBe(false);
        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();
        expect(component.isCopied()).toBe(true);
      });

      it('adds the mlv-copy-to-clipboard--copied class while copied', async () => {
        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();
        expect(hostEl.classList).toContain('mlv-copy-to-clipboard--copied');
      });

      it('emits the copied output with the written value', async () => {
        const emitted: string[] = [];
        component.copied.subscribe((text) => emitted.push(text));

        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();
        expect(emitted).toEqual(['sk_live_explicit_value']);
      });

      it('appends the explicit value to the aria-label', () => {
        expect(hostEl.getAttribute('aria-label')).toBe(
          'Copy to clipboard: sk_live_explicit_value',
        );
      });
    });

    // ── Reset after copiedDuration ───────────────────────────────────────────

    describe('reset after copiedDuration', () => {
      it('resets isCopied() to false after copiedDuration elapses', async () => {
        fixture.componentRef.setInput('value', 'token');
        fixture.componentRef.setInput('copiedDuration', 2000);
        fixture.detectChanges();

        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();
        expect(component.isCopied()).toBe(true);

        vi.advanceTimersByTime(1999);
        fixture.detectChanges();
        expect(component.isCopied()).toBe(true);

        vi.advanceTimersByTime(1);
        fixture.detectChanges();
        expect(component.isCopied()).toBe(false);
      });

      it('honors a custom copiedDuration', async () => {
        fixture.componentRef.setInput('value', 'token');
        fixture.componentRef.setInput('copiedDuration', 5000);
        fixture.detectChanges();

        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();

        vi.advanceTimersByTime(4000);
        fixture.detectChanges();
        expect(component.isCopied()).toBe(true);

        vi.advanceTimersByTime(1000);
        fixture.detectChanges();
        expect(component.isCopied()).toBe(false);
      });
    });

    // ── Keyboard activation ──────────────────────────────────────────────────

    describe('keyboard activation', () => {
      beforeEach(async () => {
        fixture.componentRef.setInput('value', 'keyboard-value');
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it('copies on Enter keydown', async () => {
        hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await Promise.resolve();
        expect(writeTextSpy).toHaveBeenCalledWith('keyboard-value');
      });

      it('copies on Space keydown', async () => {
        hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        await Promise.resolve();
        expect(writeTextSpy).toHaveBeenCalledWith('keyboard-value');
      });
    });

    // ── Disabled ─────────────────────────────────────────────────────────────

    describe('disabled', () => {
      beforeEach(async () => {
        fixture.componentRef.setInput('value', 'should-not-copy');
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it('adds the disabled modifier class', () => {
        expect(hostEl.classList).toContain('mlv-copy-to-clipboard--disabled');
      });

      it('reflects aria-disabled="true" on the host', () => {
        expect(hostEl.getAttribute('aria-disabled')).toBe('true');
      });

      it('removes the element from the tab order', () => {
        expect(hostEl.getAttribute('tabindex')).toBe('-1');
      });

      it('does not write to the clipboard on click', async () => {
        hostEl.click();
        await Promise.resolve();
        expect(writeTextSpy).not.toHaveBeenCalled();
      });

      it('does not emit copied when disabled', async () => {
        const emitted: string[] = [];
        component.copied.subscribe((text) => emitted.push(text));

        hostEl.click();
        await Promise.resolve();
        fixture.detectChanges();
        expect(emitted).toEqual([]);
      });

      it('coerces empty string (attribute syntax) to true for disabled', async () => {
        fixture.componentRef.setInput('disabled', '');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.disabled()).toBe(true);
        expect(hostEl.classList).toContain('mlv-copy-to-clipboard--disabled');
      });
    });

    // ── Clipboard failure handling ───────────────────────────────────────────

    describe('clipboard failure handling', () => {
      it('does not flip isCopied when Clipboard.copy reports failure (returns false)', async () => {
        writeTextSpy.mockReturnValueOnce(false);
        fixture.componentRef.setInput('value', 'rejected-value');
        fixture.detectChanges();

        const emitted: string[] = [];
        component.copied.subscribe((text) => emitted.push(text));

        hostEl.click();
        // flush microtasks
        await Promise.resolve();
        await Promise.resolve();
        fixture.detectChanges();

        expect(component.isCopied()).toBe(false);
        expect(emitted).toEqual([]);
      });
    });
  });

  // ── Host-projected content (textContent fallback) ──────────────────────────

  describe('projected textContent fallback', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let componentEl: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [
          provideMlvI18nTesting(),
          { provide: Clipboard, useValue: clipboardStub },
          { provide: MlvResizeObserverService, useValue: resizeObserverStub },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      host = fixture.componentInstance;
      fixture.detectChanges();
      componentEl = fixture.debugElement.query(By.css('mlv-copy-to-clipboard'))
        .nativeElement as HTMLElement;
    });

    it('falls back to the trimmed textContent of the host when no value is set', async () => {
      componentEl.click();
      await Promise.resolve();
      expect(writeTextSpy).toHaveBeenCalledWith('projected-value');
    });

    it('emits copied with the projected value', async () => {
      componentEl.click();
      await Promise.resolve();
      fixture.detectChanges();
      expect(host.copiedEvents).toEqual(['projected-value']);
    });
  });
});

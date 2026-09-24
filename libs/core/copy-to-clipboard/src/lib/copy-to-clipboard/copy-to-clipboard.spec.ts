import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Clipboard } from '@angular/cdk/clipboard';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
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

/**
 * Test host whose projected text, `ariaLabel` and `value` are all signals, so
 * one fixture walks every naming branch (#326).
 */
@Component({
  selector: 'mlv-test-name-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `
    <mlv-copy-to-clipboard [ariaLabel]="label()" [value]="value()">
      <code>{{ text() }}</code>
    </mlv-copy-to-clipboard>
  `,
})
class NameHostComponent {
  readonly text = signal('ng add @malva-ui/core');
  readonly label = signal<string | undefined>(undefined);
  readonly value = signal<string | undefined>(undefined);
}

/**
 * Test host giving the component a static `id` inside a heading, the shape
 * route focus reads by `textContent` (#326).
 */
@Component({
  selector: 'mlv-test-static-id-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `
    <h1>
      Order
      <mlv-copy-to-clipboard id="order-copy"
        ><code>0042</code></mlv-copy-to-clipboard
      >
    </h1>
  `,
})
class StaticIdHostComponent {}

/**
 * Test host binding a per-row `[id]` inside `@for` — an id with no static
 * form — and a single bound `[id]` that changes, so both reach the `id`
 * input rather than racing the host's own `id` binding (#326).
 */
@Component({
  selector: 'mlv-test-bound-id-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `
    @for (row of rows; track row) {
      <mlv-copy-to-clipboard [id]="'copy-' + row"
        ><code>{{ row }}</code></mlv-copy-to-clipboard
      >
    }
    <mlv-copy-to-clipboard class="changing" [id]="changingId()"
      ><code>key</code></mlv-copy-to-clipboard
    >
  `,
})
class BoundIdHostComponent {
  readonly rows = [7, 8];
  readonly changingId = signal<string | undefined>('consumer-a');
}

/**
 * The accessible name for this markup, following Chromium and Firefox as
 * measured natively (#326): `aria-labelledby` first — each IDREF's
 * contribution, space-joined — then `aria-label`. `null` when neither is
 * present. A reference to the element itself contributes its own
 * `aria-label` and never its subtree (accname 2B, then 2C). Any other
 * referenced node contributes its non-empty `aria-label`, else its text.
 * Where the two engines disagree — a hidden referenced node, whose
 * `aria-label` Chromium reads and Firefox ignores — the helper takes
 * Firefox's answer (text only), the stricter one.
 * Hand-rolled because no accessible-name library is a workspace dependency
 * (the same helper as `progress.spec.ts`); the axe sweeps below add
 * `aria-command-name`, which fails on an empty result.
 */
function accessibleName(element: Element): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const node = element.ownerDocument.getElementById(id);
        if (!node) return '';
        if (node === element) {
          return element.getAttribute('aria-label')?.trim() ?? '';
        }
        const label = node.hasAttribute('hidden')
          ? ''
          : node.getAttribute('aria-label')?.trim();
        return label || (node.textContent ?? '');
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return element.getAttribute('aria-label');
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

    it('names itself through its own aria-label, read back by aria-labelledby, when no value is set', () => {
      // Nothing projected here, so the name is the localized prefix alone.
      expect(hostEl.id).toMatch(/^mlv-copy-to-clipboard-\d+$/);
      expect(hostEl.getAttribute('aria-label')).toBe('Copy to clipboard:');
      expect(hostEl.getAttribute('aria-labelledby')?.split(/\s+/)[0]).toBe(
        hostEl.id,
      );
      expect(accessibleName(hostEl)).toBe('Copy to clipboard:');
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
        // The `aria-label` is the whole name here: nothing reads it back.
        expect(hostEl.hasAttribute('aria-labelledby')).toBe(false);
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

    it('copies only the projected text while the copied confirmation shows', async () => {
      componentEl.click();
      await Promise.resolve();
      fixture.detectChanges();
      // The polite region inside the host now holds "Copied to clipboard".
      expect(componentEl.textContent).toContain('Copied to clipboard');

      componentEl.click();
      await Promise.resolve();

      expect(writeTextSpy.mock.calls.map(([text]) => text)).toEqual([
        'projected-value',
        'projected-value',
      ]);
    });

    it('is named by the localized prefix and the projected text', () => {
      expect(componentEl.getAttribute('aria-label')).toBe('Copy to clipboard:');
      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: projected-value',
      );
    });
  });

  // ── Accessible name (#326) ─────────────────────────────────────────────────

  describe('accessible name', () => {
    let fixture: ComponentFixture<NameHostComponent>;
    let componentEl: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [NameHostComponent],
        providers: [
          provideMlvI18nTesting(),
          { provide: Clipboard, useValue: clipboardStub },
          { provide: MlvResizeObserverService, useValue: resizeObserverStub },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(NameHostComponent);
      fixture.detectChanges();
      componentEl = fixture.debugElement.query(By.css('mlv-copy-to-clipboard'))
        .nativeElement as HTMLElement;
    });

    it('contains the visible projected text (WCAG 2.5.3)', () => {
      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: ng add @malva-ui/core',
      );
    });

    it('follows projected text that changes, with no attribute rewrite', () => {
      const labelledBy = componentEl.getAttribute('aria-labelledby');

      fixture.componentInstance.text.set('ng add @malva-ui/editor');
      fixture.detectChanges();

      expect(componentEl.getAttribute('aria-labelledby')).toBe(labelledBy);
      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: ng add @malva-ui/editor',
      );
    });

    it('prefixes the projected text with a custom ariaLabel', () => {
      fixture.componentInstance.label.set('Copy the install command');
      fixture.detectChanges();

      expect(accessibleName(componentEl)).toBe(
        'Copy the install command: ng add @malva-ui/core',
      );
    });

    it('names itself by aria-label alone with an explicit value, and by both without one', () => {
      fixture.componentInstance.value.set('npm i @malva-ui/core');
      fixture.detectChanges();

      expect(componentEl.hasAttribute('aria-labelledby')).toBe(false);
      expect(componentEl.getAttribute('aria-label')).toBe(
        'Copy to clipboard: npm i @malva-ui/core',
      );

      fixture.componentInstance.value.set(undefined);
      fixture.detectChanges();

      expect(componentEl.getAttribute('aria-label')).toBe('Copy to clipboard:');
      expect(componentEl.hasAttribute('aria-labelledby')).toBe(true);
      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: ng add @malva-ui/core',
      );
    });

    it('references itself, then its own content wrapper', () => {
      const ids = (componentEl.getAttribute('aria-labelledby') ?? '').split(
        /\s+/,
      );
      const referenced = ids.map((id) => document.getElementById(id));

      expect(ids).toHaveLength(2);
      expect(referenced[0]).toBe(componentEl);
      expect(componentEl.contains(referenced[1] ?? null)).toBe(true);
      expect(
        referenced[1]?.classList.contains('mlv-copy-to-clipboard__content'),
      ).toBe(true);
    });

    it('keeps the prefix out of textContent, the name unchanged', () => {
      // The prefix lives only in the host's own `aria-label`: no node inside
      // carries it, so neither the host nor any ancestor reads
      // "Copy to clipboard:" as text.
      expect(componentEl.querySelectorAll('[aria-label]')).toHaveLength(0);
      expect(componentEl.querySelectorAll('[hidden]')).toHaveLength(0);
      expect(componentEl.textContent?.trim()).toBe('ng add @malva-ui/core');
      expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe(
        'ng add @malva-ui/core',
      );
      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: ng add @malva-ui/core',
      );
    });

    it('treats an empty ariaLabel as unset, on both naming paths', () => {
      fixture.componentInstance.label.set('');
      fixture.detectChanges();

      expect(accessibleName(componentEl)).toBe(
        'Copy to clipboard: ng add @malva-ui/core',
      );

      fixture.componentInstance.value.set('npm i @malva-ui/core');
      fixture.detectChanges();

      expect(componentEl.getAttribute('aria-label')).toBe(
        'Copy to clipboard: npm i @malva-ui/core',
      );
    });
  });

  describe('static id', () => {
    let fixture: ComponentFixture<StaticIdHostComponent>;
    let componentEl: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [StaticIdHostComponent],
        providers: [
          provideMlvI18nTesting(),
          { provide: Clipboard, useValue: clipboardStub },
          { provide: MlvResizeObserverService, useValue: resizeObserverStub },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(StaticIdHostComponent);
      fixture.detectChanges();
      componentEl = fixture.debugElement.query(By.css('mlv-copy-to-clipboard'))
        .nativeElement as HTMLElement;
    });

    it('keeps a static id and references itself by it', () => {
      expect(componentEl.id).toBe('order-copy');
      expect(document.querySelectorAll('#order-copy')).toHaveLength(1);
      expect(componentEl.getAttribute('aria-labelledby')?.split(/\s+/)[0]).toBe(
        'order-copy',
      );
      expect(accessibleName(componentEl)).toBe('Copy to clipboard: 0042');
    });

    it('adds nothing to the heading text', () => {
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('h1')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      ).toBe('Order 0042');
    });
  });

  describe('bound id', () => {
    let fixture: ComponentFixture<BoundIdHostComponent>;
    let root: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BoundIdHostComponent],
        providers: [
          provideMlvI18nTesting(),
          { provide: Clipboard, useValue: clipboardStub },
          { provide: MlvResizeObserverService, useValue: resizeObserverStub },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(BoundIdHostComponent);
      fixture.detectChanges();
      root = fixture.nativeElement as HTMLElement;
    });

    it('puts a per-row id bound inside @for on each host, which references itself by it', () => {
      for (const row of [7, 8]) {
        const host = document.getElementById(`copy-${row}`);
        expect(host?.tagName).toBe('MLV-COPY-TO-CLIPBOARD');
        expect(host?.getAttribute('aria-labelledby')?.split(/\s+/)[0]).toBe(
          `copy-${row}`,
        );
        expect(host ? accessibleName(host) : null).toBe(
          `Copy to clipboard: ${row}`,
        );
      }
    });

    it('moves the self-reference with a bound id that changes, and falls back to a generated one', () => {
      const host = root.querySelector('mlv-copy-to-clipboard.changing');
      if (!(host instanceof HTMLElement)) throw new Error('no changing host');
      const selfRef = () =>
        host.getAttribute('aria-labelledby')?.split(/\s+/)[0];

      expect(host.id).toBe('consumer-a');
      expect(selfRef()).toBe('consumer-a');

      fixture.componentInstance.changingId.set('consumer-b');
      fixture.detectChanges();
      expect(host.id).toBe('consumer-b');
      expect(selfRef()).toBe('consumer-b');
      expect(accessibleName(host)).toBe('Copy to clipboard: key');

      fixture.componentInstance.changingId.set(undefined);
      fixture.detectChanges();
      expect(host.id).toMatch(/^mlv-copy-to-clipboard-\d+$/);
      expect(selfRef()).toBe(host.id);
      expect(accessibleName(host)).toBe('Copy to clipboard: key');
    });
  });
});

@Component({
  selector: 'mlv-copy-a11y-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `
    <mlv-copy-to-clipboard [disabled]="disabled()">
      npm i @malva-ui/core
    </mlv-copy-to-clipboard>
  `,
})
class CopyA11yHost {
  readonly disabled = signal(false);
}

/**
 * Accessibility sweeps — `mlv-copy-to-clipboard`.
 *
 * The component synthesises a widget on a non-interactive element: `role`,
 * `tabindex`, the naming attributes (`aria-label`, read back through a
 * self-referencing `aria-labelledby` unless a `value` is set) and
 * `aria-disabled` all live on the host, and the
 * only visible affordance — the copy/check glyph pair — is deliberately
 * `aria-hidden`, with a polite live region carrying the confirmation instead.
 * So the sweep is rooted at the fixture root and parameterised over the three
 * states that change those attributes or that region's content: idle, copied,
 * and disabled.
 *
 * Kept in its own top-level `describe` because the suite above installs fake
 * timers for every test, and axe's own async pipeline runs on real ones.
 */
describe('MlvCopyToClipboard accessibility', () => {
  let fixture: ComponentFixture<CopyA11yHost>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CopyA11yHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: Clipboard, useValue: { copy: () => true } },
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => new Subject<ResizeObserverEntry[]>() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CopyA11yHost);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** The synthesised widget host. */
  function widget(): HTMLElement {
    return root.querySelector('mlv-copy-to-clipboard') as HTMLElement;
  }

  it('has no axe violations idle', async () => {
    // State: a named, focusable synthetic button; the glyph pair is hidden and
    // holds nothing focusable, and the live region is empty.
    const el = widget();
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(accessibleName(el)).toBe('Copy to clipboard: npm i @malva-ui/core');
    expect(
      el
        .querySelector('.mlv-copy-to-clipboard__indicator')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      el.querySelector('.mlv-copy-to-clipboard__live')?.textContent?.trim(),
    ).toBe('');

    await expectNoAxeViolations(root);
  });

  it('has no axe violations in the copied state', async () => {
    widget().click();
    fixture.detectChanges();
    await fixture.whenStable();

    // State: the success glyph is showing and the polite region now carries
    // the confirmation text — markup the idle sweep never saw.
    const el = widget();
    expect(el.classList.contains('mlv-copy-to-clipboard--copied')).toBe(true);
    expect(
      el.querySelector('.mlv-copy-to-clipboard__live')?.textContent?.trim(),
    ).toBeTruthy();
    // The confirmation lives inside the host but stays out of its name.
    expect(accessibleName(el)).toBe('Copy to clipboard: npm i @malva-ui/core');

    await expectNoAxeViolations(root);
  });

  it('has no axe violations disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // State: out of the tab order and reported disabled, still named.
    const el = widget();
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(el.getAttribute('aria-disabled')).toBe('true');

    await expectNoAxeViolations(root);
  });
});

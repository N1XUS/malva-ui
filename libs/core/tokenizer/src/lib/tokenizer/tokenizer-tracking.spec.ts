import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvToken } from '../token/token';
import { MlvTokenizer } from './tokenizer';

type Token = MlvSelectOption<string>;

/**
 * Three tokens sharing one `value` — the shape `allowDuplicates` exists to
 * permit. The labels differ only so a failure message names the row that
 * moved; the contract under test is *object identity*, not label text, which
 * is why the last spec in this file re-runs the same scenario on tokens whose
 * label and value are both identical.
 */
const duplicates = (): Token[] => [
  { label: 'Alpha', value: 'dup' },
  { label: 'Bravo', value: 'dup' },
  { label: 'Charlie', value: 'dup' },
];

@Component({
  template: `<mlv-tokenizer [(tokens)]="tokens" [allowDuplicates]="true" />`,
  imports: [MlvTokenizer],
})
class DuplicateTokensHostComponent {
  readonly tokens = signal<Token[]>(duplicates());
}

/**
 * Rendering identity of `@for (token of visibleTokens(); track …)` — see #185.
 *
 * `allowDuplicates` deliberately permits several tokens carrying the same
 * `value`, so tracking by `token.value` hands Angular duplicate keys. The
 * reconciler then pairs old row *i* with new item *i* by key and rewrites the
 * surviving rows' context, which detaches the wrong DOM node and slides
 * per-token state (`armed`, the roving `tabindex`, DOM focus, and any state a
 * consumer's `[mlvTokenTemplate]` holds) onto a neighbouring row.
 *
 * **Why every scenario here removes the FIRST duplicate.** Removing the *last*
 * of N identical-valued tokens does not discriminate: both tracking schemes
 * destroy the trailing row, so a spec written that way is green under the bug
 * and certifies it. Removing the first diverges in *both* surviving slots —
 * with `track token.value` the reconciler matches `[A,B,C] → [B,C]` head-first
 * (rows 0 and 1 survive, holding B and C; the row built for C is destroyed),
 * while with `track token` the tail matches first and the row built for A —
 * the token actually removed — is the one destroyed. Removing the middle
 * diverges in only one slot, so the front is the strongest case.
 */
describe('MlvTokenizer — rendering identity with duplicate token values', () => {
  let fixture: ComponentFixture<DuplicateTokensHostComponent>;

  /**
   * Stable, printable names for the rows as they existed at capture time.
   * Identity is asserted through these strings rather than by comparing DOM
   * nodes or component instances directly: a failing `toBe`/`toEqual` on an
   * Angular object pretty-prints the whole graph and stalls the runner.
   */
  let rowIds: WeakMap<object, string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DuplicateTokensHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DuplicateTokensHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    rowIds = new WeakMap();
  });

  /** Runs change detection and lets the key-manager effect settle. */
  const flush = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** The rendered token host elements, in DOM order. */
  const tokenEls = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mlv-token'));

  /** The rendered `MlvToken` component instances, in DOM order. */
  const tokenInstances = (): MlvToken<string>[] =>
    fixture.debugElement
      .queryAll(By.directive(MlvToken))
      .map((d) => d.componentInstance as MlvToken<string>);

  /** Labels of the rendered chips, in DOM order. */
  const labels = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('mlv-token .mlv-chip__label'),
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');

  /** Tags the currently rendered rows (host element + instance) as `row0…rowN`. */
  const tagRows = (): void => {
    tokenEls().forEach((el, i) => rowIds.set(el, `row${i}`));
    tokenInstances().forEach((inst, i) => rowIds.set(inst, `row${i}`));
  };

  /** Names of the currently rendered host elements, per the capture-time tags. */
  const renderedElementIds = (): string[] =>
    tokenEls().map((el) => rowIds.get(el) ?? 'created-after-capture');

  /** Names of the currently rendered component instances, per the tags. */
  const renderedInstanceIds = (): string[] =>
    tokenInstances().map((i) => rowIds.get(i) ?? 'created-after-capture');

  /** The chip close button inside a token host. */
  const closeButton = (el: HTMLElement): HTMLButtonElement =>
    el.querySelector('.mlv-chip__close') as HTMLButtonElement;

  /** The tokenizer's native text input element. */
  const nativeInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input.mlv-input__native');

  /** Dispatches a bubbling keydown on the text input. */
  const inputKey = (key: string): void => {
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
  };

  it('destroys the removed token’s own row, not the trailing one', async () => {
    expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    tagRows();
    const rowAlpha = tokenEls()[0];
    const rowCharlie = tokenEls()[2];

    closeButton(rowAlpha).click();
    await flush();

    // The model removes by reference (`filter((t) => t !== token)`), so this
    // much holds under either tracking scheme — it is not the discriminator.
    expect(fixture.componentInstance.tokens().map((t) => t.label)).toEqual([
      'Bravo',
      'Charlie',
    ]);
    expect(labels()).toEqual(['Bravo', 'Charlie']);

    // The discriminator: each surviving token kept the row built for it.
    // Under `track token.value` this is ['row0', 'row1'] — Bravo's content has
    // slid onto Alpha's row and Charlie's row has been destroyed.
    expect(renderedElementIds()).toEqual(['row1', 'row2']);
    expect(renderedInstanceIds()).toEqual(['row1', 'row2']);
    expect(rowAlpha.isConnected).toBe(false);
    expect(rowCharlie.isConnected).toBe(true);
  });

  it('keeps DOM focus on a later duplicate when an earlier one is removed', async () => {
    tagRows();
    const rowAlpha = tokenEls()[0];
    const rowCharlie = tokenEls()[2];

    rowCharlie.focus();
    expect(document.activeElement === rowCharlie).toBe(true);

    // Removing an *earlier* token must not disturb the focused one. The chip
    // close handler calls stopPropagation, so the container's click-to-focus
    // handler does not fire and nothing else moves focus.
    closeButton(rowAlpha).click();
    await flush();

    // Under `track token.value` Charlie's row is the one destroyed, so focus
    // falls out of the widget entirely.
    expect(rowCharlie.isConnected).toBe(true);
    expect(document.activeElement === rowCharlie).toBe(true);
  });

  it('lands the roving tabindex on a surviving token’s own row', async () => {
    tagRows();
    const rowAlpha = tokenEls()[0];

    closeButton(rowAlpha).click();
    await flush();

    // `_syncTokenTabIndices(0)` re-seats the tab stop on the first *surviving*
    // row. Under `track token.value` that row is the one built for the removed
    // Alpha, so the tab stop sits on a row whose token is gone.
    const tabbable = tokenEls().filter(
      (el) => el.getAttribute('tabindex') === '0',
    );
    expect(tabbable.length).toBe(1);
    expect(rowIds.get(tabbable[0])).toBe('row1');
    expect(
      tabbable[0].querySelector('.mlv-chip__label')?.textContent?.trim(),
    ).toBe('Bravo');
  });

  it('arms the last token on its own row after an earlier duplicate is removed', async () => {
    tagRows();
    const rowAlpha = tokenEls()[0];

    closeButton(rowAlpha).click();
    await flush();

    // `_isTokenArmed` compares against `_lastToken()`, so arming always targets
    // the final token — Charlie. The question is which *row* carries it.
    inputKey('Backspace');
    await flush();

    const armed = tokenEls().filter((el) =>
      el.classList.contains('mlv-token--armed'),
    );
    expect(armed.length).toBe(1);
    expect(
      armed[0].querySelector('.mlv-chip__label')?.textContent?.trim(),
    ).toBe('Charlie');
    // Under `track token.value` the armed marker lands on 'row1' — the row
    // built for Bravo — because Charlie's row no longer exists.
    expect(rowIds.get(armed[0])).toBe('row2');
  });

  it('does not warn about duplicated track keys (NG0955)', async () => {
    tagRows();
    const rowAlpha = tokenEls()[0];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      // The warning is raised from the reconciler, so it needs a collection
      // *change* — the initial render walks no live rows and reports nothing.
      closeButton(rowAlpha).click();
      await flush();

      const duplicateKeyWarnings = warn.mock.calls
        .map(([first]) => (typeof first === 'string' ? first : ''))
        .filter((m) => m.includes('NG0955') || m.includes('duplicated keys'));
      expect(duplicateKeyWarnings).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('gives every token added through allowDuplicates its own row', async () => {
    // The canonical duplicate: same label *and* same value, so nothing but
    // object identity distinguishes the three rows. `createToken` returns a
    // fresh object per call, which is what makes reference tracking work.
    fixture.componentInstance.tokens.set([]);
    await flush();

    for (let i = 0; i < 3; i++) {
      nativeInput().value = 'dup';
      inputKey('Enter');
      await flush();
    }

    expect(labels()).toEqual(['dup', 'dup', 'dup']);
    const added = fixture.componentInstance.tokens();
    expect(added.length).toBe(3);
    expect(added[0] === added[1]).toBe(false);
    expect(added[1] === added[2]).toBe(false);

    tagRows();
    closeButton(tokenEls()[0]).click();
    await flush();

    expect(labels()).toEqual(['dup', 'dup']);
    expect(renderedElementIds()).toEqual(['row1', 'row2']);
    expect(renderedInstanceIds()).toEqual(['row1', 'row2']);
  });
});

import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { By } from '@angular/platform-browser';
import { MlvTokenizer } from './tokenizer';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

@Component({
  template: `<mlv-tokenizer />`,
  imports: [MlvTokenizer],
})
class TestHostComponent {}

@Component({
  template: `<mlv-tokenizer [(tokens)]="tokens" />`,
  imports: [MlvTokenizer],
})
class TokensHostComponent {
  readonly tokens = signal<MlvSelectOption<string>[]>([
    { label: 'React', value: 'react' },
    { label: 'Angular', value: 'angular' },
    { label: 'Vue', value: 'vue' },
  ]);
}

describe('MlvTokenizer', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-tokenizer');
    expect(el).toBeTruthy();
  });
});

describe('MlvTokenizer — token semantics', () => {
  let fixture: ComponentFixture<TokensHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokensHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TokensHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the tokens inside a role="list" container', () => {
    const list = fixture.nativeElement.querySelector(
      '.mlv-tokenizer__token-list',
    );
    expect(list?.getAttribute('role')).toBe('list');
    // The text input must not be inside the list role.
    expect(list?.querySelector('mlv-input')).toBeNull();
  });

  it('labels the token list via the i18n selectedItems string when no label is set', () => {
    const list = fixture.nativeElement.querySelector(
      '.mlv-tokenizer__token-list',
    );
    // Resolved through MLV_TOKENIZER_I18N (en pack), not a hard-coded literal.
    expect(list?.getAttribute('aria-label')).toBe('Selected items');
  });

  it('marks each token as a labelled listitem without bogus aria-selected', () => {
    const tokens = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-token'),
    );
    expect(tokens.length).toBe(3);
    tokens.forEach((t) => {
      expect(t.getAttribute('role')).toBe('listitem');
      expect(t.getAttribute('aria-selected')).toBeNull();
    });
    expect(tokens[0].getAttribute('aria-label')).toBe('React');
  });

  it('keeps a single token in the tab order (roving tabindex)', () => {
    const tokens = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-token'),
    );
    const tabbable = tokens.filter((t) => t.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
    expect(tokens[0].getAttribute('tabindex')).toBe('0');
    expect(tokens[1].getAttribute('tabindex')).toBe('-1');
  });

  it('removes the focused token on Backspace', () => {
    const tokens = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-token'),
    );
    tokens[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.tokens().map((t) => t.value)).toEqual([
      'react',
      'vue',
    ]);
  });
});

describe('MlvTokenizer — Backspace chip-selection flow', () => {
  let fixture: ComponentFixture<TokensHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokensHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TokensHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** The tokenizer's native text input element. */
  const nativeInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input.mlv-input__native');

  /** Dispatch a bubbling keydown on the text input. */
  const inputKey = (key: string): void => {
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
  };

  /** The rendered token hosts. */
  const tokenEls = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mlv-token'));

  /** The token host currently marked armed, if any. */
  const armedEl = (): HTMLElement | undefined =>
    tokenEls().find((t) => t.classList.contains('mlv-token--armed'));

  /** Values in the token collection. */
  const values = (): unknown[] =>
    fixture.componentInstance.tokens().map((t) => t.value);

  it('arms (does not remove) the last chip on the first empty-input Backspace', () => {
    inputKey('Backspace');

    // No deletion on the arming press.
    expect(values()).toEqual(['react', 'angular', 'vue']);

    // Last chip is armed and rendered with the chip `primary` tone.
    const armed = armedEl();
    expect(armed).toBeTruthy();
    expect(armed?.getAttribute('aria-label')).toBe('Vue');
    expect(
      armed
        ?.querySelector('.mlv-chip')
        ?.classList.contains('mlv-chip--tone-primary'),
    ).toBe(true);
    // Exactly one chip armed.
    expect(
      tokenEls().filter((t) => t.classList.contains('mlv-token--armed')).length,
    ).toBe(1);
  });

  it('removes the armed chip and re-arms the new last chip on the second Backspace', () => {
    inputKey('Backspace'); // arm 'vue'
    inputKey('Backspace'); // remove 'vue', arm 'angular'

    expect(values()).toEqual(['react', 'angular']);
    expect(armedEl()?.getAttribute('aria-label')).toBe('Angular');
  });

  it('walks-and-deletes from the end, one deletion per press, then disarms when empty', () => {
    inputKey('Backspace'); // arm 'vue'
    inputKey('Backspace'); // -> [react, angular], arm 'angular'
    inputKey('Backspace'); // -> [react], arm 'react'
    inputKey('Backspace'); // -> [], disarmed

    expect(values()).toEqual([]);
    expect(armedEl()).toBeUndefined();
    // Input remains present/focusable after clearing all tokens.
    expect(nativeInput()).toBeTruthy();
  });

  it('disarms when the user types a character', () => {
    inputKey('Backspace');
    expect(armedEl()).toBeTruthy();

    nativeInput().value = 'x';
    nativeInput().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(armedEl()).toBeUndefined();
    expect(values()).toEqual(['react', 'angular', 'vue']);
  });

  it('disarms on caret movement (ArrowLeft) without disturbing token navigation', () => {
    inputKey('Backspace');
    expect(armedEl()).toBeTruthy();

    inputKey('ArrowLeft');

    expect(armedEl()).toBeUndefined();
    // Roving tabindex across tokens is unchanged (still exactly one tabbable).
    const tabbable = tokenEls().filter(
      (t) => t.getAttribute('tabindex') === '0',
    );
    expect(tabbable.length).toBe(1);
  });

  it('disarms on blur', () => {
    inputKey('Backspace');
    expect(armedEl()).toBeTruthy();

    nativeInput().dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(armedEl()).toBeUndefined();
  });

  it('removes the armed chip on Delete (parity with Backspace)', () => {
    inputKey('Backspace'); // arm 'vue'
    inputKey('Delete'); // remove 'vue', arm 'angular'

    expect(values()).toEqual(['react', 'angular']);
    expect(armedEl()?.getAttribute('aria-label')).toBe('Angular');
  });

  it('does not act on Delete when nothing is armed', () => {
    inputKey('Delete');
    expect(values()).toEqual(['react', 'angular', 'vue']);
    expect(armedEl()).toBeUndefined();
  });

  it('disarms when the forms value is replaced', () => {
    inputKey('Backspace');
    expect(armedEl()).toBeTruthy();

    const cmp = fixture.debugElement.query(By.directive(MlvTokenizer))
      .componentInstance as MlvTokenizer<string>;
    cmp.value.set([{ label: 'Svelte', value: 'svelte' }]);
    fixture.detectChanges();

    expect(armedEl()).toBeUndefined();
  });

  it('announces the armed token via a polite live region (SR communication)', () => {
    const live = fixture.nativeElement.querySelector(
      '.mlv-tokenizer__sr',
    ) as HTMLElement;
    expect(live).toBeTruthy();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent?.trim()).toBe('');

    inputKey('Backspace');
    expect(live.textContent?.trim()).toBe('Vue');

    inputKey('ArrowLeft'); // disarm
    expect(live.textContent?.trim()).toBe('');
  });
});

type Token = MlvSelectOption<string>;

const seed = (): Token[] => [
  { label: 'React', value: 'react' },
  { label: 'Angular', value: 'angular' },
];

@Component({
  template: `<mlv-tokenizer
    [value]="value()"
    (valueChange)="onValue($event)"
  />`,
  imports: [MlvTokenizer],
})
class ValueOnlyHostComponent {
  readonly value = signal<Token[]>(seed());
  readonly valueEmissions: Token[][] = [];

  onValue(next: Token[]): void {
    this.valueEmissions.push(next);
    this.value.set(next);
  }
}

@Component({
  template: `<mlv-tokenizer
    [tokens]="tokens()"
    (tokensChange)="onTokens($event)"
  />`,
  imports: [MlvTokenizer],
})
class TokensOnlyHostComponent {
  readonly tokens = signal<Token[]>(seed());
  readonly tokensEmissions: Token[][] = [];

  onTokens(next: Token[]): void {
    this.tokensEmissions.push(next);
    this.tokens.set(next);
  }
}

@Component({
  template: `<mlv-tokenizer
    [value]="shared()"
    (valueChange)="onValue($event)"
    [tokens]="shared()"
    (tokensChange)="onTokens($event)"
  />`,
  imports: [MlvTokenizer],
})
class BothBoundHostComponent {
  readonly shared = signal<Token[]>(seed());
  readonly valueEmissions: Token[][] = [];
  readonly tokensEmissions: Token[][] = [];

  onValue(next: Token[]): void {
    this.valueEmissions.push(next);
    this.shared.set(next);
  }

  onTokens(next: Token[]): void {
    this.tokensEmissions.push(next);
    this.shared.set(next);
  }
}

describe('MlvTokenizer — value/tokens alias sync', () => {
  /** Labels of the rendered chips, in DOM order. */
  const labels = (fixture: ComponentFixture<unknown>): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('mlv-token .mlv-chip__label'),
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');

  /** The tokenizer instance rendered by the host. */
  const tokenizer = (
    fixture: ComponentFixture<unknown>,
  ): MlvTokenizer<string> =>
    fixture.debugElement.query(By.directive(MlvTokenizer))
      .componentInstance as MlvTokenizer<string>;

  async function setup<H>(host: new () => H): Promise<ComponentFixture<H>> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('keeps seeded tokens when only [value] is bound', async () => {
    const fixture = await setup(ValueOnlyHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    expect(host.value().map((t) => t.value)).toEqual(['react', 'angular']);
    expect(cmp.value().map((t) => t.value)).toEqual(['react', 'angular']);
    // The unbound alias adopts the bound side rather than clobbering it.
    expect(cmp.tokens()).toBe(cmp.value());
    expect(labels(fixture)).toEqual(['React', 'Angular']);
    // Nothing is staged back to the consumer on first render.
    expect(host.valueEmissions).toEqual([]);
  });

  it('keeps seeded tokens when only [tokens] is bound', async () => {
    const fixture = await setup(TokensOnlyHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    expect(host.tokens().map((t) => t.value)).toEqual(['react', 'angular']);
    expect(cmp.tokens().map((t) => t.value)).toEqual(['react', 'angular']);
    expect(cmp.value()).toBe(cmp.tokens());
    expect(labels(fixture)).toEqual(['React', 'Angular']);
    expect(host.tokensEmissions).toEqual([]);
  });

  it('keeps seeded tokens when both [value] and [tokens] are bound', async () => {
    const fixture = await setup(BothBoundHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    expect(host.shared().map((t) => t.value)).toEqual(['react', 'angular']);
    expect(cmp.value()).toBe(cmp.tokens());
    expect(labels(fixture)).toEqual(['React', 'Angular']);
    expect(host.valueEmissions).toEqual([]);
    expect(host.tokensEmissions).toEqual([]);
  });

  it('propagates a later [value]-only write to the tokens alias', async () => {
    const fixture = await setup(ValueOnlyHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    host.value.set([{ label: 'Vue', value: 'vue' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cmp.tokens().map((t) => t.value)).toEqual(['vue']);
    expect(labels(fixture)).toEqual(['Vue']);
  });

  it('propagates a later [tokens]-only write to the value alias', async () => {
    const fixture = await setup(TokensOnlyHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    host.tokens.set([{ label: 'Vue', value: 'vue' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cmp.value().map((t) => t.value)).toEqual(['vue']);
    expect(labels(fixture)).toEqual(['Vue']);
  });

  it('emits an internal removal to whichever side the consumer bound', async () => {
    const fixture = await setup(ValueOnlyHostComponent);
    const host = fixture.componentInstance;
    const cmp = tokenizer(fixture);

    cmp.removeToken(cmp.value()[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.valueEmissions.length).toBe(1);
    expect(host.value().map((t) => t.value)).toEqual(['angular']);
    expect(cmp.tokens().map((t) => t.value)).toEqual(['angular']);
    expect(labels(fixture)).toEqual(['Angular']);
  });
});

// ─── Scoped [dir] keyboard mirroring (#147) ──────────────────────────────────

@Component({
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-tokenizer [(tokens)]="tokens" />
    </div>
  `,
  imports: [MlvTokenizer],
})
class ScopedTokenizerHostComponent {
  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
  readonly tokens = signal<MlvSelectOption<string>[]>([
    { label: 'React', value: 'react' },
    { label: 'Angular', value: 'angular' },
    { label: 'Vue', value: 'vue' },
  ]);
}

describe('MlvTokenizer — scoped [dir] keyboard mirroring', () => {
  let fixture: ComponentFixture<ScopedTokenizerHostComponent>;
  let rtlService: MlvRtlService;

  const KEY = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40 } as const;

  /** Dispatches a keydown carrying a `keyCode` (CDK's FocusKeyManager reads it). */
  function dispatchKey(
    element: HTMLElement,
    key: string,
    keyCode: number,
  ): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    element.dispatchEvent(event);
  }

  function tokens(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-token'),
    );
  }

  async function build(dir: 'ltr' | 'rtl'): Promise<HTMLElement[]> {
    fixture = TestBed.createComponent(ScopedTokenizerHostComponent);
    fixture.componentInstance.scopeDir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return tokens();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedTokenizerHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /**
   * The roving tabindex the manager publishes through `_syncTokenTabIndices`.
   * Asserted instead of `document.activeElement` because `MlvToken.focus()`
   * focuses an inner control, not the `<mlv-token>` host this reads.
   */
  function tabbableIndex(els: HTMLElement[]): number {
    return els.findIndex((t) => t.getAttribute('tabindex') === '0');
  }

  /**
   * Nothing activates the key manager on focus, so it starts at index -1 and
   * the first arrow of any kind lands on index 0. Absorb that hop here so each
   * test's own assertion is about direction, not about the entry step.
   */
  function activateFirst(els: HTMLElement[], key: string, code: number): void {
    dispatchKey(els[0], key, code);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(0);
  }

  it('mirrors token stepping inside a [dir="rtl"] subtree while the document stays LTR', async () => {
    const els = await build('rtl');
    expect(rtlService.direction()).toBe('ltr');
    expect(els.length).toBe(3);
    activateFirst(els, 'ArrowLeft', KEY.ArrowLeft);

    // ArrowLeft is "next" once the tokens are laid out right-to-left…
    dispatchKey(els[0], 'ArrowLeft', KEY.ArrowLeft);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(1);

    // …and ArrowRight is "previous", wrapping back past the first token.
    dispatchKey(els[1], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(0);
  });

  it('keeps token stepping unmirrored in an LTR island while the document is RTL', async () => {
    rtlService.setDirection('rtl');
    const els = await build('ltr');
    activateFirst(els, 'ArrowRight', KEY.ArrowRight);

    dispatchKey(els[0], 'ArrowRight', KEY.ArrowRight);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(1);

    dispatchKey(els[1], 'ArrowLeft', KEY.ArrowLeft);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(0);
  });

  it('leaves the block axis unmirrored in the same scope', async () => {
    const els = await build('rtl');
    activateFirst(els, 'ArrowLeft', KEY.ArrowLeft);

    // CDK's `ListKeyManager` keeps vertical navigation enabled alongside a
    // horizontal orientation; the point is that it keeps its LTR meaning.
    dispatchKey(els[0], 'ArrowDown', KEY.ArrowDown);
    fixture.detectChanges();
    expect(tabbableIndex(els)).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Bulk entry: `splitFn` + Enter                                              */
/* -------------------------------------------------------------------------- */

/**
 * A `MlvSelectOption` whose `value` getter counts how many times the add path
 * inspected it. Nothing but the dedupe inside `onInputEnter` reads these
 * between a counter reset and the sample that follows, so the count is exactly
 * the number of value inspections the add path performed.
 */
function countingOption(
  label: string,
  value: string,
  counter: { reads: number },
): MlvSelectOption<string> {
  return {
    label,
    get value(): string {
      counter.reads++;
      return value;
    },
  };
}

/**
 * A batch long enough that, against the twenty existing tokens these specs
 * seed, a run of misses pays for an index part-way through it. The exchange
 * rate that decides when is a private performance knob — these specs never
 * name it, only ever standing certainly on one side of it.
 */
const LARGE_BATCH = 40;

@Component({
  template: `<mlv-tokenizer
    [(tokens)]="tokens"
    [splitFn]="splitFn"
    [createToken]="createToken()"
    [allowDuplicates]="allowDuplicates()"
  />`,
  imports: [MlvTokenizer],
})
class BulkEntryHostComponent {
  readonly tokens = signal<MlvSelectOption<string>[]>([]);
  readonly allowDuplicates = signal(false);
  readonly splitFn = (value: string): string[] => value.split(',');
  readonly createToken = signal<(value: string) => MlvSelectOption<string>>(
    (value) => ({ label: value, value }),
  );
}

/**
 * **Regression guards.** Every expectation in this block fails on the code this
 * change replaces, and the comment on each one says with what number — bar the
 * last, which matches that code exactly and guards the *shape* of the switch
 * instead. The cost is observed rather than timed: `countingOption` makes each
 * inspection of a token's `value` observable, so the assertions are exact
 * counts, not thresholds, and they cannot go quiet on a fast machine.
 *
 * What a read count can and cannot see. A scan reads one token per comparison
 * it makes, so counting reads measures the scan arm's cost exactly. It is
 * blind to the other arm's: an index costs a `Map` insertion per token walked,
 * roughly eighteen times a bare `===`, and no counter here can tell a walk
 * from a scan. So these specs deliberately do **not** pin the exchange rate
 * between the two, and nothing should — it is a speed knob, both arms answer
 * the same question the same way, and a spec that fixed it would go red the
 * next time it is re-measured on a newer V8.
 *
 * What they pin instead is the *shape* of the switch, which is what a read
 * count can see: that a batch whose values keep matching near the head is
 * never indexed however long it is, and that a batch of misses stops
 * accumulating reads once it does index. Between them those bracket the
 * constant — every value from 2 to 19 leaves all of these green, 0 and 1 fail
 * the head-matching guard (they index a batch that never ran a full scan), and
 * 20 and above fail the miss guard, where the forty-value batch stops indexing
 * at all and its reads go back to the k x n of the loop this replaces — and
 * none of them names it.
 */
describe('MlvTokenizer — bulk entry dedupe cost', () => {
  let fixture: ComponentFixture<BulkEntryHostComponent>;
  let host: BulkEntryHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkEntryHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkEntryHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** The tokenizer's native text input element. */
  const nativeInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input.mlv-input__native');

  /** Types `raw` into the text input and commits it with Enter. */
  const commit = (raw: string): void => {
    nativeInput().value = raw;
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  };

  /** Current token values, in order. */
  const values = (): string[] => host.tokens().map((t) => t.value);

  /** Seeds `n` counting tokens and returns the shared read counter. */
  const seedCounting = async (n: number): Promise<{ reads: number }> => {
    const counter = { reads: 0 };
    host.tokens.set(
      Array.from({ length: n }, (_, i) =>
        countingOption(`Existing ${i}`, `existing-${i}`, counter),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    // Rendering the chips reads `value` for the `@for` track expression, so the
    // counter is zeroed after the render and sampled before anything else
    // touches the collection.
    counter.reads = 0;
    return counter;
  };

  it('stops reading the existing tokens once enough values have missed', async () => {
    const counter = await seedCounting(20);

    commit(Array.from({ length: LARGE_BATCH }, (_, i) => `new-${i}`).join(','));
    const forty = counter.reads;
    await fixture.whenStable();

    // Non-vacuity: every value really was added, after the twenty existing.
    expect(host.tokens().length).toBe(20 + LARGE_BATCH);
    expect(values().slice(20, 23)).toEqual(['new-0', 'new-1', 'new-2']);

    // A five-fold larger batch of the same shape, against the same twenty.
    const counter2 = await seedCounting(20);
    commit(
      Array.from({ length: LARGE_BATCH * 5 }, (_, i) => `other-${i}`).join(','),
    );
    const twoHundred = counter2.reads;
    await fixture.whenStable();

    expect(host.tokens().length).toBe(20 + LARGE_BATCH * 5);

    // Bound: the reads stop accruing at the switch, so the two batches cost
    // the *same* — the misses before the switch scan all twenty each, the
    // value that trips it walks the twenty once more, and every value after
    // that is answered from the index for nothing. The replaced loop rescanned
    // `current` per value and, because none of these collide, ran every scan
    // to completion: k x n, so 40 x 20 = 800 and 200 x 20 = 4000.
    expect(forty).toBe(twoHundred);
    expect(forty).toBeLessThan(800);
  });

  it('stops at the first match instead of indexing the whole collection', async () => {
    const counter = await seedCounting(20);

    commit('existing-0,existing-0');
    const reads = counter.reads;
    await fixture.whenStable();

    // Non-vacuity: both values were recognised as duplicates and dropped.
    expect(host.tokens().length).toBe(20);

    // Bound: two values, each answered at the first token the scan touches.
    // Building a 20-entry index up front to answer them would read all 20 —
    // strictly more work than the two comparisons it replaced, and the reason
    // an entry starts on the short-circuiting scan rather than an index.
    expect(reads).toBe(2);
  });

  it('checks each pasted value against the batch in constant time', async () => {
    // Counting tokens are produced by `createToken` here, so the reads measure
    // the within-batch half of the dedupe against an empty collection.
    const counter = { reads: 0 };
    host.createToken.set((value) => countingOption(value, value, counter));
    fixture.detectChanges();
    await fixture.whenStable();

    counter.reads = 0;
    commit(Array.from({ length: LARGE_BATCH }, (_, i) => `v${i}`).join(','));
    const reads = counter.reads;
    await fixture.whenStable();

    // Non-vacuity: every distinct value landed, in input order.
    expect(values().length).toBe(LARGE_BATCH);
    expect(values().slice(0, 3)).toEqual(['v0', 'v1', 'v2']);

    // Bound: each created token's value is read once and tested against a set
    // the loop fills as it goes — k = 40. The replaced loop rescanned the
    // accepted tokens per value, reading both sides of every comparison:
    // 2 x sum(i - 1) for i = 1..40 = 2 x 780 = 1560.
    expect(reads).toBe(LARGE_BATCH);
  });

  it('never consults the existing tokens when duplicates are allowed', async () => {
    host.allowDuplicates.set(true);
    fixture.detectChanges();
    const counter = await seedCounting(20);

    commit(Array.from({ length: LARGE_BATCH }, () => 'existing-0').join(','));
    const reads = counter.reads;
    await fixture.whenStable();

    // Non-vacuity: forty copies of an existing value all landed.
    expect(host.tokens().length).toBe(20 + LARGE_BATCH);
    expect(values().slice(20, 22)).toEqual(['existing-0', 'existing-0']);

    // Bound: zero. `allowDuplicates` skips the whole dedupe, so neither arm of
    // the switch runs and no index is built for a batch of any size — the
    // large-batch half of "check the dedupe against both settings". The
    // replaced loop computed `isDuplicate` before consulting `allowDuplicates`
    // and so scanned anyway, matching at the head every time: k = 40.
    expect(reads).toBe(0);
  });

  it('does not index a batch that keeps matching, however large', async () => {
    const counter = await seedCounting(20);

    // Forty values that all match the *first* existing token, then one that
    // matches nothing.
    commit(
      [
        ...Array.from({ length: LARGE_BATCH }, () => 'existing-0'),
        'brand-new',
      ].join(','),
    );
    const reads = counter.reads;
    await fixture.whenStable();

    // Non-vacuity: only the new value was added.
    expect(host.tokens().length).toBe(21);
    expect(values()[20]).toBe('brand-new');

    // Bound: forty scans that stop at the first token, plus one that runs the
    // full twenty — 40 + 20 = 60. This is what the loop this change replaces
    // costs too, and that is the point: gating on `values.length` would index
    // here instead (1 read to reach the head match, then 19 to finish the walk
    // for the miss = 20 reads) and pay a `Map` insertion per token to save
    // thirty-nine comparisons. This expectation is the guard on the *shape* of
    // the switch, not on any threshold value.
    expect(reads).toBe(60);
  });
});

/**
 * **Preserved behaviour.** Everything below passes on the code this change
 * replaces as well — it is characterisation, pinning what the rewrite must not
 * alter, not evidence that the rewrite happened. The exception is called out on
 * the one test that is also a mutation guard.
 */
describe('MlvTokenizer — bulk entry dedupe behaviour', () => {
  let fixture: ComponentFixture<BulkEntryHostComponent>;
  let host: BulkEntryHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkEntryHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkEntryHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const nativeInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input.mlv-input__native');

  const commit = (raw: string): void => {
    nativeInput().value = raw;
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  };

  const values = (): string[] => host.tokens().map((t) => t.value);

  it('calls createToken exactly once per value, in order, duplicates included', async () => {
    host.tokens.set([{ label: 'a', value: 'a' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const calls: string[] = [];
    host.createToken.set((value) => {
      calls.push(value);
      return { label: value, value };
    });
    fixture.detectChanges();
    await fixture.whenStable();

    commit('a,b,b,c');
    await fixture.whenStable();

    // `createToken` is consumer-supplied and may be impure, so it must still
    // run for every value — including the ones the dedupe then discards.
    expect(calls).toEqual(['a', 'b', 'b', 'c']);
    expect(values()).toEqual(['a', 'b', 'c']);
  });

  it('drops values that duplicate an existing token', async () => {
    host.tokens.set([
      { label: 'react', value: 'react' },
      { label: 'vue', value: 'vue' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit('react,svelte,vue,solid');
    await fixture.whenStable();

    expect(values()).toEqual(['react', 'vue', 'svelte', 'solid']);
  });

  it('drops values that duplicate an earlier value in the same batch', async () => {
    commit('a,b,a,c,b');
    await fixture.whenStable();

    expect(values()).toEqual(['a', 'b', 'c']);
  });

  it('collapses the smallest possible within-batch duplicate', async () => {
    // The within-batch half of the dedupe has to be live for a two-value entry,
    // not only for entries long enough to reach the index. Every other
    // within-batch case in this file is k >= 4, so a size condition that
    // switched the within-batch check off below some larger batch would pass
    // all of them and still lose this one.
    commit('a,a');
    await fixture.whenStable();

    expect(values()).toEqual(['a']);
  });

  it('dedupes a batch identically either side of the switch to the index', async () => {
    // The existing-token half has two implementations, and a long enough entry
    // runs both — it rescans until enough values have missed, then indexes.
    // They are only interchangeable if they agree, so the same content is run
    // through a batch short enough to stay on the scan and one long enough to
    // cross over: `pattern` repeats every three values, so each variant holds
    // the same three distinct values against the same one existing token.
    const pattern = (length: number) =>
      Array.from({ length }, (_, i) => ['a', 'b', 'c'][i % 3]).join(',');

    host.tokens.set([{ label: 'a', value: 'a' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit(pattern(6));
    await fixture.whenStable();
    expect(values()).toEqual(['a', 'b', 'c']);

    host.tokens.set([{ label: 'a', value: 'a' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit(pattern(LARGE_BATCH * 3));
    await fixture.whenStable();
    expect(values()).toEqual(['a', 'b', 'c']);
  });

  it('keeps every value, in order, when allowDuplicates is set', async () => {
    host.allowDuplicates.set(true);
    host.tokens.set([{ label: 'a', value: 'a' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit('a,b,a');
    await fixture.whenStable();

    expect(values()).toEqual(['a', 'a', 'b', 'a']);
  });

  it('adds nothing for an empty or separator-only entry', async () => {
    host.tokens.set([{ label: 'a', value: 'a' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const before = host.tokens();

    commit('   ');
    await fixture.whenStable();
    expect(host.tokens()).toBe(before);

    commit(', , ,');
    await fixture.whenStable();
    expect(host.tokens()).toBe(before);
  });

  it('leaves the collection untouched when every value is a duplicate', async () => {
    host.tokens.set([
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const before = host.tokens();

    commit('a,b,a');
    await fixture.whenStable();

    // Same array reference: nothing was committed, so no downstream form write.
    expect(host.tokens()).toBe(before);
    expect(nativeInput().value).toBe('');
  });

  it('preserves input order across the accepted values', async () => {
    commit('delta,alpha,charlie,bravo');
    await fixture.whenStable();

    expect(values()).toEqual(['delta', 'alpha', 'charlie', 'bravo']);
  });

  it('dedupes on the created value, not the raw text', async () => {
    host.createToken.set((value) => ({
      label: value,
      value: value.trim().toLowerCase(),
    }));
    host.tokens.set([{ label: 'React', value: 'react' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit('REACT,Vue,vue');
    await fixture.whenStable();

    expect(values()).toEqual(['react', 'vue']);
  });
});

type EmailToken = MlvSelectOption<{ email: string }>;

@Component({
  template: `<mlv-tokenizer
    [(tokens)]="tokens"
    [splitFn]="splitFn"
    [createToken]="createToken()"
  />`,
  imports: [MlvTokenizer],
})
class ObjectValueHostComponent {
  readonly tokens = signal<EmailToken[]>([]);
  readonly splitFn = (value: string): string[] => value.split(',');
  readonly createToken = signal<(value: string) => EmailToken>((value) => ({
    label: value,
    value: { email: value },
  }));
}

/**
 * **Preserved behaviour.** A non-primitive `T` is compared by reference, so a
 * `createToken` that mints a fresh object per call never dedupes — the docs app
 * ships exactly that shape (`apps/docs/src/app/pages/tokenizer/examples/4`,
 * `value: { email: value }`), and until now nothing pinned it.
 */
describe('MlvTokenizer — non-primitive token values', () => {
  let fixture: ComponentFixture<ObjectValueHostComponent>;
  let host: ObjectValueHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectValueHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectValueHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const commit = (raw: string): void => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input.mlv-input__native',
    );
    input.value = raw;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  };

  it('never dedupes a createToken that mints a fresh object per call', async () => {
    commit('a@x.io,a@x.io');
    await fixture.whenStable();

    expect(host.tokens().map((t) => t.value.email)).toEqual([
      'a@x.io',
      'a@x.io',
    ]);

    // …including against an already-committed token carrying an equal object.
    commit('a@x.io');
    await fixture.whenStable();
    expect(host.tokens().length).toBe(3);
  });

  it('dedupes when createToken returns the same reference', async () => {
    // Non-vacuity for the test above: reference equality is what decides, so a
    // `createToken` that hands back a stable reference does collapse. Nothing
    // about object values is inherently un-dedupable — it is the fresh literal
    // that makes every comparison false.
    const pool = new Map<string, { email: string }>();
    host.createToken.set((value) => {
      let identity = pool.get(value);
      if (!identity) {
        identity = { email: value };
        pool.set(value, identity);
      }
      return { label: value, value: identity };
    });
    fixture.detectChanges();
    await fixture.whenStable();

    commit('a@x.io,a@x.io');
    await fixture.whenStable();

    expect(host.tokens().map((t) => t.value.email)).toEqual(['a@x.io']);
  });
});

@Component({
  template: `<mlv-tokenizer
    [(tokens)]="tokens"
    [splitFn]="splitFn"
    [createToken]="createToken"
  />`,
  imports: [MlvTokenizer],
})
class NumericBulkEntryHostComponent {
  readonly tokens = signal<MlvSelectOption<number>[]>([]);
  readonly splitFn = (value: string): string[] => value.split(',');
  readonly createToken = (value: string): MlvSelectOption<number> => ({
    label: value,
    value: Number(value),
  });
}

/**
 * **Preserved behaviour**, and the reason the existing-token half is built on
 * `valueIndex` rather than a bare `Set`: token values are compared with `===`,
 * which `Set` / `Map` membership (SameValueZero) does not reproduce on `NaN`.
 * A numeric `createToken` mints `NaN` from any unparseable entry, so the
 * difference is reachable from a plain consumer. Both arms of the switch are
 * exercised — every one of these entries is long enough against its seed to
 * cross onto the index, and short entries stay on the scan — because they take
 * different code paths to the same answer.
 */
describe('MlvTokenizer — === over SameValueZero on token values', () => {
  let fixture: ComponentFixture<NumericBulkEntryHostComponent>;
  let host: NumericBulkEntryHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumericBulkEntryHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NumericBulkEntryHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const commit = (raw: string): void => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input.mlv-input__native',
    );
    input.value = raw;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  };

  const labels = (): string[] => host.tokens().map((t) => t.label);

  it('keeps repeated NaN within a small batch, as === does', async () => {
    commit('x,1,y');
    await fixture.whenStable();

    // `NaN === NaN` is false, so 'y' is not a duplicate of 'x'.
    expect(labels()).toEqual(['x', '1', 'y']);
  });

  it('keeps repeated NaN within a batch long enough to reach the index', async () => {
    // A seed to scan, so the entry crosses onto the index part-way through and
    // the later `NaN`s are queried against one. A hazard on the *querying*
    // side is answered pairwise per query, without disqualifying the index.
    host.tokens.set([{ label: 'seed', value: 999 }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const batch = Array.from({ length: LARGE_BATCH }, (_, i) =>
      i % 8 === 0 ? 'x' : String(i),
    );
    commit(batch.join(','));
    await fixture.whenStable();

    // Five 'x' entries, all NaN, all kept; the numbered ones dedupe normally.
    expect(labels().filter((l) => l === 'x').length).toBe(5);
    expect(host.tokens().length).toBe(1 + LARGE_BATCH);
  });

  it('keeps NaN against an existing NaN token, on either side of the switch', async () => {
    host.tokens.set([{ label: 'seed', value: Number.NaN }]);
    fixture.detectChanges();
    await fixture.whenStable();

    commit('x,2');
    await fixture.whenStable();
    expect(labels()).toEqual(['seed', 'x', '2']);

    // A batch with enough misses to reach the index: it then meets the NaN
    // while walking the existing tokens and must fall back rather than key on
    // it.
    commit(
      Array.from({ length: LARGE_BATCH }, (_, i) =>
        i === 0 ? 'y' : `1${i}`,
      ).join(','),
    );
    await fixture.whenStable();
    expect(labels().slice(0, 4)).toEqual(['seed', 'x', '2', 'y']);
  });

  it('still ties -0 with 0, as === does, on either side of the switch', async () => {
    host.tokens.set([{ label: 'zero', value: 0 }]);
    fixture.detectChanges();
    await fixture.whenStable();

    // Short entry: answered by the scan.
    commit('-0');
    await fixture.whenStable();
    expect(labels()).toEqual(['zero']);

    // Long entry with the `-0` *last*, so the index — built part-way through
    // the numbers ahead of it — is what answers it. `Map` keys are
    // SameValueZero, which agrees with `===` here: both call -0 a duplicate
    // of the existing 0.
    commit(
      [...Array.from({ length: LARGE_BATCH }, (_, i) => `2${i}`), '-0'].join(
        ',',
      ),
    );
    await fixture.whenStable();
    expect(labels()[1]).toBe('20');
    expect(labels().includes('-0')).toBe(false);
  });
});

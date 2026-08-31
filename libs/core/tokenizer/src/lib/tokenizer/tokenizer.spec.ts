import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
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

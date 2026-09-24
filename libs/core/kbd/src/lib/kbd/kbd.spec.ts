import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';
import { MlvKbd } from './kbd';

/**
 * Makes `isMacPlatform()` answer `true` for components created after the call.
 * The OS is read once, in a field initializer, so this must run before
 * `TestBed.createComponent`. Restored by `vi.restoreAllMocks()`.
 */
function emulateMac(): void {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
}

/**
 * The text a screen reader reads out of `root`: every text node outside an
 * `aria-hidden="true"` subtree, in document order, whitespace collapsed. A
 * visually hidden node counts — it is clipped, not hidden from the tree.
 */
function readableText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[aria-hidden="true"]')) {
      parts.push(node.textContent ?? '');
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** Visible label of every key cap, in order. */
function keyCaps(root: Element): string[] {
  return [...root.querySelectorAll('kbd.mlv-kbd__key')].map(
    (el) => el.textContent?.trim() ?? '',
  );
}

describe('MlvKbd', () => {
  let fixture: ComponentFixture<MlvKbd>;

  function create(keys: string[], separator = '+'): HTMLElement {
    fixture = TestBed.createComponent(MlvKbd);
    fixture.componentRef.setInput('keys', keys);
    fixture.componentRef.setInput('separator', separator);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvKbd],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should create', () => {
    create(['cmd', 'k']);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders one <kbd> element per key', () => {
    create(['ctrl', 'shift', 'z']);
    const keyEls = fixture.nativeElement.querySelectorAll('kbd.mlv-kbd__key');
    expect(keyEls.length).toBe(3);
  });

  it('renders separators between keys', () => {
    create(['ctrl', 'k']);
    const seps = fixture.nativeElement.querySelectorAll('.mlv-kbd__separator');
    expect(seps.length).toBe(1);
    expect(seps[0].textContent.trim()).toBe('+');
  });

  it('respects a custom separator', () => {
    create(['ctrl', 'k'], '–');
    const sep = fixture.nativeElement.querySelector('.mlv-kbd__separator');
    expect(sep.textContent.trim()).toBe('–');
  });

  it('uppercases plain characters', () => {
    create(['a', 'b']);
    const keyEls = fixture.nativeElement.querySelectorAll('kbd.mlv-kbd__key');
    expect(keyEls[0].textContent.trim()).toBe('A');
    expect(keyEls[1].textContent.trim()).toBe('B');
  });

  it('renders no separators for a single key', () => {
    create(['escape']);
    const seps = fixture.nativeElement.querySelectorAll('.mlv-kbd__separator');
    expect(seps.length).toBe(0);
  });

  describe('screen-reader text (#331)', () => {
    // `aria-label` is prohibited on a role-less (generic) element in ARIA 1.2,
    // so the host must not carry one. The shortcut is read from a visually
    // hidden text node spelled with key names instead, and the visible key
    // caps and separators are hidden from assistive tech so nothing is read
    // twice or glyph by glyph.

    it('puts no aria-label on its role-less host', () => {
      const host = create(['ctrl', 'k']);
      expect(host.getAttribute('role')).toBeNull();
      expect(host.hasAttribute('aria-label')).toBe(false);
    });

    it('hides every key cap and separator from assistive tech', () => {
      const host = create(['ctrl', 'shift', 'z']);
      const caps = [...host.querySelectorAll('kbd.mlv-kbd__key')];
      const seps = [...host.querySelectorAll('.mlv-kbd__separator')];
      expect(caps.map((el) => el.getAttribute('aria-hidden'))).toEqual([
        'true',
        'true',
        'true',
      ]);
      expect(seps.map((el) => el.getAttribute('aria-hidden'))).toEqual([
        'true',
        'true',
      ]);
    });

    it('reads key names, joined by the separator, on Windows / Linux', () => {
      const host = create(['cmd', 'k']);
      expect(keyCaps(host)).toEqual(['Ctrl', 'K']);
      expect(readableText(host)).toBe('Control + K');
      expect(host.querySelector('.cdk-visually-hidden')?.textContent).toBe(
        'Control + K',
      );
    });

    it('reads key names instead of the modifier glyphs on macOS', () => {
      emulateMac();
      const host = create(['cmd', 'shift', 'k']);
      expect(keyCaps(host)).toEqual(['⌘', '⇧', 'K']);
      expect(readableText(host)).toBe('Command + Shift + K');
    });

    it('names every glyph-only key on macOS by the name its keyboard uses', () => {
      emulateMac();
      const host = create([
        'ctrl',
        'alt',
        'enter',
        'backspace',
        'delete',
        'escape',
        'tab',
        'space',
        'up',
        'down',
        'left',
        'right',
        'pageup',
        'pagedown',
      ]);
      expect(keyCaps(host)).toEqual([
        '⌃',
        '⌥',
        '↵',
        '⌫',
        '⌦',
        '⎋',
        '⇥',
        '␣',
        '↑',
        '↓',
        '←',
        '→',
        'PgUp',
        'PgDn',
      ]);
      expect(readableText(host)).toBe(
        'Control + Option + Return + Delete + Forward Delete + Escape + Tab + ' +
          'Space + Up Arrow + Down Arrow + Left Arrow + Right Arrow + ' +
          'Page Up + Page Down',
      );
    });

    it('expands the abbreviated Windows / Linux labels', () => {
      const host = create([
        'meta',
        'alt',
        'enter',
        'backspace',
        'delete',
        'esc',
        'up',
        'pageup',
      ]);
      expect(keyCaps(host)).toEqual([
        'Win',
        'Alt',
        'Enter',
        'Backspace',
        'Del',
        'Esc',
        '↑',
        'PgUp',
      ]);
      expect(readableText(host)).toBe(
        'Windows + Alt + Enter + Backspace + Delete + Escape + Up Arrow + Page Up',
      );
    });

    it('reads an unknown key as its visible label', () => {
      const host = create(['ctrl', 'f5', '/']);
      expect(readableText(host)).toBe('Control + F5 + /');
    });

    it.each([
      ['Windows / Linux', false],
      ['macOS', true],
    ])(
      'treats a key named after an Object.prototype member as a plain key on %s',
      (_platform, mac) => {
        if (mac) emulateMac();
        const host = create(['constructor', 'toString', '__proto__']);
        expect(keyCaps(host)).toEqual(['CONSTRUCTOR', 'TOSTRING', '__PROTO__']);
        expect(readableText(host)).toBe('CONSTRUCTOR + TOSTRING + __PROTO__');
      },
    );

    it('keeps the consumer separator in the spoken text', () => {
      const host = create(['ctrl', 'shift', 'p'], '–');
      expect(readableText(host)).toBe('Control – Shift – P');
    });

    it('follows a change of keys', async () => {
      const host = create(['ctrl', 'k']);
      fixture.componentRef.setInput('keys', ['escape']);
      await fixture.whenStable();
      expect(readableText(host)).toBe('Escape');
    });
  });
});

/**
 * Accessibility sweep.
 *
 * `mlv-kbd` renders one `aria-hidden` `<kbd>` per key with `aria-hidden`
 * separators between them, and the whole shortcut once, spelled with key names,
 * in a visually hidden text node — so it is read as one phrase ("Command + K")
 * rather than glyph by glyph, with no `aria-label` on the role-less host, where
 * ARIA 1.2 prohibits one. Single- and multi-key renders are swept, because the
 * separator element only exists from the second key on, and both key-label
 * tables are swept, because the macOS render is the glyph-only one.
 *
 * `aria-prohibited-attr` is asserted on `incomplete` too: axe reports an
 * `aria-label` on a generic element there, not under `violations`, so
 * `expectNoAxeViolations` alone passed over the old host label (#331).
 */
describe('MlvKbd accessibility', () => {
  @Component({
    imports: [MlvKbd],
    template: `
      <mlv-kbd [keys]="['cmd', 'k']" />
      <mlv-kbd [keys]="['ctrl', 'shift', 'z']" separator="–" />
      <mlv-kbd [keys]="['enter']" />
    `,
  })
  class KbdA11yHost {}

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['Windows / Linux', false, ['Control + K', 'Control – Shift – Z', 'Enter']],
    ['macOS', true, ['Command + K', 'Control – Shift – Z', 'Return']],
  ] as const)(
    'has no axe violations or prohibited attributes (%s)',
    async (_platform, mac, spoken) => {
      if (mac) emulateMac();
      await TestBed.configureTestingModule({
        imports: [KbdA11yHost],
      }).compileComponents();

      const fixture = TestBed.createComponent(KbdA11yHost);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;

      await expectNoAxeViolations(host);
      const results = await runAxe(host);
      expect(results.incomplete.map((r) => r.id)).not.toContain(
        'aria-prohibited-attr',
      );

      // State: six hidden `<kbd>` elements across three shortcuts, three
      // hidden separators, no host label, and one spoken phrase per shortcut.
      expect(
        host.querySelectorAll('kbd.mlv-kbd__key[aria-hidden="true"]'),
      ).toHaveLength(6);
      expect(
        host.querySelectorAll('.mlv-kbd__separator[aria-hidden="true"]'),
      ).toHaveLength(3);
      const kbds = [...host.querySelectorAll('mlv-kbd')];
      expect(kbds.map((el) => el.getAttribute('aria-label'))).toEqual([
        null,
        null,
        null,
      ]);
      expect(kbds.map((el) => readableText(el))).toEqual(spoken);
    },
  );
});

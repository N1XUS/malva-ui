import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvKbd } from './kbd';

describe('MlvKbd', () => {
  let fixture: ComponentFixture<MlvKbd>;

  function create(keys: string[], separator = '+'): void {
    fixture = TestBed.createComponent(MlvKbd);
    fixture.componentRef.setInput('keys', keys);
    fixture.componentRef.setInput('separator', separator);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvKbd],
    }).compileComponents();
  });

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

  it('sets aria-label on the host element', () => {
    create(['ctrl', 'k']);
    expect(fixture.nativeElement.getAttribute('aria-label')).toBeTruthy();
  });

  it('renders no separators for a single key', () => {
    create(['escape']);
    const seps = fixture.nativeElement.querySelectorAll('.mlv-kbd__separator');
    expect(seps.length).toBe(0);
  });
});

/**
 * Accessibility sweep.
 *
 * `mlv-kbd` renders one `<kbd>` per key with `aria-hidden` separators between
 * them, and puts the whole shortcut on the host as an `aria-label` so it is
 * announced as one phrase rather than glyph by glyph. Both the single-key and
 * the multi-key renders are swept, because the separator element only exists
 * from the second key on.
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

  it('has no axe violations for single- and multi-key shortcuts', async () => {
    await TestBed.configureTestingModule({
      imports: [KbdA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(KbdA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: six `<kbd>` elements across three shortcuts, three separators
    // hidden from assistive tech, and a non-empty label on every host.
    expect(host.querySelectorAll('kbd.mlv-kbd__key')).toHaveLength(6);
    expect(
      host.querySelectorAll('.mlv-kbd__separator[aria-hidden="true"]'),
    ).toHaveLength(3);
    expect(
      [...host.querySelectorAll('mlv-kbd')].every(
        (el) => (el.getAttribute('aria-label') ?? '').length > 0,
      ),
    ).toBe(true);

    await expectNoAxeViolations(host);
  });
});

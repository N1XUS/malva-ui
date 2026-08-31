import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
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

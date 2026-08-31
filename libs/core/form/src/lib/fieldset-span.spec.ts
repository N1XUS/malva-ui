import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvFieldsetSpan } from './fieldset-span';

@Component({
  imports: [MlvFieldsetSpan],
  template: `
    <div id="bound" [mlvFieldsetSpan]="span()"></div>
    <div id="static" mlvFieldsetSpan="full"></div>
    <div id="numeric-string" mlvFieldsetSpan="2"></div>
  `,
})
class Host {
  readonly span = signal<number | 'full'>(2);
}

describe('MlvFieldsetSpan', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('spans n columns for a number', async () => {
    const fixture = await render();
    const el = fixture.nativeElement.querySelector('#bound') as HTMLElement;
    expect(el.style.gridColumn).toBe('span 2');
  });

  it('spans the full row for "full" (static attribute)', async () => {
    const fixture = await render();
    const el = fixture.nativeElement.querySelector('#static') as HTMLElement;
    expect(el.style.gridColumn).toBe('1 / -1');
  });

  it('accepts a numeric string', async () => {
    const fixture = await render();
    const el = fixture.nativeElement.querySelector(
      '#numeric-string',
    ) as HTMLElement;
    expect(el.style.gridColumn).toBe('span 2');
  });

  it('updates when the bound value changes', async () => {
    const fixture = await render();
    fixture.componentInstance.span.set('full');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('#bound') as HTMLElement;
    expect(el.style.gridColumn).toBe('1 / -1');
  });
});

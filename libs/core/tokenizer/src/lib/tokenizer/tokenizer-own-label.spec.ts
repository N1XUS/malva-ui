import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTokenizer } from './tokenizer';

@Component({
  imports: [MlvTokenizer],
  template: `<mlv-tokenizer label="Recipients" [disabled]="disabled()" />`,
})
class OwnLabelHost {
  readonly disabled = signal(false);
}

/**
 * The same dangling-`for` shape as #216's five, in a state rather than a
 * component: `mlv-tokenizer` forwards `id` to an inner `mlv-input` that is only
 * rendered while the control is enabled, so a disabled tokenizer left its own
 * `<mlv-label [for]="id()">` pointing at an id no element carries.
 * `_externalLabelStrategy()` already reports `'none'` there.
 */
describe('MlvTokenizer — its own label while disabled (#216, adjacent)', () => {
  let fixture: ComponentFixture<OwnLabelHost>;

  async function render(disabled: boolean): Promise<HTMLElement> {
    fixture.componentInstance.disabled.set(disabled);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnLabelHost);
  });

  it('names the inner native <input> while enabled', async () => {
    const root = await render(false);
    const label = root.querySelector('mlv-label label') as HTMLLabelElement;
    const target = root.querySelector(
      `#${label.getAttribute('for')}`,
    ) as HTMLElement;

    expect(target.tagName).toBe('INPUT');
  });

  it('emits no `for` while disabled, when that input is not rendered', async () => {
    const root = await render(true);
    const label = root.querySelector('mlv-label label') as HTMLLabelElement;

    expect(root.querySelector('.mlv-tokenizer__input')).toBeNull();
    expect(label.hasAttribute('for')).toBe(false);
  });
});

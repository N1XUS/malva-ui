import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvCombobox } from './combobox';

@Component({
  imports: [MlvCombobox],
  template: `<mlv-combobox label="Tag" [options]="['One', 'Two']" />`,
})
class OwnLabelHost {}

/**
 * `mlv-combobox` was named in #216 with the controls whose own `for` dangled,
 * but it is on the labelable path: its `id` is forwarded to the inner
 * `mlv-input`, which puts it on a native `<input>`. Its own `<mlv-label>`
 * therefore names a real element, and `_externalLabelStrategy()` is `'native'`
 * to match.
 *
 * It binds `[for]="_ownLabelFor()"` with the other seven, so this spec is
 * deliberately **not** sensitive to that swap — `_ownLabelFor()` and `id()`
 * resolve to the same string here, which is why the conversion is safe. What
 * it is sensitive to is the strategy: a future change reporting `'aria'` (say,
 * moving the id onto the `__trigger` div, as `mlv-select` already did) makes
 * `_ownLabelFor()` `null`, and the assertions below fail instead of the native
 * input silently losing its `<label>`.
 */
describe('MlvCombobox — its own label (#216)', () => {
  it('names the inner native <input> with a real `for`', async () => {
    await TestBed.configureTestingModule({
      imports: [OwnLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(OwnLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const label = root.querySelector('mlv-label label') as HTMLLabelElement;
    const target = root.querySelector(
      `#${label.getAttribute('for')}`,
    ) as HTMLElement;

    expect(target.tagName).toBe('INPUT');
    expect((target as HTMLInputElement).labels?.length).toBe(1);
  });
});

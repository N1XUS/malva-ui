import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from './input';
import { MlvInputNative } from './input-native';

/**
 * The shape a consumer writes: `projectControl` plus their own native input,
 * named by their own `aria-label` — the advice the migration doc gives, since
 * `mlv-input` cannot name an element whose id it does not know.
 *
 * That `aria-label` is the consumer's own, and is what names the control here;
 * `mlv-input` contributes no name of its own in this mode (#259). Until #256
 * the wrapped shape rendered **zero** inputs — `input.html` declared
 * `<ng-content select="input[mlvInputNative]" />` twice and Angular binds a
 * projected node to the first matching slot — so this fixture could assert
 * nothing about the projected control at all. It renders one now, but the
 * assertion below is unchanged either way: `_ownLabelFor()` resolves from
 * `_externalLabelStrategy()`, which is `'none'` for `projectControl` whether or
 * not the projected input is stamped.
 */
@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input projectControl label="Search">
      <input mlvInputNative id="consumer-owned" aria-label="Search" />
    </mlv-input>
  `,
})
class ProjectedHost {}

@Component({
  imports: [MlvInput],
  template: `<mlv-input label="Search" />`,
})
class InternalHost {}

/**
 * The same dangling-`for` shape #216 removes elsewhere: with `projectControl`
 * the native input is the consumer's own and carries the consumer's id, so
 * `mlv-input`'s own `<mlv-label [for]="id()">` pointed at an id that is on no
 * element in the document at all. `_externalLabelStrategy()` already says
 * `'none'` for exactly this case, so `_ownLabelFor()` is `null` and no
 * attribute is emitted.
 *
 * Scope: this suite is about the `for` `mlv-input` writes on its **own**
 * `<mlv-label>`. Assertions about the projected control itself — that it is
 * rendered, and that nothing names it — live in `input-native.spec.ts`, which
 * owns that shape since #256.
 */
describe('MlvInput — its own label with projectControl (#216, adjacent)', () => {
  async function render<T>(host: new () => T): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('emits no `for` when the native input is the consumer’s own', async () => {
    const root = await render(ProjectedHost);
    const label = root.querySelector('mlv-label label') as HTMLLabelElement;

    // Not `for=""` and not the control id: no attribute at all.
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('still names its own internal input with a real `for`', async () => {
    const root = await render(InternalHost);
    const label = root.querySelector('mlv-label label') as HTMLLabelElement;
    const target = root.querySelector(
      `#${label.getAttribute('for')}`,
    ) as HTMLElement;

    expect(target.tagName).toBe('INPUT');
    expect((target as HTMLInputElement).labels?.length).toBe(1);
  });
});

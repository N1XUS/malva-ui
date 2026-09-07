import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import FormFieldReactiveFormsExampleComponent from './index';

/**
 * The compose-a-field pattern this page teaches: `<mlv-form-field>` with a
 * sibling `<mlv-label>` and a control. `mlv-form-field` is the only component
 * that sees both, so it is the only place the association can be made — see
 * `.claude/projects/libs-form-utils.md` § _`MlvFormField` → Accessible name_
 * and issue #197.
 *
 * The assertions are deliberately about resolved DOM state (which element the
 * label's `for` points at, which element carries the name) rather than "it
 * rendered": a `<label for="">` beside an unnamed control renders perfectly.
 */
describe('FormFieldReactiveFormsExampleComponent — label association', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.configureTestingModule({
      imports: [FormFieldReactiveFormsExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(FormFieldReactiveFormsExampleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('points every rendered <label for> at an element that exists', async () => {
    const host = await render();

    const dangling = Array.from(host.querySelectorAll('label[for]'))
      .map((label) => label.getAttribute('for') as string)
      .filter((target) => !host.querySelector(`[id="${target}"]`));

    expect(dangling).toEqual([]);
  });

  it('names the native text controls from the <mlv-label> in their own field', async () => {
    const host = await render();

    // The claim is the association, not the wording: each native input must be
    // reached by the `<label>` that sits in the same `mlv-form-field`. Reading
    // the label's text instead would also pass on a `for` that happened to hit
    // a different field's label, and would drag in `<mlv-hint>`'s text.
    const resolved = Array.from(
      host.querySelectorAll<HTMLInputElement>('.mlv-input__native'),
    ).map((input) => {
      const label = host.querySelector(`label[for="${input.id}"]`);
      const field = input.closest('mlv-form-field');
      return label !== null && field !== null && field.contains(label);
    });

    expect(resolved).toEqual([true, true, true]);
  });

  it('names the select trigger from its sibling <mlv-label>', async () => {
    const host = await render();

    const trigger = host.querySelector('.mlv-select__trigger') as HTMLElement;
    const labelledBy = trigger.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(
      host.querySelector(`[id="${labelledBy}"]`)?.textContent?.trim(),
    ).toBe('Country');
  });

  it('has no axe violations', async () => {
    const host = await render();

    await expectNoAxeViolations(host);
  });
});

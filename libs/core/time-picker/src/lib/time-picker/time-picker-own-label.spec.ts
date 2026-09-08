import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTimePicker } from './time-picker';

@Component({
  imports: [MlvTimePicker],
  template: `<mlv-time-picker label="Meeting time" [disabled]="disabled()" />`,
})
class OwnLabelHost {
  readonly disabled = signal(false);
}

/**
 * `mlv-time-picker` renders its own `<mlv-label>` from the `label` input and put
 * `[for]="id()"` on it, while `id()` sits on the trigger `div[role="combobox"]`
 * — an element `<label for>` cannot name (#216). The attribute read as an
 * association in review while naming nothing, and clicking the label focused
 * nothing.
 */
describe('MlvTimePicker — its own label (#216)', () => {
  interface Rendered {
    fixture: ComponentFixture<OwnLabelHost>;
    root: HTMLElement;
    labelHost: HTMLElement;
    label: HTMLLabelElement;
    trigger: HTMLElement;
  }

  async function render(): Promise<Rendered> {
    await TestBed.configureTestingModule({
      imports: [OwnLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(OwnLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root,
      labelHost: root.querySelector('mlv-label') as HTMLElement,
      label: root.querySelector('mlv-label label') as HTMLLabelElement,
      trigger: root.querySelector('.mlv-time-picker__trigger') as HTMLElement,
    };
  }

  it('emits no `for` at all, rather than one that names a div', async () => {
    const { label, trigger } = await render();

    expect(trigger.tagName).toBe('DIV');
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('still names the trigger from that label through aria-labelledby', async () => {
    const { root, labelHost, trigger } = await render();

    expect(trigger.getAttribute('aria-labelledby')).toBe(labelHost.id);
    expect(root.querySelector(`#${labelHost.id}`)?.textContent?.trim()).toBe(
      'Meeting time',
    );
  });

  it('focuses the trigger when the label is clicked, without opening', async () => {
    const { root, label, trigger } = await render();

    label.click();

    expect(document.activeElement).toBe(trigger);
    // Focus only. Opening is more than a native `<label for>` click does, and
    // this overlay is modal.
    expect(
      root
        .querySelector('mlv-time-picker')
        ?.classList.contains('mlv-time-picker--open'),
    ).toBe(false);
  });

  it('does not focus a disabled trigger from a label click', async () => {
    const { fixture, label, trigger } = await render();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    label.click();

    expect(document.activeElement).not.toBe(trigger);
  });

  it('has no axe violations while it names itself', async () => {
    const { root } = await render();

    await expectNoAxeViolations(root);
  });
});

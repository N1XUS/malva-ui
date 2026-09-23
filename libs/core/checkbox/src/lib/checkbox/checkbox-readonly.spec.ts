import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvCheckbox } from './checkbox';

/**
 * #298: a checkbox had no readonly concept at all. A native checkbox ignores
 * the `readonly` attribute, so a click (or the label, or Space) flipped the DOM
 * and `(change)` wrote it straight into the model; Enter toggled it through
 * {@link MlvCheckbox.toggle}, which checked only `computedDisabled()`.
 */
@Component({
  template: `
    <mlv-checkbox
      [readonly]="ro()"
      [disabled]="dis()"
      [indeterminate]="mixed()"
      [(checked)]="checked"
      >I agree</mlv-checkbox
    >
  `,
  imports: [MlvCheckbox],
})
class Host {
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly mixed = signal(false);
  readonly checked = signal(false);
  readonly control = viewChild.required(MlvCheckbox);
}

type Mode = 'readonly' | 'disabled';

async function create(
  mode: Mode | null,
  checked = false,
): Promise<ComponentFixture<Host>> {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.checked.set(checked);
  if (mode === 'readonly') fixture.componentInstance.ro.set(true);
  if (mode === 'disabled') fixture.componentInstance.dis.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function native(fixture: ComponentFixture<unknown>): HTMLInputElement {
  return fixture.nativeElement.querySelector('.mlv-checkbox__native');
}

function label(fixture: ComponentFixture<unknown>): HTMLLabelElement {
  return fixture.nativeElement.querySelector('.mlv-checkbox__label');
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('MlvCheckbox — write permission (#298)', () => {
  describe.each(['readonly', 'disabled'] as const)('while %s', (mode) => {
    it.each([false, true])(
      'a click on the input leaves checked=%s in the model and the DOM',
      async (initial) => {
        const fixture = await create(mode, initial);
        native(fixture).click();
        await settle(fixture);

        expect(fixture.componentInstance.checked()).toBe(initial);
        expect(native(fixture).checked).toBe(initial);
      },
    );

    it('a click on the label leaves the model and the DOM alone', async () => {
      const fixture = await create(mode);
      label(fixture).click();
      await settle(fixture);

      expect(fixture.componentInstance.checked()).toBe(false);
      expect(native(fixture).checked).toBe(false);
    });

    it('Enter does not toggle', async () => {
      const fixture = await create(mode);
      native(fixture).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle(fixture);

      expect(fixture.componentInstance.checked()).toBe(false);
    });

    it('a change event that reaches it anyway is rolled back in the DOM', async () => {
      const fixture = await create(mode);
      const input = native(fixture);
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(fixture);

      expect(fixture.componentInstance.checked()).toBe(false);
      expect(input.checked).toBe(false);
    });
  });

  describe('readonly', () => {
    it('cancels the click, so no change event fires at all', async () => {
      const fixture = await create('readonly');
      const changes: Event[] = [];
      native(fixture).addEventListener('change', (e) => changes.push(e));
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      native(fixture).dispatchEvent(click);
      await settle(fixture);

      expect(click.defaultPrevented).toBe(true);
      expect(changes.length).toBe(0);
    });

    it('keeps the indeterminate glyph state through a cancelled click', async () => {
      const fixture = await create('readonly');
      fixture.componentInstance.mixed.set(true);
      await settle(fixture);
      native(fixture).click();
      await settle(fixture);

      expect(fixture.componentInstance.checked()).toBe(false);
      expect(native(fixture).getAttribute('aria-checked')).toBe('mixed');
    });

    it('announces aria-readonly on the input, and only while readonly', async () => {
      const fixture = await create('readonly');
      expect(native(fixture).getAttribute('aria-readonly')).toBe('true');

      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      expect(native(fixture).hasAttribute('aria-readonly')).toBe(false);
    });

    it('stays focusable, so assistive tech can still read the state', async () => {
      const fixture = await create('readonly');
      expect(native(fixture).disabled).toBe(false);
      expect(native(fixture).getAttribute('tabindex')).toBe('0');
    });

    it('toggles again once readonly is lifted', async () => {
      const fixture = await create('readonly');
      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      native(fixture).click();
      await settle(fixture);

      expect(fixture.componentInstance.checked()).toBe(true);
    });
  });

  it('a signal-forms readonly() rule blocks the click', async () => {
    @Component({
      template: `<mlv-checkbox [formField]="f.agree">I agree</mlv-checkbox>`,
      imports: [MlvCheckbox, FormField],
    })
    class SignalHost {
      readonly model = signal({ agree: false });
      readonly f = form(this.model, (path) => {
        readonly(path.agree);
      });
    }

    await TestBed.configureTestingModule({
      imports: [SignalHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHost);
    await settle(fixture);
    native(fixture).click();
    await settle(fixture);

    expect(fixture.componentInstance.f.agree().value()).toBe(false);
    expect(native(fixture).checked).toBe(false);
  });

  describe('axe', () => {
    it.each([
      ['readonly, unchecked', false],
      ['readonly, checked', true],
    ] as const)('has no violations (%s)', async (_name, checked) => {
      const fixture = await create('readonly', checked);
      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    });
  });
});

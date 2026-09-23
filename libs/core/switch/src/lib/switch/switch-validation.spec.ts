import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { MlvSwitch } from './switch';

const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

@Component({
  imports: [MlvSwitch, FormField],
  template: `
    <mlv-switch
      [formField]="prefsForm.updates"
      [state]="state()"
      [description]="description()"
      [message]="message()"
      >Email me updates</mlv-switch
    >
  `,
})
class SignalHost {
  readonly model = signal({ updates: false });
  readonly prefsForm = form(this.model, (path) => {
    required(path.updates);
  });
  readonly state = signal<MlvFormState>('default');
  readonly description = signal('');
  readonly message = signal('');
}

@Component({
  imports: [MlvSwitch, MlvFormField, FormField],
  template: `
    <mlv-form-field>
      <mlv-switch [formField]="prefsForm.updates">Email me updates</mlv-switch>
    </mlv-form-field>
  `,
})
class FieldHost {
  readonly model = signal({ updates: false });
  readonly prefsForm = form(this.model, (path) => {
    required(path.updates);
  });
}

/**
 * #320 (FC-08): the switch shares the checkbox's host logic (FC-17) and the same
 * gap — its track read the explicit `state()` instead of `resolvedState()`,
 * `--error` had no CSS, the native `role="switch"` input carried no
 * `aria-invalid`, and `description` / `message` rendered nothing.
 */
describe('MlvSwitch — validation surface (#320)', () => {
  async function render<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function native(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-switch__native',
    ) as HTMLInputElement;
  }

  function trackClass(fixture: ComponentFixture<unknown>): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector('.mlv-switch__track')
        ?.className ?? ''
    );
  }

  async function blur(fixture: ComponentFixture<unknown>): Promise<void> {
    native(fixture).dispatchEvent(new FocusEvent('blur'));
    await settle(fixture);
  }

  it('shows the error visual and aria-invalid once a required field is touched', async () => {
    const fixture = await render(SignalHost);
    expect(native(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(trackClass(fixture)).toContain('mlv-switch__track--default');

    await blur(fixture);

    expect(native(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(trackClass(fixture)).toContain('mlv-switch__track--error');

    fixture.componentInstance.model.set({ updates: true });
    await settle(fixture);

    expect(native(fixture).hasAttribute('aria-invalid')).toBe(false);
    expect(trackClass(fixture)).toContain('mlv-switch__track--default');
  });

  it('honours an explicit state="error" and claims no invalidity for the other states', async () => {
    const fixture = await render(SignalHost);

    fixture.componentInstance.state.set('error');
    await settle(fixture);
    expect(native(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(trackClass(fixture)).toContain('mlv-switch__track--error');

    for (const state of ['success', 'warning', 'info'] as const) {
      fixture.componentInstance.state.set(state);
      await settle(fixture);
      expect(native(fixture).hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('renders description and message and references both from the native input', async () => {
    const fixture = await render(SignalHost);
    expect(native(fixture).hasAttribute('aria-describedby')).toBe(false);

    fixture.componentInstance.description.set('Required to continue');
    fixture.componentInstance.message.set('Please opt in');
    await settle(fixture);

    const root = fixture.nativeElement as HTMLElement;
    const description = root.querySelector('mlv-description') as HTMLElement;
    const message = root.querySelector('mlv-message') as HTMLElement;
    expect(description.textContent?.trim()).toBe('Required to continue');
    expect(message.textContent?.trim()).toBe('Please opt in');
    // Outside the <label>, so neither text joins the accessible name.
    expect(root.querySelector('label')?.contains(message)).toBe(false);
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      `${description.id} ${message.id}`,
    );
  });

  it('is described by the error message of the field it sits in', async () => {
    const fixture = await render(FieldHost);
    await blur(fixture);

    const root = fixture.nativeElement as HTMLElement;
    const fieldMessage = root.querySelector(
      '.mlv-form-field > mlv-message',
    ) as HTMLElement;
    expect(fieldMessage.id).not.toBe('');
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      fieldMessage.id,
    );
    expect(native(fixture).getAttribute('aria-invalid')).toBe('true');
  });

  it('has no axe violations in the error state with a message', async () => {
    const fixture = await render(SignalHost);
    fixture.componentInstance.message.set('Please opt in');
    await blur(fixture);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  describe('switch.scss', () => {
    const css = stripCssLayersFromText(
      sass.compile(
        resolve(dirname(fileURLToPath(import.meta.url)), './switch.scss'),
      ).css,
    );

    function declarations(selector: string): string {
      const bodies: string[] = [];
      for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = head.split(',').map((part) => part.trim());
        if (selectors.includes(selector)) bodies.push(body);
      }
      return bodies.join('\n');
    }

    it('rings the error track with the error border token', () => {
      expect(declarations('.mlv-switch__track--error')).toMatch(
        /var\(--mlv-border-error\)/,
      );
    });

    it('tints nothing for success, warning or info (SF-R6)', () => {
      expect(
        ['success', 'warning', 'info'].map((state) =>
          declarations(`.mlv-switch__track--${state}`),
        ),
      ).toEqual(['', '', '']);
    });
  });
});

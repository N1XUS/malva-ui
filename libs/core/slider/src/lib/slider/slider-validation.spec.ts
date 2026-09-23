import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, min } from '@angular/forms/signals';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { vi } from 'vitest';
import type { MlvSliderValue } from './slider';
import { MlvSlider } from './slider';

const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

@Component({
  imports: [MlvSlider, FormField],
  template: `
    <mlv-slider
      label="Volume"
      [formField]="audioForm.volume"
      [state]="state()"
      [description]="description()"
      [message]="message()"
    />
  `,
})
class SignalHost {
  readonly model = signal({ volume: 0 });
  readonly audioForm = form(this.model, (path) => {
    min(path.volume, 10);
  });
  readonly state = signal<MlvFormState>('default');
  readonly description = signal('');
  readonly message = signal('');
}

@Component({
  imports: [MlvSlider],
  template: `
    <mlv-slider
      range
      [value]="value()"
      state="error"
      message="Pick a narrower band"
    />
  `,
})
class RangeHost {
  readonly value = signal<MlvSliderValue>([20, 80]);
}

@Component({
  imports: [MlvSlider, MlvFormField, FormField],
  template: `
    <mlv-form-field>
      <mlv-slider label="Volume" [formField]="audioForm.volume" />
    </mlv-form-field>
  `,
})
class FieldHost {
  readonly model = signal({ volume: 0 });
  readonly audioForm = form(this.model, (path) => {
    min(path.volume, 10);
  });
}

/**
 * #320 (FC-08): the slider inherited the validation surface and rendered none
 * of it — no error visual, no `aria-invalid` on either `role="slider"` thumb,
 * and `description` / `message` type-checked and rendered nothing.
 */
describe('MlvSlider — validation surface (#320)', () => {
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

  function root(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function slider(fixture: ComponentFixture<unknown>): HTMLElement {
    return root(fixture).querySelector('mlv-slider') as HTMLElement;
  }

  /**
   * A `pointerdown` at `clientX`. jsdom has no `PointerEvent`, so it is a
   * `MouseEvent` carrying a `pointerId` (the shape `slider-readonly.spec.ts`
   * uses).
   */
  function pointerDown(clientX: number): PointerEvent {
    const event = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    return event as unknown as PointerEvent;
  }

  function thumbs(fixture: ComponentFixture<unknown>): HTMLElement[] {
    return Array.from(
      root(fixture).querySelectorAll<HTMLElement>('[role="slider"]'),
    );
  }

  it('shows the error state and sets aria-invalid on the thumb once an invalid field is touched', async () => {
    const fixture = await render(SignalHost);
    expect(thumbs(fixture).map((t) => t.hasAttribute('aria-invalid'))).toEqual([
      false,
    ]);
    expect(slider(fixture).classList).toContain('mlv-slider--state-default');

    fixture.componentInstance.audioForm.volume().markAsTouched();
    await settle(fixture);

    expect(thumbs(fixture).map((t) => t.getAttribute('aria-invalid'))).toEqual([
      'true',
    ]);
    expect(slider(fixture).classList).toContain('mlv-slider--state-error');

    fixture.componentInstance.model.set({ volume: 40 });
    await settle(fixture);
    expect(thumbs(fixture).map((t) => t.hasAttribute('aria-invalid'))).toEqual([
      false,
    ]);
  });

  it('honours an explicit state="error" and claims no invalidity for the other states', async () => {
    const fixture = await render(SignalHost);

    fixture.componentInstance.state.set('error');
    await settle(fixture);
    expect(thumbs(fixture)[0].getAttribute('aria-invalid')).toBe('true');

    for (const state of ['success', 'warning', 'info'] as const) {
      fixture.componentInstance.state.set(state);
      await settle(fixture);
      expect(thumbs(fixture)[0].hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('renders description and message and references both from the thumb', async () => {
    const fixture = await render(SignalHost);
    expect(thumbs(fixture)[0].hasAttribute('aria-describedby')).toBe(false);

    fixture.componentInstance.description.set('Applies to every speaker');
    fixture.componentInstance.message.set('Too quiet');
    await settle(fixture);

    const description = root(fixture).querySelector(
      'mlv-description',
    ) as HTMLElement;
    const message = root(fixture).querySelector('mlv-message') as HTMLElement;
    expect(description.textContent?.trim()).toBe('Applies to every speaker');
    expect(message.textContent?.trim()).toBe('Too quiet');
    expect(thumbs(fixture)[0].getAttribute('aria-describedby')).toBe(
      `${description.id} ${message.id}`,
    );
  });

  it('marks the host --has-text exactly while a description or message renders', async () => {
    const fixture = await render(SignalHost);
    const hasText = (): boolean =>
      slider(fixture).classList.contains('mlv-slider--has-text');
    const textRows = (): number =>
      root(fixture).querySelectorAll('mlv-description, mlv-message').length;
    expect([hasText(), textRows()]).toEqual([false, 0]);

    fixture.componentInstance.description.set('Applies to every speaker');
    await settle(fixture);
    expect([hasText(), textRows()]).toEqual([true, 1]);

    fixture.componentInstance.description.set('');
    fixture.componentInstance.message.set('Too quiet');
    await settle(fixture);
    expect([hasText(), textRows()]).toEqual([true, 1]);

    fixture.componentInstance.message.set('');
    await settle(fixture);
    expect([hasText(), textRows()]).toEqual([false, 0]);
  });

  it('describes and invalidates both thumbs in range mode', async () => {
    const fixture = await render(RangeHost);
    const message = root(fixture).querySelector('mlv-message') as HTMLElement;

    expect(
      thumbs(fixture).map((thumb) => [
        thumb.getAttribute('aria-invalid'),
        thumb.getAttribute('aria-describedby'),
      ]),
    ).toEqual([
      ['true', message.id],
      ['true', message.id],
    ]);
  });

  it('does not move a thumb when the description or message text is pressed', async () => {
    const fixture = await render(SignalHost);
    fixture.componentInstance.model.set({ volume: 40 });
    fixture.componentInstance.description.set('Output level');
    fixture.componentInstance.message.set('Too quiet');
    await settle(fixture);

    // jsdom lays nothing out; a 100px track puts clientX 90 near value 90.
    const track = root(fixture).querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 10,
      width: 100,
      height: 10,
      toJSON: () => ({}),
    } as DOMRect);

    for (const text of ['mlv-description', 'mlv-message']) {
      const element = root(fixture).querySelector(text) as HTMLElement;
      element.dispatchEvent(pointerDown(90));
      await settle(fixture);
      expect(thumbs(fixture)[0].getAttribute('aria-valuenow')).toBe('40');
    }

    // Control: the same press on the track does jump the thumb, so the
    // assertions above are not passing because the event never arrived.
    track.dispatchEvent(pointerDown(90));
    await settle(fixture);
    expect(
      Number(thumbs(fixture)[0].getAttribute('aria-valuenow')),
    ).toBeGreaterThan(80);
  });

  it('is described by the error message of the field it sits in', async () => {
    const fixture = await render(FieldHost);
    fixture.componentInstance.audioForm.volume().markAsTouched();
    await settle(fixture);

    const fieldMessage = root(fixture).querySelector(
      '.mlv-form-field > mlv-message',
    ) as HTMLElement;
    expect(fieldMessage.id).not.toBe('');
    expect(thumbs(fixture)[0].getAttribute('aria-describedby')).toBe(
      fieldMessage.id,
    );
  });

  it('has no axe violations in the error state with a description and message', async () => {
    const fixture = await render(SignalHost);
    fixture.componentInstance.description.set('Applies to every speaker');
    fixture.componentInstance.message.set('Too quiet');
    fixture.componentInstance.audioForm.volume().markAsTouched();
    await settle(fixture);
    await expectNoAxeViolations(root(fixture));
  });

  describe('slider.scss', () => {
    const css = stripCssLayersFromText(
      sass.compile(
        resolve(dirname(fileURLToPath(import.meta.url)), './slider.scss'),
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

    it('paints the error track with the error border token', () => {
      expect(
        declarations('.mlv-slider--state-error .mlv-slider__track'),
      ).toMatch(/background-color:\s*var\(--mlv-border-error\)/);
    });

    it('tints nothing for success, warning or info (SF-R6)', () => {
      expect(css).not.toMatch(/mlv-slider--state-(success|warning|info)/);
    });

    // Review F1: a thumb-sized row minimum on the base rule grew every
    // text-less slider whose `--mlv-slider-thumb-size` exceeds the space its
    // padding leaves (2rem: 44 → 56px). The minimum belongs to `--has-text`.
    it('holds the track row one thumb tall only while text renders', () => {
      const rowRules = [
        ...css.matchAll(/([^{}]+)\{[^{}]*grid-template-rows:\s*([^;}]+)/g),
      ].map(([, head, value]) => [head.trim(), value.trim()]);
      expect(rowRules).toEqual([
        ['.mlv-slider', 'auto'],
        [
          '.mlv-slider--has-text:not(.mlv-slider--vertical)',
          'minmax(var(--mlv-slider-thumb-size), auto)',
        ],
        ['.mlv-slider--vertical', 'minmax(0, 1fr)'],
      ]);
    });

    // Review F2: an absolutely positioned grid child resolves an `auto` end
    // line to the padding edge, so the two-line `grid-area: 1 / 1` takes the
    // thumb and tooltip off the rail (measured 10px with no text, 28px with a
    // description and a message).
    it.each([
      '.mlv-slider__track',
      '.mlv-slider__thumb',
      '.mlv-slider__tooltip',
    ])('places %s in the track row with all four grid lines', (selector) => {
      expect(declarations(selector)).toMatch(
        /grid-area:\s*1\s*\/\s*1\s*\/\s*2\s*\/\s*2\s*;/,
      );
    });

    it('drops the first text row of a vertical slider half a thumb below the rail', () => {
      const selector =
        '.mlv-slider--vertical.mlv-slider--has-text > .mlv-slider__description';
      const messageFirst =
        '.mlv-slider--vertical.mlv-slider--has-text > .mlv-slider__message:not(.mlv-slider__description + .mlv-slider__message)';
      for (const head of [selector, messageFirst]) {
        expect(declarations(head)).toMatch(
          /margin-block-start:\s*calc\(var\(--mlv-slider-thumb-size\)\s*\/\s*2\)/,
        );
      }
    });
  });
});

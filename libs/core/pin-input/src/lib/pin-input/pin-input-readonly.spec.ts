import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvPinInput } from './pin-input';

/**
 * #298: every cell rendered `readOnly`, which stops typing and nothing else —
 * Backspace, Delete and paste are handled in component code that never read
 * `readonly()`, so a readonly one-time code could still be erased or replaced.
 */
@Component({
  template: `
    <mlv-pin-input
      [length]="4"
      [readonly]="ro()"
      [disabled]="dis()"
      [(value)]="value"
      (completed)="completed.push($event)"
    />
  `,
  imports: [MlvPinInput],
})
class Host {
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly value = signal('1234');
  readonly completed: string[] = [];
}

type Mode = 'readonly' | 'disabled';

async function create(
  mode: Mode | null,
  value = '1234',
): Promise<ComponentFixture<Host>> {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.value.set(value);
  if (mode === 'readonly') fixture.componentInstance.ro.set(true);
  if (mode === 'disabled') fixture.componentInstance.dis.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function cells(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll(
      'mlv-input.mlv-pin-input__cell .mlv-input__native',
    ),
  );
}

function keydown(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

/** A paste event without `DataTransfer`, which jsdom does not provide. */
function paste(input: HTMLInputElement, text: string): ClipboardEvent {
  const event = Object.assign(
    new Event('paste', { bubbles: true, cancelable: true }),
    { clipboardData: { getData: () => text } },
  ) as ClipboardEvent;
  input.dispatchEvent(event);
  return event;
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

function display(fixture: ComponentFixture<unknown>): string {
  return cells(fixture)
    .map((c) => c.value)
    .join('');
}

describe('MlvPinInput — write permission (#298)', () => {
  describe.each(['readonly', 'disabled'] as const)('while %s', (mode) => {
    it.each(['Backspace', 'Delete'])(
      '%s on a filled cell leaves the code intact',
      async (key) => {
        const fixture = await create(mode);
        keydown(cells(fixture)[0], key);
        await settle(fixture);

        expect(fixture.componentInstance.value()).toBe('1234');
        expect(display(fixture)).toBe('1234');
      },
    );

    it('a paste leaves the code intact and emits no completed', async () => {
      const fixture = await create(mode);
      const event = paste(cells(fixture)[0], '9999');
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe('1234');
      expect(display(fixture)).toBe('1234');
      expect(fixture.componentInstance.completed).toEqual([]);
      // Still cancelled, so the native field never takes the text either.
      expect(event.defaultPrevented).toBe(true);
    });

    it('an input event that reaches a cell anyway writes nothing, and the cell stops showing it', async () => {
      const fixture = await create(mode, '12');
      const cell = cells(fixture)[2];
      cell.value = '7';
      cell.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(fixture);

      expect(fixture.componentInstance.value()).toBe('12');
      // The cell's own model took the '7'; the unchanged `[value]` binding
      // would never have put it back.
      expect(display(fixture)).toBe('12');
    });
  });

  it('Backspace on an empty readonly cell still moves focus back', async () => {
    const fixture = await create('readonly', '12');
    const all = cells(fixture);
    all[2].focus();
    keydown(all[2], 'Backspace');
    await settle(fixture);

    expect(document.activeElement).toBe(all[1]);
    expect(fixture.componentInstance.value()).toBe('12');
  });

  it('writes again once readonly is lifted', async () => {
    const fixture = await create('readonly');
    fixture.componentInstance.ro.set(false);
    await settle(fixture);
    keydown(cells(fixture)[3], 'Backspace');
    await settle(fixture);

    expect(fixture.componentInstance.value()).toBe('123');
  });

  it('a signal-forms readonly() rule blocks a paste', async () => {
    @Component({
      template: `<mlv-pin-input [length]="4" [formField]="f.code" />`,
      imports: [MlvPinInput, FormField],
    })
    class SignalHost {
      readonly model = signal({ code: '1234' });
      readonly f = form(this.model, (path) => {
        readonly(path.code);
      });
    }

    await TestBed.configureTestingModule({
      imports: [SignalHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHost);
    await settle(fixture);
    paste(cells(fixture)[0], '9999');
    await settle(fixture);

    expect(fixture.componentInstance.f.code().value()).toBe('1234');
  });
});

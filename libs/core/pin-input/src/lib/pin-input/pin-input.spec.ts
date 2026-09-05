import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvPinInput } from './pin-input';
import { MlvPinInputSeparator } from './pin-input-separator';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

@Component({
  template: `<mlv-pin-input [length]="4" (completed)="onCompleted($event)" />`,
  imports: [MlvPinInput],
})
class BasicHostComponent {
  completedValue = '';
  onCompleted(v: string) {
    this.completedValue = v;
  }
}

@Component({
  template: `<mlv-pin-input [length]="6" />`,
  imports: [MlvPinInput],
})
class SixCellHostComponent {}

@Component({
  template: `<mlv-pin-input [length]="4" type="password" />`,
  imports: [MlvPinInput],
})
class PasswordHostComponent {}

@Component({
  template: `<mlv-pin-input [length]="4" [disabled]="true" />`,
  imports: [MlvPinInput],
})
class DisabledHostComponent {}

@Component({
  template: `<mlv-pin-input [length]="4" [formControl]="ctrl" />`,
  imports: [MlvPinInput, ReactiveFormsModule],
})
class ReactiveHostComponent {
  ctrl = new FormControl('');
}

@Component({
  template: `
    <mlv-pin-input
      [length]="4"
      label="One-time code"
      hint="Sent to your phone"
      [state]="state()"
      [message]="message()"
    />
  `,
  imports: [MlvPinInput],
})
class LabelledHostComponent {
  state = signal<'default' | 'error'>('default');
  message = signal('');
}

@Component({
  template: `<mlv-pin-input [length]="4" separator="each" />`,
  imports: [MlvPinInput],
})
class SeparatorEachHostComponent {}

@Component({
  template: `<mlv-pin-input [length]="4" separator="1,3" />`,
  imports: [MlvPinInput],
})
class SeparatorIndicesHostComponent {}

@Component({
  template: `
    <mlv-pin-input [length]="4" separator="each">
      <ng-template mlvPinInputSeparator>
        <span class="custom-sep">—</span>
      </ng-template>
    </mlv-pin-input>
  `,
  imports: [MlvPinInput, MlvPinInputSeparator],
})
class SeparatorCustomHostComponent {}

@Component({
  template: `<mlv-pin-input [length]="4" />`,
  imports: [MlvPinInput],
})
class NoSeparatorHostComponent {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCells(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLInputElement>(
      'mlv-input.mlv-pin-input__cell .mlv-input__native',
    ),
  );
}

function dispatchInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function dispatchKeydown(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

/** Dispatch a paste event without needing DataTransfer (not available in all jsdom builds). */
function dispatchPaste(input: HTMLInputElement, text: string): void {
  const event = Object.assign(
    new Event('paste', { bubbles: true, cancelable: true }),
    { clipboardData: { getData: (_: string) => text } },
  ) as ClipboardEvent;
  input.dispatchEvent(event);
}

async function createFixture<T>(
  hostClass: new (...args: unknown[]) => T,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hostClass as any,
    ],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hostClass as any,
  ) as ComponentFixture<T>;
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvPinInput', () => {
  describe('rendering', () => {
    let fixture: ComponentFixture<BasicHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
    });

    it('renders the correct number of cells', () => {
      expect(getCells(fixture).length).toBe(4);
    });

    it('applies aria-label to each cell', () => {
      const cells = getCells(fixture);
      expect(cells[0].getAttribute('aria-label')).toBe('Digit 1 of 4');
      expect(cells[3].getAttribute('aria-label')).toBe('Digit 4 of 4');
    });

    it('sets autocomplete="one-time-code" on each cell', () => {
      getCells(fixture).forEach((c) =>
        expect(c.getAttribute('autocomplete')).toBe('one-time-code'),
      );
    });

    it('has role="group" on the host', () => {
      const el = fixture.nativeElement.querySelector('mlv-pin-input');
      expect(el.getAttribute('role')).toBe('group');
    });

    it('has aria-label on the host', () => {
      const el = fixture.nativeElement.querySelector('mlv-pin-input');
      expect(el.getAttribute('aria-label')).toBe('PIN entry');
    });
  });

  describe('rendering — 6-cell variant', () => {
    it('renders 6 cells', async () => {
      const fixture = await createFixture(SixCellHostComponent);
      expect(getCells(fixture).length).toBe(6);
    });
  });

  describe('rendering — password type', () => {
    it('sets type="password" on each cell', async () => {
      const fixture = await createFixture(PasswordHostComponent);
      getCells(fixture).forEach((c) => expect(c.type).toBe('password'));
    });
  });

  describe('disabled state', () => {
    let fixture: ComponentFixture<DisabledHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(DisabledHostComponent);
    });

    it('disables all cells when disabled=true', () => {
      expect(getCells(fixture).every((c) => c.disabled)).toBe(true);
    });

    it('adds disabled class to host element', () => {
      const el = fixture.nativeElement.querySelector('mlv-pin-input');
      expect(el.classList.contains('mlv-pin-input--disabled')).toBe(true);
    });
  });

  describe('keyboard navigation', () => {
    let fixture: ComponentFixture<BasicHostComponent>;
    let rtlService: MlvRtlService;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
      rtlService = TestBed.inject(MlvRtlService);
    });

    afterEach(() => rtlService?.setDirection('ltr'));

    it('Backspace on filled cell clears it', () => {
      const cells = getCells(fixture);
      dispatchInput(cells[0], 'A');
      fixture.detectChanges();
      dispatchKeydown(cells[0], 'Backspace');
      fixture.detectChanges();
      expect(cells[0].value).toBe('');
    });

    it('Delete clears the current cell', () => {
      const cells = getCells(fixture);
      dispatchInput(cells[1], 'B');
      fixture.detectChanges();
      dispatchKeydown(cells[1], 'Delete');
      fixture.detectChanges();
      expect(cells[1].value).toBe('');
    });

    it('Home key focuses the first cell', () => {
      const cells = getCells(fixture);
      cells[2].focus();
      dispatchKeydown(cells[2], 'Home');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[0]);
    });

    it('End key focuses the last cell', () => {
      const cells = getCells(fixture);
      cells[0].focus();
      dispatchKeydown(cells[0], 'End');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[3]);
    });

    it('ArrowLeft moves focus to previous cell', () => {
      const cells = getCells(fixture);
      cells[2].focus();
      dispatchKeydown(cells[2], 'ArrowLeft');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[1]);
    });

    it('ArrowRight moves focus to next cell', () => {
      const cells = getCells(fixture);
      cells[1].focus();
      dispatchKeydown(cells[1], 'ArrowRight');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[2]);
    });

    it('ArrowLeft on first cell stays on first cell', () => {
      const cells = getCells(fixture);
      cells[0].focus();
      dispatchKeydown(cells[0], 'ArrowLeft');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[0]);
    });

    it('ArrowRight on last cell stays on last cell', () => {
      const cells = getCells(fixture);
      cells[3].focus();
      dispatchKeydown(cells[3], 'ArrowRight');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[3]);
    });

    it('mirrors horizontal cell navigation in RTL', () => {
      const cells = getCells(fixture);
      rtlService.setDirection('rtl');
      fixture.detectChanges();

      cells[0].focus();
      dispatchKeydown(cells[0], 'ArrowLeft');
      fixture.detectChanges();

      expect(document.activeElement).toBe(cells[1]);
    });
  });

  describe('input and auto-advance', () => {
    let fixture: ComponentFixture<BasicHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
    });

    it('moves focus to next cell after character input', () => {
      const cells = getCells(fixture);
      cells[0].focus();
      dispatchInput(cells[0], 'A');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[1]);
    });

    it('does not advance past the last cell', () => {
      const cells = getCells(fixture);
      cells[3].focus();
      dispatchInput(cells[3], 'Z');
      fixture.detectChanges();
      expect(document.activeElement).toBe(cells[3]);
    });
  });

  describe('paste', () => {
    let fixture: ComponentFixture<BasicHostComponent>;
    let host: BasicHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
      host = fixture.componentInstance;
    });

    it('distributes pasted text across all cells from index 0', () => {
      const cells = getCells(fixture);
      dispatchPaste(cells[2], '1234');
      fixture.detectChanges();
      expect(cells[0].value).toBe('1');
      expect(cells[1].value).toBe('2');
      expect(cells[2].value).toBe('3');
      expect(cells[3].value).toBe('4');
    });

    it('clips pasted text to component length', () => {
      const cells = getCells(fixture);
      dispatchPaste(cells[0], '123456789');
      fixture.detectChanges();
      expect(cells[3].value).toBe('4');
    });

    it('emits completed when paste fills all cells', () => {
      const cells = getCells(fixture);
      dispatchPaste(cells[0], '1234');
      fixture.detectChanges();
      expect(host.completedValue).toBe('1234');
    });
  });

  describe('completed output', () => {
    let fixture: ComponentFixture<BasicHostComponent>;
    let host: BasicHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
      host = fixture.componentInstance;
    });

    it('emits completed with full value when all cells are filled', () => {
      const cells = getCells(fixture);
      ['1', '2', '3', '4'].forEach((ch, i) => {
        dispatchInput(cells[i], ch);
        fixture.detectChanges();
      });
      expect(host.completedValue).toBe('1234');
    });

    it('does not emit completed when only partial cells are filled', () => {
      const cells = getCells(fixture);
      dispatchInput(cells[0], '1');
      fixture.detectChanges();
      expect(host.completedValue).toBe('');
    });
  });

  describe('CVA integration', () => {
    let fixture: ComponentFixture<ReactiveHostComponent>;
    let host: ReactiveHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(ReactiveHostComponent);
      host = fixture.componentInstance;
    });

    it('writeValue populates cells from a full string', async () => {
      host.ctrl.setValue('ABCD');
      fixture.detectChanges();
      await fixture.whenStable();
      const cells = getCells(fixture);
      expect(cells[0].value).toBe('A');
      expect(cells[1].value).toBe('B');
      expect(cells[2].value).toBe('C');
      expect(cells[3].value).toBe('D');
    });

    it('writeValue with a short string leaves remaining cells empty', async () => {
      host.ctrl.setValue('AB');
      fixture.detectChanges();
      await fixture.whenStable();
      const cells = getCells(fixture);
      expect(cells[0].value).toBe('A');
      expect(cells[1].value).toBe('B');
      expect(cells[2].value).toBe('');
      expect(cells[3].value).toBe('');
    });

    it('writeValue null clears all cells', async () => {
      host.ctrl.setValue('1234');
      fixture.detectChanges();
      await fixture.whenStable();
      host.ctrl.setValue(null);
      fixture.detectChanges();
      await fixture.whenStable();
      const cells = getCells(fixture);
      expect(cells.every((c) => c.value === '')).toBe(true);
    });

    it('user input updates the reactive form control value', () => {
      const cells = getCells(fixture);
      dispatchInput(cells[0], '5');
      fixture.detectChanges();
      expect(host.ctrl.value?.startsWith('5')).toBe(true);
    });
  });

  describe('label / hint / message', () => {
    let fixture: ComponentFixture<LabelledHostComponent>;
    let host: LabelledHostComponent;

    beforeEach(async () => {
      fixture = await createFixture(LabelledHostComponent);
      host = fixture.componentInstance;
    });

    it('renders a mlv-label with the configured text', () => {
      const label = fixture.nativeElement.querySelector('mlv-label label');
      expect(label).not.toBeNull();
      expect(label.textContent).toContain('One-time code');
    });

    it('renders a hint inside the label', () => {
      const hint = fixture.nativeElement.querySelector('mlv-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent).toContain('Sent to your phone');
    });

    it('associates the label with the first cell via `for`', () => {
      const label = fixture.nativeElement.querySelector(
        'mlv-label label',
      ) as HTMLLabelElement;
      const firstCell = getCells(fixture)[0];
      expect(label.getAttribute('for')).toBe(firstCell.id);
    });

    it('does not render a message when `message` is empty', () => {
      expect(fixture.nativeElement.querySelector('mlv-message')).toBeNull();
    });

    it('renders mlv-message when a message is provided', async () => {
      host.state.set('error');
      host.message.set('Code is invalid');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const msg = fixture.nativeElement.querySelector('mlv-message');
      expect(msg).not.toBeNull();
      expect(msg.textContent).toContain('Code is invalid');
      expect(msg.classList.contains('mlv-message--error')).toBe(true);
    });
  });

  describe('last-cell single character enforcement', () => {
    let fixture: ComponentFixture<BasicHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(BasicHostComponent);
    });

    it('replaces the last cell value when a second character is typed', () => {
      const cells = getCells(fixture);
      cells[3].focus();
      dispatchInput(cells[3], '3');
      fixture.detectChanges();
      // Simulate native append: previous value "3" followed by new keystroke.
      dispatchInput(cells[3], '34');
      fixture.detectChanges();
      expect(cells[3].value).toBe('4');
    });

    it('does not allow more than one character in the last cell', () => {
      const cells = getCells(fixture);
      cells[3].focus();
      dispatchInput(cells[3], '9');
      fixture.detectChanges();
      dispatchInput(cells[3], '98');
      fixture.detectChanges();
      dispatchInput(cells[3], '87');
      fixture.detectChanges();
      expect(cells[3].value.length).toBe(1);
      expect(cells[3].value).toBe('7');
    });
  });

  describe('separator', () => {
    function getSeparators(fixture: ComponentFixture<unknown>): HTMLElement[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.mlv-pin-input__separator',
        ),
      );
    }

    it('renders no separators by default', async () => {
      const fixture = await createFixture(NoSeparatorHostComponent);
      expect(getSeparators(fixture).length).toBe(0);
    });

    it('renders a separator between every pair of cells with separator="each"', async () => {
      const fixture = await createFixture(SeparatorEachHostComponent);
      const separators = getSeparators(fixture);
      // 4 cells → 3 gaps → 3 separators
      expect(separators.length).toBe(3);
    });

    it('renders separators at the specified indices with separator="1,3"', async () => {
      const fixture = await createFixture(SeparatorIndicesHostComponent);
      const separators = getSeparators(fixture);
      // indices 1 and 3 → 2 separators
      expect(separators.length).toBe(2);
    });

    it('places default separator as a lucide dot icon', async () => {
      const fixture = await createFixture(SeparatorEachHostComponent);
      const firstSep = getSeparators(fixture)[0];
      expect(firstSep.querySelector('svg')).not.toBeNull();
    });

    it('renders a custom template when *mlvPinInputSeparator is projected', async () => {
      const fixture = await createFixture(SeparatorCustomHostComponent);
      const separators = getSeparators(fixture);
      expect(separators.length).toBe(3);
      separators.forEach((sep) => {
        const custom = sep.querySelector('.custom-sep');
        expect(custom).not.toBeNull();
        expect(custom?.textContent).toBe('—');
      });
    });

    it('separator is marked aria-hidden', async () => {
      const fixture = await createFixture(SeparatorEachHostComponent);
      const firstSep = getSeparators(fixture)[0];
      expect(firstSep.getAttribute('aria-hidden')).toBe('true');
    });
  });
});

@Component({
  template: `<mlv-pin-input
    [length]="3"
    label="One-time code"
    required
    description="Check your SMS."
  />`,
  imports: [MlvPinInput],
})
class PinInputFieldSurfaceHost {}

describe('MlvPinInput field surface', () => {
  let fixture: ComponentFixture<PinInputFieldSurfaceHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinInputFieldSurfaceHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PinInputFieldSurfaceHost);
    await fixture.whenStable();
  });

  it('marks every cell required and shows the label marker', () => {
    const cells = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLInputElement>(
        '.mlv-pin-input__cell input',
      ),
    );
    expect(cells.length).toBe(3);
    for (const cell of cells) {
      expect(cell.getAttribute('aria-required')).toBe('true');
    }
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).not.toBeNull();
  });

  it('describes every cell with the rendered description element', () => {
    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    expect(description.textContent?.trim()).toBe('Check your SMS.');

    const cells = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLInputElement>(
        '.mlv-pin-input__cell input',
      ),
    );
    for (const cell of cells) {
      expect(cell.getAttribute('aria-describedby')).toBe(description.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Scoped direction (#147)
//
// Cell-to-cell movement is inline-axis, so it resolves against the pin input's
// own host: a `[dir]` ancestor mirrors it while the document stays LTR, and so
// does the `dir` CDK stamps on an overlay pane the field is rendered in.
// ---------------------------------------------------------------------------

@Component({
  template: `<div [attr.dir]="scopeDir()">
    <mlv-pin-input [length]="4" />
  </div>`,
  imports: [MlvPinInput],
})
class ScopedDirHostComponent {
  readonly scopeDir = signal<'rtl' | 'ltr'>('rtl');
}

describe('MlvPinInput scoped direction', () => {
  let fixture: ComponentFixture<ScopedDirHostComponent>;
  let rtlService: MlvRtlService;

  /** Index of the focused cell — a number, so a failure never prints a node. */
  function focusedCellIndex(): number {
    return getCells(fixture).indexOf(
      document.activeElement as HTMLInputElement,
    );
  }

  function focusCell(index: number): void {
    getCells(fixture)[index].focus();
  }

  function keydown(index: number, key: string): void {
    dispatchKeydown(getCells(fixture)[index], key);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    fixture = await createFixture(ScopedDirHostComponent);
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService?.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('mirrors horizontal cell navigation inside a [dir="rtl"] subtree while the document stays LTR', () => {
    expect(rtlService.direction()).toBe('ltr');

    focusCell(2);
    keydown(2, 'ArrowLeft');
    expect(focusedCellIndex()).toBe(3); // ArrowLeft is "next" once mirrored
    keydown(3, 'ArrowRight');
    expect(focusedCellIndex()).toBe(2);
  });

  it('leaves Home and End alone inside a [dir="rtl"] subtree', () => {
    focusCell(2);
    keydown(2, 'Home');
    expect(focusedCellIndex()).toBe(0);
    keydown(0, 'End');
    expect(focusedCellIndex()).toBe(3);
  });

  it('keeps a [dir="ltr"] island unmirrored while the document is RTL', async () => {
    fixture.componentInstance.scopeDir.set('ltr');
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtlService.direction()).toBe('rtl');

    focusCell(2);
    keydown(2, 'ArrowRight');
    expect(focusedCellIndex()).toBe(3); // the island reads LTR
    keydown(3, 'ArrowLeft');
    expect(focusedCellIndex()).toBe(2);
  });
});

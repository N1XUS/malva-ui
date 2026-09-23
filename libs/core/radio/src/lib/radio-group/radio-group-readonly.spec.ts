import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField, readonly } from '@angular/forms/signals';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRadioGroup } from './radio-group';
import { MlvRadio } from '../radio/radio';

/**
 * #298 (FC-06): a native radio click flips DOM `checked` before `(change)`
 * runs. `selectRadio` refused the write for a readonly or disabled group, but
 * the `[checked]` bindings held the same value, so Angular never re-wrote the
 * DOM — the page and the accessibility tree showed B while `aria-checked` and
 * the value said A. A disabled group also never disabled its radios, so Tab
 * still reached them and Space still flipped them.
 */
@Component({
  template: `
    <mlv-radio-group
      label="Plan"
      [readonly]="ro()"
      [disabled]="dis()"
      [(value)]="value"
    >
      <mlv-radio [value]="'a'">A</mlv-radio>
      <mlv-radio [value]="'b'" [disabled]="bDisabled()">B</mlv-radio>
      <mlv-radio [value]="'c'">C</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class Host {
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly bDisabled = signal(false);
  readonly value = signal<unknown>('a');
}

type Mode = 'readonly' | 'disabled';

async function create(mode: Mode | null): Promise<ComponentFixture<Host>> {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  if (mode === 'readonly') fixture.componentInstance.ro.set(true);
  if (mode === 'disabled') fixture.componentInstance.dis.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function radios(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-radio__native'),
  );
}

function group(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-radio-group');
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

/** DOM `checked`, `aria-checked` and the model, read together. */
function snapshot(fixture: ComponentFixture<Host>): string {
  const all = radios(fixture);
  return [
    `value=${String(fixture.componentInstance.value())}`,
    `dom=${all.map((r) => r.checked).join(',')}`,
    `aria=${all.map((r) => r.getAttribute('aria-checked')).join(',')}`,
  ].join(' ');
}

const IN_SYNC_ON_A = 'value=a dom=true,false,false aria=true,false,false';

/**
 * The value, `aria-checked`, and the DOM `checked` of the radio that was
 * clicked. A cancelled click is how a readonly group keeps the DOM in sync,
 * and the HTML legacy-canceled-activation steps then put the previously
 * checked radio back — Chrome 153 does (probed with real mouse, label, Space
 * and ArrowDown input; no `change` fires). jsdom does not: it reverts only the
 * clicked radio and leaves the previous one unchecked, so the full DOM
 * snapshot is asserted only where no click activation runs at all.
 */
function afterRefusedClick(fixture: ComponentFixture<Host>): string {
  const all = radios(fixture);
  return [
    `value=${String(fixture.componentInstance.value())}`,
    `clicked=${all[1].checked}`,
    `aria=${all.map((r) => r.getAttribute('aria-checked')).join(',')}`,
  ].join(' ');
}

describe('MlvRadioGroup — write permission (#298)', () => {
  describe.each(['readonly', 'disabled'] as const)('while %s', (mode) => {
    it('a click on another radio leaves the value, aria-checked and that radio unchecked', async () => {
      const fixture = await create(mode);
      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);

      radios(fixture)[1].click();
      await settle(fixture);

      expect(afterRefusedClick(fixture)).toBe(
        'value=a clicked=false aria=true,false,false',
      );
    });

    it('a change event that reaches a radio anyway is rolled back in the DOM', async () => {
      const fixture = await create(mode);
      const all = radios(fixture);
      all[2].checked = true;
      all[2].dispatchEvent(new Event('change', { bubbles: true }));
      await settle(fixture);

      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
    });

    it('an arrow key leaves the selection on A', async () => {
      const fixture = await create(mode);
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      group(fixture).dispatchEvent(event);
      await settle(fixture);

      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
      // Still suppressed, so the browser's own radio navigation cannot move
      // the checked state behind the component's back.
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('readonly', () => {
    it('cancels the click on another radio', async () => {
      const fixture = await create('readonly');
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      radios(fixture)[1].dispatchEvent(click);
      await settle(fixture);

      expect(click.defaultPrevented).toBe(true);
    });

    it('announces aria-readonly on the radiogroup, and only while readonly', async () => {
      const fixture = await create('readonly');
      expect(group(fixture).getAttribute('aria-readonly')).toBe('true');

      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      expect(group(fixture).hasAttribute('aria-readonly')).toBe(false);
    });

    it('arrow keys still move focus between radios while the selection stays on A', async () => {
      // aria-readonly: authors SHOULD NOT restrict navigation. Round 1 stopped
      // the key manager for readonly too, and the arrow-selection test above
      // could not see it — it passes whether or not focus moves.
      const fixture = await create('readonly');
      const all = radios(fixture);
      all[0].focus();
      await settle(fixture);

      const down = (): KeyboardEvent => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        });
        (document.activeElement as HTMLElement).dispatchEvent(event);
        return event;
      };

      const first = down();
      await settle(fixture);
      expect(document.activeElement).toBe(all[1]);
      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
      expect(first.defaultPrevented).toBe(true);

      // A second arrow resumes from the focused radio, so the key manager did
      // not drift from focus.
      down();
      await settle(fixture);
      expect(document.activeElement).toBe(all[2]);
      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
    });

    it('keeps the radios enabled, so the checked one stays reachable', async () => {
      const fixture = await create('readonly');
      expect(radios(fixture).map((r) => r.disabled)).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('selects again once readonly is lifted', async () => {
      const fixture = await create('readonly');
      fixture.componentInstance.ro.set(false);
      await settle(fixture);
      radios(fixture)[1].click();
      await settle(fixture);

      expect(snapshot(fixture)).toBe(
        'value=b dom=false,true,false aria=false,true,false',
      );
    });
  });

  describe('disabled', () => {
    it('a click on another radio runs no activation, so the whole DOM stays on A', async () => {
      const fixture = await create('disabled');
      radios(fixture)[1].click();
      await settle(fixture);

      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
    });

    it('an arrow key moves neither focus nor selection', async () => {
      const fixture = await create('disabled');
      const before = document.activeElement;
      group(fixture).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle(fixture);

      expect(document.activeElement).toBe(before);
      expect(snapshot(fixture)).toBe(IN_SYNC_ON_A);
    });

    it('disables every native radio, taking them out of the tab order', async () => {
      const fixture = await create('disabled');
      expect(radios(fixture).map((r) => r.disabled)).toEqual([
        true,
        true,
        true,
      ]);
    });

    it("restores each radio's own disabled state when the group is re-enabled", async () => {
      const fixture = await create('disabled');
      fixture.componentInstance.bDisabled.set(true);
      await settle(fixture);
      fixture.componentInstance.dis.set(false);
      await settle(fixture);

      expect(radios(fixture).map((r) => r.disabled)).toEqual([
        false,
        true,
        false,
      ]);
    });

    it('disables the native radios when the group is disabled through a FormControl', async () => {
      @Component({
        template: `
          <mlv-radio-group label="Plan" [formControl]="ctrl">
            <mlv-radio [value]="'a'">A</mlv-radio>
            <mlv-radio [value]="'b'">B</mlv-radio>
          </mlv-radio-group>
        `,
        imports: [MlvRadioGroup, MlvRadio, ReactiveFormsModule],
      })
      class ReactiveHost {
        readonly ctrl = new FormControl('a');
      }

      await TestBed.configureTestingModule({
        imports: [ReactiveHost],
      }).compileComponents();
      const fixture = TestBed.createComponent(ReactiveHost);
      await settle(fixture);
      fixture.componentInstance.ctrl.disable();
      await settle(fixture);

      expect(radios(fixture).map((r) => r.disabled)).toEqual([true, true]);
    });
  });

  it('a signal-forms readonly() rule blocks a click and keeps the DOM on the value', async () => {
    @Component({
      template: `
        <mlv-radio-group label="Plan" [formField]="f.plan">
          <mlv-radio [value]="'a'">A</mlv-radio>
          <mlv-radio [value]="'b'">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio, FormField],
    })
    class SignalHost {
      readonly model = signal({ plan: 'a' });
      readonly f = form(this.model, (path) => {
        readonly(path.plan);
      });
    }

    await TestBed.configureTestingModule({
      imports: [SignalHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHost);
    await settle(fixture);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    radios(fixture)[1].dispatchEvent(click);
    await settle(fixture);

    expect(fixture.componentInstance.f.plan().value()).toBe('a');
    expect(click.defaultPrevented).toBe(true);
    // See `afterRefusedClick` for why only the clicked radio is asserted.
    expect(radios(fixture)[1].checked).toBe(false);
  });

  describe('axe', () => {
    it.each(['readonly', 'disabled'] as const)(
      'has no violations (%s)',
      async (mode) => {
        const fixture = await create(mode);
        await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
      },
    );
  });
});

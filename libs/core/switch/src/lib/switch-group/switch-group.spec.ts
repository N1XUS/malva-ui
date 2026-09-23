import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSwitchGroup } from './switch-group';
import { MlvSwitch } from '../switch/switch';

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-switch-group [label]="label">
      <mlv-switch>First</mlv-switch>
      <mlv-switch>Second</mlv-switch>
      <mlv-switch>Third</mlv-switch>
    </mlv-switch-group>
  `,
  imports: [MlvSwitchGroup, MlvSwitch],
})
class TemplateHost {
  label = '';
}

@Component({
  template: `
    <mlv-switch-group>
      <mlv-switch>First</mlv-switch>
      <mlv-switch [disabled]="true">Disabled</mlv-switch>
      <mlv-switch>Third</mlv-switch>
    </mlv-switch-group>
  `,
  imports: [MlvSwitchGroup, MlvSwitch],
})
class DisabledHost {}

interface Channel {
  id: string;
  label: string;
  disabled: boolean;
}

/**
 * A "Notification channels" group whose options are data: the first one (SMS)
 * is disabled for the plan, which is the #307 failure scenario, and the list
 * can grow or have an option disabled while the group is live.
 */
@Component({
  template: `
    <mlv-switch-group label="Notification channels">
      @for (channel of channels(); track channel.id) {
        <mlv-switch [disabled]="channel.disabled">{{
          channel.label
        }}</mlv-switch>
      }
    </mlv-switch-group>
  `,
  imports: [MlvSwitchGroup, MlvSwitch],
})
class ChannelsHost {
  readonly channels = signal<Channel[]>([
    { id: 'sms', label: 'SMS', disabled: true },
    { id: 'email', label: 'Email', disabled: false },
    { id: 'push', label: 'Push', disabled: false },
  ]);

  /** Sets one channel's `disabled` flag, leaving the rest untouched. */
  setDisabled(id: string, disabled: boolean): void {
    this.channels.update((list) =>
      list.map((c) => (c.id === id ? { ...c, disabled } : c)),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInputs(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-switch__native'),
  );
}

function getGroupEl(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('.mlv-switch-group');
}

function dispatchArrow(
  element: HTMLElement,
  key: 'ArrowDown' | 'ArrowUp',
): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'keyCode', {
    get: () => (key === 'ArrowDown' ? 40 : 38),
  });
  element.dispatchEvent(event);
}

/**
 * The switches a browser's Tab sequence reaches: enabled, and not taken out of
 * the order by `tabindex="-1"`. jsdom does not model this itself — it treats a
 * disabled input carrying a `tabindex` as focusable — so the predicate is
 * spelled out, matching what Chromium, Firefox and WebKit do.
 */
function tabStops(fixture: ComponentFixture<unknown>): string[] {
  return getInputs(fixture)
    .filter((i) => !i.disabled && i.getAttribute('tabindex') !== '-1')
    .map((i) => i.closest('mlv-switch')?.textContent?.trim() ?? '');
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

async function createFixture<T>(
  hostClass: Type<T>,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvSwitchGroup', () => {
  describe('rendering', () => {
    it('has role="group" on the container', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getGroupEl(fixture).getAttribute('role')).toBe('group');
    });

    it('projects each switch', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getInputs(fixture).length).toBe(3);
    });
  });

  describe('roving tabindex', () => {
    it('makes only the first switch tabbable initially', async () => {
      const fixture = await createFixture(TemplateHost);
      const inputs = getInputs(fixture);
      expect(inputs.map((i) => i.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
        '-1',
      ]);
    });

    // Regression: the FocusKeyManager `change` subscription must move the tab
    // stop as arrow navigation moves focus. Without it, focus lands on the new
    // switch but tabindex="0" stays on the first, so Tab-out then Shift+Tab
    // returns focus to the wrong switch.
    it('moves the roving tab stop as ArrowDown moves focus', async () => {
      const fixture = await createFixture(TemplateHost);
      document.body.appendChild(fixture.nativeElement);
      try {
        const inputs = getInputs(fixture);
        inputs[0].focus();
        inputs[0].dispatchEvent(new FocusEvent('focus'));

        dispatchArrow(getGroupEl(fixture), 'ArrowDown');
        fixture.detectChanges();

        const tabbable = inputs.filter(
          (i) => i.getAttribute('tabindex') === '0',
        );
        expect(tabbable.length).toBe(1);
        expect(inputs[1].getAttribute('tabindex')).toBe('0');
        expect(inputs[0].getAttribute('tabindex')).toBe('-1');
      } finally {
        fixture.nativeElement.remove();
      }
    });

    it('keeps a single tab stop when navigation skips a disabled switch', async () => {
      const fixture = await createFixture(DisabledHost);
      document.body.appendChild(fixture.nativeElement);
      try {
        const inputs = getInputs(fixture);
        inputs[0].focus();
        inputs[0].dispatchEvent(new FocusEvent('focus'));

        // ArrowDown skips the disabled second switch and lands on the third.
        dispatchArrow(getGroupEl(fixture), 'ArrowDown');
        fixture.detectChanges();

        expect(inputs[2].getAttribute('tabindex')).toBe('0');
        expect(
          inputs.filter((i) => i.getAttribute('tabindex') === '0').length,
        ).toBe(1);
      } finally {
        fixture.nativeElement.remove();
      }
    });
  });

  describe('roving tab stop with disabled switches (#307)', () => {
    let fixture: ComponentFixture<ChannelsHost>;

    beforeEach(async () => {
      fixture = await createFixture(ChannelsHost);
      // Attached so `.focus()` fires the focus event that reports the child to
      // the group, as a real Tab or click would.
      document.body.appendChild(fixture.nativeElement);
    });

    afterEach(() => {
      (fixture.nativeElement as HTMLElement).remove();
    });

    it('gives the tab stop to the first enabled switch when the first is disabled', () => {
      expect(tabStops(fixture)).toEqual(['Email']);
      expect(getInputs(fixture).map((i) => i.getAttribute('tabindex'))).toEqual(
        ['-1', '0', '-1'],
      );
    });

    it('moves the tab stop to the next enabled switch when its own becomes disabled', async () => {
      getInputs(fixture)[1].focus();
      await settle(fixture);
      expect(tabStops(fixture)).toEqual(['Email']);

      fixture.componentInstance.setDisabled('email', true);
      await settle(fixture);

      expect(tabStops(fixture)).toEqual(['Push']);
    });

    it('hands the stop to the next enabled switch after the focused one, not the first, wrapping at the end', async () => {
      fixture.componentInstance.channels.set([
        { id: 'a', label: 'A', disabled: false },
        { id: 'b', label: 'B', disabled: false },
        { id: 'c', label: 'C', disabled: false },
        { id: 'd', label: 'D', disabled: false },
      ]);
      await settle(fixture);
      getInputs(fixture)[1].focus();
      await settle(fixture);
      expect(tabStops(fixture)).toEqual(['B']);

      fixture.componentInstance.setDisabled('b', true);
      await settle(fixture);
      expect(tabStops(fixture)).toEqual(['C']);

      getInputs(fixture)[3].focus();
      await settle(fixture);
      fixture.componentInstance.setDisabled('d', true);
      await settle(fixture);
      expect(tabStops(fixture)).toEqual(['A']);
    });

    it('keeps a user-moved tab stop, and arrow navigation from it, when a switch is added', async () => {
      getInputs(fixture)[2].focus();
      await settle(fixture);
      expect(tabStops(fixture)).toEqual(['Push']);

      fixture.componentInstance.channels.update((list) => [
        ...list,
        { id: 'slack', label: 'Slack', disabled: false },
      ]);
      await settle(fixture);

      expect(tabStops(fixture)).toEqual(['Push']);

      // Arrow navigation resumes from the focused switch, not from the top.
      dispatchArrow(getGroupEl(fixture), 'ArrowDown');
      await settle(fixture);
      expect(document.activeElement).toBe(getInputs(fixture)[3]);
      expect(tabStops(fixture)).toEqual(['Slack']);
    });

    it('has no axe violations with a disabled first switch', async () => {
      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    });
  });
});

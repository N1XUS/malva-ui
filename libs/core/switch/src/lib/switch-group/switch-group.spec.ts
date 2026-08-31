import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { Type } from '@angular/core';
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
});

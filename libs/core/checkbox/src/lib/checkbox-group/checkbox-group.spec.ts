import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvCheckboxGroup } from './checkbox-group';
import { MlvCheckbox } from '../checkbox/checkbox';

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
    <mlv-checkbox-group label="Notification channels">
      @for (channel of channels(); track channel.id) {
        <mlv-checkbox [disabled]="channel.disabled">{{
          channel.label
        }}</mlv-checkbox>
      }
    </mlv-checkbox-group>
  `,
  imports: [MlvCheckboxGroup, MlvCheckbox],
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

function getInputs(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.mlv-checkbox__native',
    ),
  );
}

/**
 * The inputs a browser's Tab sequence reaches: enabled, and not taken out of
 * the order by `tabindex="-1"`. jsdom does not model this itself — it treats a
 * disabled input carrying a `tabindex` as focusable — so the predicate is
 * spelled out, matching what Chromium, Firefox and WebKit do.
 */
function tabStops(fixture: ComponentFixture<unknown>): string[] {
  return getInputs(fixture)
    .filter((i) => !i.disabled && i.getAttribute('tabindex') !== '-1')
    .map((i) => i.closest('mlv-checkbox')?.textContent?.trim() ?? '');
}

function dispatchArrowDown(element: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 40 });
  element.dispatchEvent(event);
}

async function createFixture(): Promise<ComponentFixture<ChannelsHost>> {
  await TestBed.configureTestingModule({
    imports: [ChannelsHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(ChannelsHost);
  // Attached so `.focus()` fires the focus event that reports the child to the
  // group, as a real Tab or click would.
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('MlvCheckboxGroup roving tab stop (#307)', () => {
  let fixture: ComponentFixture<ChannelsHost>;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('gives the tab stop to the first enabled checkbox when the first is disabled', () => {
    expect(tabStops(fixture)).toEqual(['Email']);
    expect(getInputs(fixture).map((i) => i.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('moves the tab stop to the next enabled checkbox when its own becomes disabled', async () => {
    getInputs(fixture)[1].focus();
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['Email']);

    fixture.componentInstance.setDisabled('email', true);
    await settle(fixture);

    expect(tabStops(fixture)).toEqual(['Push']);
  });

  it('hands the stop to the next enabled checkbox after the focused one, not the first, wrapping at the end', async () => {
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

  it('gives a tab stop back once an option is re-enabled in an all-disabled group', async () => {
    fixture.componentInstance.setDisabled('email', true);
    fixture.componentInstance.setDisabled('push', true);
    await settle(fixture);
    expect(tabStops(fixture)).toEqual([]);

    fixture.componentInstance.setDisabled('sms', false);
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['SMS']);
  });

  it('keeps a user-moved tab stop, and arrow navigation from it, when a checkbox is added', async () => {
    const inputs = getInputs(fixture);
    inputs[2].focus();
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['Push']);

    fixture.componentInstance.channels.update((list) => [
      ...list,
      { id: 'slack', label: 'Slack', disabled: false },
    ]);
    await settle(fixture);

    expect(tabStops(fixture)).toEqual(['Push']);

    // Arrow navigation resumes from the focused checkbox, not from the top.
    dispatchArrowDown(getInputs(fixture)[2]);
    await settle(fixture);
    expect(document.activeElement).toBe(getInputs(fixture)[3]);
    expect(tabStops(fixture)).toEqual(['Slack']);
  });

  it('has no axe violations with a disabled first checkbox', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

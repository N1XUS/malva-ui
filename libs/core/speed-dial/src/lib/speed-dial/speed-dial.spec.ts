import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  LucidePencil,
  LucidePlus,
  LucideShare,
  LucideTrash,
  provideLucideIcons,
} from '@lucide/angular';
import { compile } from 'sass';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvSpeedDial } from './speed-dial';
import { MlvSpeedDialItemDef } from './speed-dial-item-def';
import { MlvSpeedDialTriggerIcon } from './speed-dial-trigger-icon';
import type {
  MlvSpeedDialDirection,
  MlvSpeedDialItem,
  MlvSpeedDialItemEvent,
  MlvSpeedDialOpenOn,
  MlvSpeedDialType,
} from './speed-dial.types';

/** Real-timer wait — the overlay detaches after the close transition settles. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** jsdom has no `PointerEvent`; a plain event with `pointerType` is enough for the handlers. */
function firePointer(
  el: Element,
  type: 'pointerenter' | 'pointerleave',
  pointerType: 'mouse' | 'touch' | 'pen' = 'mouse',
): void {
  const event = new Event(type, { bubbles: false });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  el.dispatchEvent(event);
}

function fireKey(el: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}

@Component({
  imports: [MlvSpeedDial, MlvSpeedDialItemDef, MlvSpeedDialTriggerIcon],
  template: `
    <mlv-speed-dial
      [items]="items()"
      [type]="type()"
      [direction]="direction()"
      [mask]="mask()"
      [disabled]="disabled()"
      [transitionDelay]="delay()"
      [radius]="radius()"
      [mlvDensity]="density()"
      [openOn]="openOn()"
      [(opened)]="opened"
      ariaLabel="Quick actions"
      (itemSelect)="selected.push($event)"
    />
  `,
})
class SpeedDialHost {
  readonly commands: string[] = [];
  readonly selected: MlvSpeedDialItemEvent[] = [];
  readonly items = signal<MlvSpeedDialItem[]>([
    { label: 'Add', icon: 'plus', command: () => this.commands.push('add') },
    { label: 'Edit', icon: 'pencil', disabled: true },
    {
      label: 'Share',
      icon: 'share',
      command: () => this.commands.push('share'),
    },
    { label: 'Delete', icon: 'trash' },
  ]);
  readonly type = signal<MlvSpeedDialType>('linear');
  readonly direction = signal<MlvSpeedDialDirection>('up');
  readonly mask = signal(false);
  readonly disabled = signal(false);
  readonly delay = signal(0);
  readonly radius = signal(80);
  readonly density = signal<MlvDensity | undefined>(undefined);
  readonly openOn = signal<MlvSpeedDialOpenOn>('click');
  readonly opened = signal(false);
}

/**
 * Projection is resolved statically, so a conditionally projected slot still
 * suppresses the fallback — the custom-content cases get their own host.
 */
@Component({
  imports: [MlvSpeedDial, MlvSpeedDialItemDef, MlvSpeedDialTriggerIcon],
  template: `
    <mlv-speed-dial [items]="items" ariaLabel="Quick actions">
      <span mlvSpeedDialTriggerIcon class="custom-trigger">T</span>
      <ng-template mlvSpeedDialItemDef let-item let-index="index">
        <span class="custom-item">{{ index }}:{{ item.label }}</span>
      </ng-template>
    </mlv-speed-dial>
  `,
})
class SpeedDialCustomContentHost {
  readonly items: MlvSpeedDialItem[] = [
    { label: 'Add', icon: 'plus' },
    { label: 'Edit', icon: 'pencil' },
  ];
}

describe('MlvSpeedDial', () => {
  let fixture: ComponentFixture<SpeedDialHost>;
  let host: SpeedDialHost;
  let overlayContainerEl: HTMLElement;

  const trigger = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.mlv-speed-dial__trigger');
  const menu = (): HTMLElement | null =>
    overlayContainerEl.querySelector('[role="menu"]');
  const menuItems = (): HTMLButtonElement[] =>
    Array.from(overlayContainerEl.querySelectorAll('[role="menuitem"]'));
  const listItems = (): HTMLElement[] =>
    Array.from(overlayContainerEl.querySelectorAll('.mlv-speed-dial__item'));
  const panel = (): HTMLElement | null =>
    overlayContainerEl.querySelector('.mlv-speed-dial__panel');

  async function openViaClick(): Promise<void> {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeedDialHost, SpeedDialCustomContentHost],
      providers: [
        // Actions resolve their `icon` name at runtime through the Lucide
        // registry, exactly like `mlv-bottom-nav` and `mlv-tree`.
        provideLucideIcons(LucidePlus, LucidePencil, LucideShare, LucideTrash),
      ],
    }).compileComponents();

    overlayContainerEl = TestBed.inject(OverlayContainer).getContainerElement();
    fixture = TestBed.createComponent(SpeedDialHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
    TestBed.inject(MlvRtlService).setRtl(false);
  });

  describe('trigger', () => {
    it('renders a native menu button that is closed by default', () => {
      const button = trigger();
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.hasAttribute('aria-controls')).toBe(false);
      expect(button.getAttribute('aria-label')).toBe('Quick actions');
      expect(menu()).toBeNull();
    });

    it('renders the default plus glyph in the open slot and the close glyph next to it', () => {
      const wrapper = fixture.nativeElement.querySelector(
        '.mlv-speed-dial__trigger-icon',
      ) as HTMLElement;
      expect(
        wrapper.querySelector('.mlv-speed-dial__trigger-glyph--open > svg'),
      ).not.toBeNull();
      const close = wrapper.querySelector(
        '.mlv-speed-dial__trigger-glyph--close > svg',
      );
      expect(close).not.toBeNull();
      expect(close?.getAttribute('aria-hidden')).toBe('true');
    });

    it('flags the icon wrapper while open so the glyphs crossfade', async () => {
      const icon = fixture.nativeElement.querySelector(
        '.mlv-speed-dial__trigger-icon',
      ) as HTMLElement;
      expect(
        icon.classList.contains('mlv-speed-dial__trigger-icon--open'),
      ).toBe(false);

      await openViaClick();
      expect(
        icon.classList.contains('mlv-speed-dial__trigger-icon--open'),
      ).toBe(true);

      await openViaClick();
      expect(
        icon.classList.contains('mlv-speed-dial__trigger-icon--open'),
      ).toBe(false);
    });

    it('reflects disabled on the native button and refuses to open', async () => {
      host.disabled.set(true);
      fixture.detectChanges();

      expect(trigger().hasAttribute('disabled')).toBe(true);

      host.opened.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(false);
      expect(menu()).toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('open / close', () => {
    it('opens on click: menu in the overlay, ARIA wired, model synced', async () => {
      await openViaClick();

      const button = trigger();
      const list = menu();
      expect(host.opened()).toBe(true);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(list).not.toBeNull();
      expect(list?.id).toBeTruthy();
      expect(button.getAttribute('aria-controls')).toBe(list?.id);
      expect(list?.getAttribute('aria-labelledby')).toBe(button.id);
      expect(
        fixture.nativeElement.querySelector('.mlv-speed-dial').classList,
      ).toContain('mlv-speed-dial--open');
      expect(panel()?.classList).toContain('mlv-speed-dial__panel--open');
    });

    it('renders one menuitem per action with label, icon and disabled state', async () => {
      await openViaClick();

      const buttons = menuItems();
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Add',
        'Edit',
        'Share',
        'Delete',
      ]);
      expect(buttons.every((b) => b.getAttribute('tabindex') === '-1')).toBe(
        true,
      );
      expect(buttons.every((b) => b.querySelector('svg') !== null)).toBe(true);
      expect(buttons[1].hasAttribute('disabled')).toBe(true);
      expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
      expect(buttons[0].hasAttribute('disabled')).toBe(false);
    });

    it('closes on a second click and detaches the overlay after the transition', async () => {
      await openViaClick();
      await openViaClick();

      expect(host.opened()).toBe(false);
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(panel()?.classList).not.toContain('mlv-speed-dial__panel--open');

      await wait(320);
      fixture.detectChanges();
      expect(menu()).toBeNull();
    });

    it('opens and closes through the two-way model', async () => {
      host.opened.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(menu()).not.toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      host.opened.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      await wait(320);
      expect(menu()).toBeNull();
    });

    it('reopens during the settle window without recreating the overlay', async () => {
      await openViaClick();
      const first = menu();
      await openViaClick(); // close — exit transition running
      await openViaClick(); // reopen before the overlay is disposed

      expect(host.opened()).toBe(true);
      expect(menu()).toBe(first);
      expect(panel()?.classList).toContain('mlv-speed-dial__panel--open');

      // The cancelled disposal must not fire later and tear the open menu out.
      await wait(320);
      fixture.detectChanges();
      expect(menu()).toBe(first);
      expect(host.opened()).toBe(true);
    });

    it('recreates the overlay on reopen when mask changed meanwhile', async () => {
      await openViaClick();
      await openViaClick(); // close — overlay still attached for the transition
      host.mask.set(true);
      fixture.detectChanges();
      await openViaClick();

      expect(
        overlayContainerEl.querySelector('.mlv-speed-dial__backdrop'),
      ).not.toBeNull();
    });

    it('attaches the overlay when opened is true at first render', async () => {
      const initiallyOpen = TestBed.createComponent(SpeedDialHost);
      initiallyOpen.componentInstance.opened.set(true);
      initiallyOpen.detectChanges();
      await initiallyOpen.whenStable();

      const menus = overlayContainerEl.querySelectorAll('[role="menu"]');
      expect(menus.length).toBe(1);
      expect(
        initiallyOpen.nativeElement
          .querySelector('.mlv-speed-dial__trigger')
          .getAttribute('aria-expanded'),
      ).toBe('true');
      initiallyOpen.destroy();
    });

    it('disposes the overlay at once when destroyed while open', async () => {
      await openViaClick();
      expect(menu()).not.toBeNull();

      fixture.destroy();
      expect(menu()).toBeNull();
    });

    it('closes on a click outside the trigger and the panel', async () => {
      await openViaClick();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(false);
    });

    it('closes on Escape and returns focus to the trigger', async () => {
      await openViaClick();
      menuItems()[0].focus();

      fireKey(menuItems()[0], 'Escape');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(false);
      expect(document.activeElement).toBe(trigger());
    });

    it('closes when disabled flips true while open', async () => {
      await openViaClick();
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(false);
    });
  });

  describe('actions', () => {
    it('runs the item command, emits itemSelect and closes', async () => {
      await openViaClick();
      const [add] = menuItems();
      add.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.commands).toEqual(['add']);
      expect(host.selected).toHaveLength(1);
      expect(host.selected[0].item.label).toBe('Add');
      expect(host.selected[0].index).toBe(0);
      expect(host.opened()).toBe(false);
    });

    it('ignores a disabled item', async () => {
      await openViaClick();
      menuItems()[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.selected).toHaveLength(0);
      expect(host.opened()).toBe(true);
    });
  });

  describe('custom content', () => {
    let customFixture: ComponentFixture<SpeedDialCustomContentHost>;

    beforeEach(async () => {
      customFixture = TestBed.createComponent(SpeedDialCustomContentHost);
      customFixture.detectChanges();
      await customFixture.whenStable();
    });

    it('swaps the default glyph for a projected trigger icon, keeping the close glyph', () => {
      const wrapper = customFixture.nativeElement.querySelector(
        '.mlv-speed-dial__trigger-icon',
      ) as HTMLElement;
      const open = wrapper.querySelector(
        '.mlv-speed-dial__trigger-glyph--open',
      ) as HTMLElement;
      expect(open.querySelector('.custom-trigger')).not.toBeNull();
      expect(open.querySelector('svg')).toBeNull();
      expect(
        wrapper.querySelector('.mlv-speed-dial__trigger-glyph--close > svg'),
      ).not.toBeNull();
    });

    it('renders a projected item template instead of the icon', async () => {
      (
        customFixture.nativeElement.querySelector(
          '.mlv-speed-dial__trigger',
        ) as HTMLButtonElement
      ).click();
      customFixture.detectChanges();
      await customFixture.whenStable();

      const custom = Array.from(
        overlayContainerEl.querySelectorAll('.custom-item'),
      ).map((el) => el.textContent?.trim());
      expect(custom).toEqual(['0:Add', '1:Edit']);
      expect(menuItems()[0].querySelector('svg')).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('ArrowDown on the closed trigger opens and focuses the first enabled item', async () => {
      trigger().focus();
      const event = fireKey(trigger(), 'ArrowDown');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(host.opened()).toBe(true);
      expect(document.activeElement).toBe(menuItems()[0]);
    });

    it('ArrowUp on the closed trigger opens and focuses the last enabled item', async () => {
      trigger().focus();
      fireKey(trigger(), 'ArrowUp');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(menuItems()[3]);
    });

    it('a keyboard activation of the trigger moves focus into the menu', async () => {
      trigger().focus();
      // Enter/Space on a native <button> becomes a click with `detail === 0`.
      trigger().dispatchEvent(
        new MouseEvent('click', { bubbles: true, detail: 0 }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(true);
      expect(document.activeElement).toBe(menuItems()[0]);
    });

    it('arrows cycle through enabled items, skipping disabled ones, with Home/End', async () => {
      await openViaClick();
      const items = menuItems();
      const list = menu() as HTMLElement;
      items[0].focus();

      fireKey(list, 'ArrowDown');
      expect(document.activeElement).toBe(items[2]); // skips disabled "Edit"

      fireKey(list, 'ArrowRight');
      expect(document.activeElement).toBe(items[3]);

      fireKey(list, 'ArrowDown');
      expect(document.activeElement).toBe(items[0]); // wraps

      fireKey(list, 'ArrowUp');
      expect(document.activeElement).toBe(items[3]); // wraps backwards

      fireKey(list, 'ArrowLeft');
      expect(document.activeElement).toBe(items[2]);

      fireKey(list, 'Home');
      expect(document.activeElement).toBe(items[0]);

      fireKey(list, 'End');
      expect(document.activeElement).toBe(items[3]);
    });

    it('Tab closes the menu without being swallowed', async () => {
      await openViaClick();
      menuItems()[0].focus();

      const event = fireKey(menu() as HTMLElement, 'Tab');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(false);
      expect(host.opened()).toBe(false);
      // The actions live in the overlay container at the end of <body>, so
      // focus is parked back on the trigger first: the browser's default Tab
      // then continues from the trigger's place in the page instead of
      // dropping out of the document.
      expect(document.activeElement).toBe(trigger());
    });
  });

  describe('hover trigger (openOn="hover")', () => {
    const HOVER_SLACK_MS = 280;

    function hostEl(): HTMLElement {
      return fixture.nativeElement.querySelector('mlv-speed-dial');
    }

    it('ignores pointerenter in the default click mode', async () => {
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(false);
      expect(menu()).toBeNull();
    });

    it('opens on a mouse pointerenter and closes shortly after the pointer leaves', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();

      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(true);
      expect(menu()).not.toBeNull();
      // Hover must not steal focus from wherever it was.
      expect(document.activeElement).not.toBe(trigger());

      firePointer(hostEl(), 'pointerleave');
      fixture.detectChanges();
      // Grace period first — the pointer may be on its way to an action.
      expect(host.opened()).toBe(true);

      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(false);
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open while the pointer moves from the trigger onto the actions', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();

      const panel = document.querySelector(
        '.mlv-speed-dial__panel',
      ) as HTMLElement;
      firePointer(hostEl(), 'pointerleave');
      firePointer(panel, 'pointerenter');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(true);

      firePointer(panel, 'pointerleave');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(false);
    });

    it('re-entering during the grace period cancels the close', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();

      firePointer(hostEl(), 'pointerleave');
      firePointer(hostEl(), 'pointerenter');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(true);
    });

    it('ignores touch pointers so a tap still toggles through click', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter', 'touch');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(false);

      await openViaClick();
      expect(host.opened()).toBe(true);
      firePointer(hostEl(), 'pointerleave', 'touch');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(true);
    });

    it('does not open on hover while disabled', async () => {
      host.openOn.set('hover');
      host.disabled.set(true);
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(false);
    });

    it('flipping openOn to click during the grace period keeps the dial open', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();

      firePointer(hostEl(), 'pointerleave');
      host.openOn.set('click');
      fixture.detectChanges();
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(true);
      expect(menu()).not.toBeNull();
    });

    it('returns focus to the trigger when the hover close removes a focused action', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();

      fireKey(trigger(), 'ArrowDown');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');

      firePointer(hostEl(), 'pointerleave');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(false);
      expect(document.activeElement).toBe(trigger());
    });

    it('keeps the trigger lifted above the mask until the backdrop is gone', async () => {
      host.openOn.set('hover');
      host.mask.set(true);
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();
      const hostClasses = () =>
        (fixture.nativeElement.querySelector('.mlv-speed-dial') as HTMLElement)
          .classList;
      expect(hostClasses()).toContain('mlv-speed-dial--masked');

      firePointer(hostEl(), 'pointerleave');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(false);
      // The backdrop is still attached during the exit transition — the
      // trigger must stay above it or the pointer cannot come back.
      expect(
        overlayContainerEl.querySelector('.mlv-speed-dial__backdrop'),
      ).not.toBeNull();
      expect(hostClasses()).toContain('mlv-speed-dial--masked');

      await wait(320);
      fixture.detectChanges();
      expect(
        overlayContainerEl.querySelector('.mlv-speed-dial__backdrop'),
      ).toBeNull();
      expect(hostClasses()).not.toContain('mlv-speed-dial--masked');
    });

    it('a click on the trigger while hover-open closes and wins over the pending hover close', async () => {
      host.openOn.set('hover');
      fixture.detectChanges();
      firePointer(hostEl(), 'pointerenter');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(true);

      trigger().click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.opened()).toBe(false);

      // Pointer still on the trigger: leaving must not reopen anything.
      firePointer(hostEl(), 'pointerleave');
      await wait(HOVER_SLACK_MS);
      fixture.detectChanges();
      expect(host.opened()).toBe(false);
    });
  });

  describe('density', () => {
    it('applies the resolved density to the trigger, the panel and every action', async () => {
      host.density.set('tight');
      fixture.detectChanges();
      await openViaClick();

      expect(trigger().classList).toContain('mlv-button--tight');
      expect(panel()?.classList).toContain('mlv--tight');
      for (const action of menuItems()) {
        expect(action.classList).toContain('mlv-button--tight');
      }
    });
  });

  describe('layout', () => {
    it('defaults to the linear-up list and follows direction changes', async () => {
      await openViaClick();
      const list = menu() as HTMLElement;
      expect(list.classList).toContain('mlv-speed-dial__list--linear');
      expect(list.classList).toContain('mlv-speed-dial__list--linear-up');
      expect(panel()?.classList).toContain('mlv-speed-dial__panel--linear');

      host.direction.set('left');
      fixture.detectChanges();
      expect(list.classList).toContain('mlv-speed-dial__list--linear-left');
      expect(list.classList).not.toContain('mlv-speed-dial__list--linear-up');
    });

    it('positions circle items around the trigger as radius multiples', async () => {
      host.type.set('circle');
      fixture.detectChanges();
      await openViaClick();

      const list = menu() as HTMLElement;
      expect(list.classList).toContain('mlv-speed-dial__list--radial');
      expect(panel()?.style.getPropertyValue('--mlv-speed-dial-radius')).toBe(
        '80px',
      );

      const coords = listItems().map((li) => [
        li.style.getPropertyValue('--mlv-speed-dial-item-x'),
        li.style.getPropertyValue('--mlv-speed-dial-item-y'),
      ]);
      // Four items start at the top and go clockwise: top, right, bottom, left.
      expect(coords).toEqual([
        [
          'calc(0 * var(--mlv-speed-dial-radius))',
          'calc(-1 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(0 * var(--mlv-speed-dial-radius))',
          'calc(1 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(-1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
      ]);
    });

    it('spreads semi-circle items across the arc facing the direction', async () => {
      host.type.set('semi-circle');
      host.direction.set('up');
      host.items.set([
        { label: 'A', icon: 'plus' },
        { label: 'B', icon: 'plus' },
        { label: 'C', icon: 'plus' },
      ]);
      fixture.detectChanges();
      await openViaClick();

      const coords = listItems().map((li) => [
        li.style.getPropertyValue('--mlv-speed-dial-item-x'),
        li.style.getPropertyValue('--mlv-speed-dial-item-y'),
      ]);
      // left → top → right, all on or above the trigger's centre line.
      expect(coords).toEqual([
        [
          'calc(-1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(0 * var(--mlv-speed-dial-radius))',
          'calc(-1 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
      ]);
    });

    it('confines quarter-circle items to the named corner', async () => {
      host.type.set('quarter-circle');
      host.direction.set('up-left');
      host.items.set([
        { label: 'A', icon: 'plus' },
        { label: 'B', icon: 'plus' },
      ]);
      fixture.detectChanges();
      await openViaClick();

      const coords = listItems().map((li) => [
        li.style.getPropertyValue('--mlv-speed-dial-item-x'),
        li.style.getPropertyValue('--mlv-speed-dial-item-y'),
      ]);
      expect(coords).toEqual([
        [
          'calc(-1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(0 * var(--mlv-speed-dial-radius))',
          'calc(-1 * var(--mlv-speed-dial-radius))',
        ],
      ]);
    });

    it('mirrors horizontal directions under RTL', async () => {
      TestBed.inject(MlvRtlService).setRtl(true);
      host.direction.set('left');
      fixture.detectChanges();
      await openViaClick();

      // `direction` is logical: `left` means inline-start, which is the
      // right-hand side in RTL.
      const list = menu() as HTMLElement;
      expect(list.classList).toContain('mlv-speed-dial__list--linear-right');
      expect(list.classList).not.toContain('mlv-speed-dial__list--linear-left');

      // Horizontal arrows follow the mirrored reading direction.
      menuItems()[0].focus();
      fireKey(list, 'ArrowLeft');
      expect(document.activeElement).toBe(menuItems()[2]);
      fireKey(list, 'ArrowRight');
      expect(document.activeElement).toBe(menuItems()[0]);

      // Corners mirror too: `up-left` lands on the up-right quadrant.
      host.type.set('quarter-circle');
      host.direction.set('up-left');
      host.items.set([
        { label: 'A', icon: 'plus' },
        { label: 'B', icon: 'plus' },
      ]);
      fixture.detectChanges();
      const coords = listItems().map((li) => [
        li.style.getPropertyValue('--mlv-speed-dial-item-x'),
        li.style.getPropertyValue('--mlv-speed-dial-item-y'),
      ]);
      expect(coords).toEqual([
        [
          'calc(0 * var(--mlv-speed-dial-radius))',
          'calc(-1 * var(--mlv-speed-dial-radius))',
        ],
        [
          'calc(1 * var(--mlv-speed-dial-radius))',
          'calc(0 * var(--mlv-speed-dial-radius))',
        ],
      ]);
    });

    it('centres a single radial item on the arc', async () => {
      host.type.set('semi-circle');
      host.direction.set('down');
      host.items.set([{ label: 'A', icon: 'plus' }]);
      fixture.detectChanges();
      await openViaClick();

      const [li] = listItems();
      expect(li.style.getPropertyValue('--mlv-speed-dial-item-x')).toBe(
        'calc(0 * var(--mlv-speed-dial-radius))',
      );
      expect(li.style.getPropertyValue('--mlv-speed-dial-item-y')).toBe(
        'calc(1 * var(--mlv-speed-dial-radius))',
      );
    });
  });

  describe('stagger', () => {
    it('publishes transitionDelay and forward stagger indices while opening', async () => {
      host.delay.set(45);
      fixture.detectChanges();
      await openViaClick();

      expect(panel()?.style.getPropertyValue('--mlv-speed-dial-stagger')).toBe(
        '45ms',
      );
      expect(
        listItems().map((li) =>
          li.style.getPropertyValue('--mlv-stagger-index'),
        ),
      ).toEqual(['0', '1', '2', '3']);
    });

    it('reverses the stagger order while closing so the farthest item leaves first', async () => {
      await openViaClick();
      await openViaClick();

      expect(
        listItems().map((li) =>
          li.style.getPropertyValue('--mlv-stagger-index'),
        ),
      ).toEqual(['3', '2', '1', '0']);
    });
  });

  describe('mask', () => {
    it('renders no backdrop by default', async () => {
      await openViaClick();
      expect(
        overlayContainerEl.querySelector('.mlv-speed-dial__backdrop'),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.mlv-speed-dial').classList,
      ).not.toContain('mlv-speed-dial--masked');
    });

    it('renders the dimming backdrop and lifts the trigger when mask is on', async () => {
      host.mask.set(true);
      fixture.detectChanges();
      await openViaClick();

      expect(
        overlayContainerEl.querySelector('.mlv-speed-dial__backdrop'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('.mlv-speed-dial').classList,
      ).toContain('mlv-speed-dial--masked');
    });

    it('closes on backdrop click', async () => {
      host.mask.set(true);
      fixture.detectChanges();
      await openViaClick();

      (
        overlayContainerEl.querySelector(
          '.mlv-speed-dial__backdrop',
        ) as HTMLElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.opened()).toBe(false);
    });
  });
});

describe('MlvSpeedDial stylesheet', () => {
  let rules: CSSRule[];

  beforeAll(() => {
    const css = compile(
      fileURLToPath(
        new URL(['.', 'speed-dial.scss'].join('/'), import.meta.url),
      ),
    ).css;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    rules = [...(style.sheet?.cssRules ?? [])];
    style.remove();
  });

  function styleRules(from: CSSRule[] = rules): CSSStyleRule[] {
    return from.filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
  }

  it('staggers every action off the shared delay token and its index', () => {
    const item = styleRules().find(
      ({ selectorText }) => selectorText === '.mlv-speed-dial__item',
    );
    const delay = item?.style.getPropertyValue('transition-delay') ?? '';
    expect(delay).toContain('var(--mlv-speed-dial-stagger');
    expect(delay).toContain('var(--mlv-stagger-index');
  });

  it('drops the stagger entirely under prefers-reduced-motion', () => {
    const reducedMotionRules = rules
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.media.mediaText.includes('prefers-reduced-motion'),
      )
      .flatMap((media) => [...media.cssRules]);
    expect(reducedMotionRules.length).toBeGreaterThan(0);
    const item = styleRules(reducedMotionRules).find(({ selectorText }) =>
      selectorText.includes('.mlv-speed-dial__item'),
    );
    expect(item?.style.getPropertyValue('transition-delay')).toBe('0ms');
    expect(item?.style.getPropertyPriority('transition-delay')).toBe(
      'important',
    );
  });

  it('hides the close glyph while closed and crossfades both glyphs while open', () => {
    const find = (selector: string) =>
      styleRules().find(({ selectorText }) => selectorText === selector);
    const closeGlyph = find('.mlv-speed-dial__trigger-glyph--close');
    expect(closeGlyph?.style.getPropertyValue('opacity')).toBe('0');
    expect(closeGlyph?.style.getPropertyValue('transform')).toContain(
      'scale(0.85)',
    );

    const openGlyphWhileOpen = find(
      '.mlv-speed-dial__trigger-icon--open .mlv-speed-dial__trigger-glyph--open',
    );
    expect(openGlyphWhileOpen?.style.getPropertyValue('opacity')).toBe('0');
    expect(openGlyphWhileOpen?.style.getPropertyValue('transform')).toContain(
      'scale(0.85)',
    );
    expect(openGlyphWhileOpen?.style.getPropertyValue('transform')).toContain(
      'rotate(',
    );

    const closeGlyphWhileOpen = find(
      '.mlv-speed-dial__trigger-icon--open .mlv-speed-dial__trigger-glyph--close',
    );
    expect(closeGlyphWhileOpen?.style.getPropertyValue('opacity')).toBe('1');
    expect(closeGlyphWhileOpen?.style.getPropertyValue('transform')).toContain(
      'scale(1)',
    );

    const glyph = find('.mlv-speed-dial__trigger-glyph');
    const transition = glyph?.style.getPropertyValue('transition') ?? '';
    expect(transition).toContain('opacity');
    expect(transition).toContain('transform');
  });

  it('sizes the trigger glyphs from the button icon token so they follow density', () => {
    // The glyphs sit two wrappers below `.mlv-button__text`, so the button's
    // own `> svg:only-child` density sizing never reaches them.
    const glyphSvg = styleRules().find(
      ({ selectorText }) =>
        selectorText === '.mlv-speed-dial__trigger-glyph > svg',
    );
    expect(glyphSvg?.style.getPropertyValue('inline-size')).toBe(
      'var(--mlv-icon-font-size)',
    );
    expect(glyphSvg?.style.getPropertyValue('block-size')).toBe(
      'var(--mlv-icon-font-size)',
    );
  });

  it('lets pointer events through the pane so the trigger underneath stays clickable', () => {
    // The pane is sized and centred exactly over the trigger; with default
    // pointer-events the trigger's second click would land on the pane and the
    // dial could never be closed from its own button.
    const pane = styleRules().find(
      ({ selectorText }) => selectorText === '.mlv-speed-dial__pane',
    );
    expect(pane?.style.getPropertyValue('pointer-events')).toBe('none');
    // The CDK ships an unlayered `.cdk-overlay-pane { pointer-events: auto }`,
    // which beats any layered rule — only `!important` wins from a layer.
    expect(pane?.style.getPropertyPriority('pointer-events')).toBe('important');
    const item = styleRules().find(
      ({ selectorText }) => selectorText === '.mlv-speed-dial__item',
    );
    expect(item?.style.getPropertyValue('pointer-events')).toBe('auto');
  });

  it('pins the horizontal item order under RTL', () => {
    // `row`/`row-reverse` follow the inline axis, which the overlay pane sets
    // to RTL; without an explicit flip the first action would end up farthest
    // from the trigger.
    // Sass drops the quotes around `rtl` and the CSSOM may add them back —
    // compare quote-insensitively.
    const flexDirection = (selector: string): string | undefined =>
      styleRules()
        .find(
          ({ selectorText }) => selectorText.replace(/["']/g, '') === selector,
        )
        ?.style.getPropertyValue('flex-direction');
    expect(flexDirection('.mlv-speed-dial__list--linear-left')).toBe(
      'row-reverse',
    );
    expect(flexDirection('[dir=rtl] .mlv-speed-dial__list--linear-left')).toBe(
      'row',
    );
    expect(flexDirection('.mlv-speed-dial__list--linear-right')).toBe('row');
    expect(flexDirection('[dir=rtl] .mlv-speed-dial__list--linear-right')).toBe(
      'row-reverse',
    );
  });

  it('paints the mask with the shared overlay token', () => {
    const backdrop = styleRules().find(
      ({ selectorText }) => selectorText === '.mlv-speed-dial__backdrop',
    );
    expect(backdrop?.style.getPropertyValue('background-color')).toBe(
      'var(--mlv-background-overlay)',
    );
  });
});

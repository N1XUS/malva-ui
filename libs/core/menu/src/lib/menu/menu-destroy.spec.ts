import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvListItem } from '@malva-ui/core/list';
import { of } from 'rxjs';
import type { MockInstance } from 'vitest';
import { MlvContextMenuTrigger } from './context-menu-trigger';
import { MlvMenu } from './menu';
import { MlvMenuDataRenderer } from './menu-data-renderer';
import type { MlvMenuItemData } from './menu-data.types';
import { MlvMenuItem } from './menu-item';
import { MlvMenuItemDef } from './menu-item-def';
import { MlvMenuTrigger } from './menu-trigger';

/**
 * #360 — destroying a menu's owner while its overlay is attached (open, or
 * mid-leave) used to run the shared `onClose` from the owner's `DestroyRef`
 * and write to outputs Angular had already destroyed: the popup's `opened`
 * model (`openedChange`) and the trigger's `menuClosed`. Each such emit is
 * dropped with an NG0953 `console.warn`, in production too.
 *
 * Every spec reads the warnings a real `console.warn` would have printed and
 * the overlay panes left behind, so a fix that silenced the warning by leaking
 * the pane — or by swallowing an emit a live listener still needs — goes red.
 */

/** Messages of every NG0953 `console.warn` since the spy was installed. */
function ng0953(spy: MockInstance<typeof console.warn>): string[] {
  return spy.mock.calls
    .map((args) => String(args[0]))
    .filter((message) => message.includes('NG0953'));
}

/** Change detection plus the stability the zoneless scheduler reports. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

/**
 * Ends the panel's leave the way a finished CSS animation does: a bubbling
 * `animationend` dispatched **on the panel itself**, which is the only target
 * `MlvPopup._onPanelAnimationEnd`'s guard admits (#231). jsdom runs no CSS
 * animations, so nothing else would ever complete the leave deterministically.
 */
function finishLeave(overlay: HTMLElement): void {
  const panel = overlay.querySelector('.mlv-popup--leave');
  expect(panel).not.toBeNull();
  panel?.dispatchEvent(new Event('animationend', { bubbles: true }));
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    @if (show()) {
      <button
        [mlvMenuTrigger]="menu"
        (menuClosed)="menuClosed = menuClosed + 1"
      >
        Open
      </button>
      <mlv-menu #menu>
        <mlv-list-item mlvMenuItem (itemClick)="picked = picked + 1">
          Edit
        </mlv-list-item>
      </mlv-menu>
    }
  `,
})
class SameTemplateHost {
  readonly show = signal(true);
  readonly trigger = viewChild(MlvMenuTrigger);
  readonly menu = viewChild(MlvMenu);
  menuClosed = 0;
  picked = 0;
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    @if (show()) {
      <button
        [mlvMenuTrigger]="menu"
        (menuClosed)="menuClosed = menuClosed + 1"
      >
        Open
      </button>
    }
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
    </mlv-menu>
  `,
})
class MenuOutlivesTriggerHost {
  readonly show = signal(true);
  readonly trigger = viewChild(MlvMenuTrigger);
  readonly menu = viewChild.required(MlvMenu);
  menuClosed = 0;
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    @if (show()) {
      <div
        [mlvContextMenuTrigger]="menu"
        (menuClosed)="menuClosed = menuClosed + 1"
      >
        Area
      </div>
      <mlv-menu #menu>
        <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
      </mlv-menu>
    }
  `,
})
class ContextMenuHost {
  readonly show = signal(true);
  readonly trigger = viewChild(MlvContextMenuTrigger);
  menuClosed = 0;
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuDataRenderer,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvMenuTrigger,
    MlvListItem,
  ],
  template: `
    @if (show()) {
      <button [mlvMenuTrigger]="menu">Open</button>
      <mlv-menu #menu label="Files">
        <mlv-menu-data-renderer
          [items]="items"
          [itemDef]="itemDef()"
          mode="menu"
          [parentMenu]="menu"
          [menubar]="null"
        />
        <ng-template mlvMenuItemDef let-item>
          <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
        </ng-template>
      </mlv-menu>
    }
  `,
})
class GeneratedSubmenuHost {
  readonly show = signal(true);
  readonly itemDef = viewChild(MlvMenuItemDef);
  readonly trigger = viewChild(MlvMenuTrigger);
  readonly items: readonly MlvMenuItemData[] = [
    {
      id: 'recent',
      label: 'Recent',
      children: of([{ id: 'today', label: 'Today' }]),
    },
  ];
}

describe('mlv-menu — owner destroyed while the overlay is attached (#360)', () => {
  let overlay: HTMLElement;
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    warn = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    warn.mockRestore();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function panes(): number {
    return overlay.querySelectorAll('.cdk-overlay-pane').length;
  }

  it('destroying trigger and menu while open warns nothing and removes the pane', async () => {
    const fixture = TestBed.createComponent(SameTemplateHost);
    await settle(fixture);
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);
    expect(panes()).toBe(1);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
  });

  it('destroying trigger and menu mid-leave warns nothing and removes the pane', async () => {
    const fixture = TestBed.createComponent(SameTemplateHost);
    await settle(fixture);
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);
    fixture.componentInstance.trigger()?.close();
    await settle(fixture);
    // Mid-leave: the leave keyframes are running and no `animationend` has
    // completed them, so the overlay is still attached.
    expect(overlay.querySelector('.mlv-popup--leave')).not.toBeNull();
    expect(panes()).toBe(1);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
  });

  it('destroying the fixture while open warns nothing and removes the pane', async () => {
    const fixture = TestBed.createComponent(SameTemplateHost);
    await settle(fixture);
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);

    fixture.destroy();

    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
  });

  it('a menu that outlives its trigger is still told the overlay closed', async () => {
    const fixture = TestBed.createComponent(MenuOutlivesTriggerHost);
    await settle(fixture);
    const menu = fixture.componentInstance.menu();
    const popup = menu._popup();
    const openedChanges: boolean[] = [];
    const sub = popup.opened.subscribe((value) => openedChanges.push(value));
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);
    expect(popup.opened()).toBe(true);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    // The popup lives on, so its `opened` model must still be written — and
    // its `openedChange` still emitted — or the next open from another trigger
    // would start from a stale `true`. Only the destroyed trigger's
    // `menuClosed` has nobody left to hear it.
    expect(popup.opened()).toBe(false);
    expect(openedChanges).toEqual([true, false]);
    expect(menu._isOpen()).toBe(false);
    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
    sub.unsubscribe();
  });

  it('destroying a context menu trigger while open warns nothing and removes the pane', async () => {
    const fixture = TestBed.createComponent(ContextMenuHost);
    await settle(fixture);
    fixture.componentInstance.trigger()?.openAt(10, 10);
    await settle(fixture);
    expect(panes()).toBe(1);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
  });

  it('destroying a menu with a generated submenu open warns nothing and removes both panes', async () => {
    const fixture = TestBed.createComponent(GeneratedSubmenuHost);
    await settle(fixture);
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);
    overlay
      .querySelector('[role="menuitem"]')
      ?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await settle(fixture);
    expect(panes()).toBe(2);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    expect(ng0953(warn)).toEqual([]);
    expect(panes()).toBe(0);
  });
});

describe('mlv-menu — a close with the owner alive still emits (#360)', () => {
  let overlay: HTMLElement;
  let warn: MockInstance<typeof console.warn>;
  let fixture: ComponentFixture<SameTemplateHost>;
  let openedChanges: boolean[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    warn = vi.spyOn(console, 'warn');
    fixture = TestBed.createComponent(SameTemplateHost);
    await settle(fixture);
    openedChanges = [];
    fixture.componentInstance
      .menu()
      ?._popup()
      .opened.subscribe((value) => openedChanges.push(value));
    fixture.componentInstance.trigger()?.open();
    await settle(fixture);
  });

  afterEach(() => {
    warn.mockRestore();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  /** Completes the leave and asserts the close reached every live output. */
  async function expectClosedAndEmitted(): Promise<void> {
    finishLeave(overlay);
    await settle(fixture);

    expect(overlay.querySelectorAll('.cdk-overlay-pane').length).toBe(0);
    expect(fixture.componentInstance.menuClosed).toBe(1);
    expect(openedChanges).toEqual([true, false]);
    expect(ng0953(warn)).toEqual([]);
  }

  it('programmatic close', async () => {
    fixture.componentInstance.trigger()?.close();
    await settle(fixture);
    await expectClosedAndEmitted();
  });

  it('Escape on the trigger', async () => {
    fixture.nativeElement
      .querySelector('button')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    await settle(fixture);
    await expectClosedAndEmitted();
  });

  it('a click outside, on the backdrop', async () => {
    const backdrop = overlay.querySelector('.cdk-overlay-backdrop');
    expect(backdrop).not.toBeNull();
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    await expectClosedAndEmitted();
  });

  it('a menu item that acts without destroying the host', async () => {
    (overlay.querySelector('[role="menuitem"]') as HTMLElement).click();
    await settle(fixture);
    expect(fixture.componentInstance.picked).toBe(1);
    await expectClosedAndEmitted();
  });
});

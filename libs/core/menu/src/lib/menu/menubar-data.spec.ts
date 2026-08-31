import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  MlvListItem,
  MlvListItemPrefix,
  MlvListItemSuffix,
} from '@malva-ui/core/list';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Subject } from 'rxjs';
import { MlvMenubar } from './menubar';
import { MlvMenuItem } from './menu-item';
import { MlvMenuItemDef } from './menu-item-def';
import type { MlvMenuItemData, MlvMenubarEntry } from './menu-data.types';

const KEY = { left: 37, right: 39, up: 38, down: 40 };

function fireKey(el: Element, key: string, keyCode: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  el.dispatchEvent(event);
}

type CommandItem = MlvMenuItemData<{ readonly shortcut?: string }>;

@Component({
  imports: [
    MlvMenubar,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvListItem,
    MlvListItemPrefix,
    MlvListItemSuffix,
    MlvSpacer,
  ],
  template: `
    <mlv-menubar aria-label="Commands" [dataSource]="items()">
      <ng-template mlvMenuItemDef let-item let-hasChildren="hasChildren">
        <mlv-list-item mlvMenuItem>
          <span mlvListItemPrefix data-prefix aria-hidden="true">•</span>
          {{ item.label }}
          @if (hasChildren) {
            <mlv-spacer />
            <span mlvListItemSuffix data-suffix aria-hidden="true">›</span>
          }
        </mlv-list-item>
      </ng-template>
    </mlv-menubar>
  `,
})
class DataMenubarHost {
  readonly firstChildren = new Subject<CommandItem[]>();
  readonly items = signal<MlvMenubarEntry<CommandItem>[]>([
    {
      id: 'file',
      label: 'File',
      children: this.firstChildren,
    },
    { kind: 'divider', id: 'divider' },
    {
      id: 'edit',
      label: 'Edit',
      children: new Subject<CommandItem[]>().asObservable(),
    },
  ]);
}

describe('MlvMenubar reactive data mode', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataMenubarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function createHost() {
    const fixture = TestBed.createComponent(DataMenubarHost);
    fixture.detectChanges();
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.css('.mlv-menubar'))
      .nativeElement as HTMLElement;
    return {
      fixture,
      bar,
      items: Array.from(bar.querySelectorAll<HTMLElement>('[role="menuitem"]')),
    };
  }

  async function finishOpen(
    fixture: ReturnType<typeof TestBed.createComponent>,
  ) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders data items and root-level dividers without registering dividers', () => {
    const { bar, items } = createHost();

    expect(items.map((item) => item.textContent?.trim())).toEqual([
      '• File ›',
      '• Edit ›',
    ]);
    expect(bar.querySelectorAll('.mlv-menubar__divider')).toHaveLength(1);
    const divider = bar.querySelector('.mlv-menubar__divider') as HTMLElement;
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider.hasAttribute('tabindex')).toBe(false);
    expect(items[0].querySelector('[data-prefix]')).not.toBeNull();
    expect(items[0].querySelector('[data-suffix]')).not.toBeNull();
  });

  it('moves roving focus across data items while skipping the divider', () => {
    const { fixture, items } = createHost();

    expect(items[0].getAttribute('tabindex')).toBe('0');
    fireKey(items[0], 'ArrowRight', KEY.right);
    fixture.detectChanges();

    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('opens a lazy root submenu without a backdrop and shows its loader', async () => {
    const { fixture, items } = createHost();
    const file = items[0];

    file.click();
    await finishOpen(fixture);

    expect(file.getAttribute('aria-expanded')).toBe('true');
    expect(overlayContainerEl.querySelector('mlv-loader')).not.toBeNull();
    expect(
      overlayContainerEl.querySelector('.cdk-overlay-backdrop'),
    ).toBeNull();

    fixture.componentInstance.firstChildren.next([
      { id: 'new', label: 'New file', data: { shortcut: 'N' } },
    ]);
    await finishOpen(fixture);

    expect(overlayContainerEl.querySelector('mlv-loader')).toBeNull();
    expect(
      overlayContainerEl
        .querySelector('[role="menuitem"]')
        ?.textContent?.trim(),
    ).toBe('• New file');
  });

  it('opens a root submenu with ArrowDown and restores focus on Escape', async () => {
    const { fixture, items } = createHost();
    const file = items[0];

    fireKey(file, 'ArrowDown', KEY.down);
    await finishOpen(fixture);
    fixture.componentInstance.firstChildren.next([
      { id: 'new', label: 'New file' },
    ]);
    await finishOpen(fixture);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    fireKey(panel, 'Escape', 27);
    await finishOpen(fixture);
    overlayContainerEl
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await finishOpen(fixture);

    expect(document.activeElement).toBe(file);
    expect(file.getAttribute('aria-expanded')).toBe('false');
  });
});

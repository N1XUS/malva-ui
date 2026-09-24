import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  ElementRef,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { MlvResizeObserverFactory } from '@malva-ui/cdk/utils';
import {
  MlvPopupContainer,
  POPUP_DETACH_WATCHDOG_MS,
} from '@malva-ui/core/popup';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvItemsMoreItem } from '../item/item';
import {
  MlvItemsMoreHiddenDef,
  MlvItemsMoreTriggerDef,
  MlvItemsMoreVisibleDef,
} from '../items-more.directives';
import { MlvItemsMoreTrigger } from '../items-more-trigger';
import { MlvItemsMore } from './items-more';

// ─── Geometry ───────────────────────────────────────────────────────────────
//
// jsdom performs no layout, so every box the component measures is stubbed.
// The row's width comes from `rowWidth`, which a spec may make a function of
// the row itself to model a feedback loop. Every other box reads its width
// from the nearest `[data-w]` at or below it — the templates below put one on
// each rendered button — so an item's width is written in its own markup and a
// spec changes it the way a real label change would: by re-rendering.

let rowWidth: (row: HTMLElement) => number;

function rect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
}

function stubGeometry(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains('mlv-items-more__row')) {
        const width = rowWidth(this);
        return rect(width, width > 0 ? 40 : 0);
      }
      const sized = this.matches('[data-w]')
        ? this
        : this.querySelector<HTMLElement>('[data-w]');
      const width = sized ? Number(sized.dataset['w']) : 0;
      return rect(width, width > 0 ? 32 : 0);
    },
  );

  // Component stylesheets are not applied under jsdom, so the row's gap has to
  // be supplied the same way its width is.
  const original = globalThis.getComputedStyle.bind(globalThis);
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
    (element: Element, pseudo?: string | null) => {
      if (!element.classList.contains('mlv-items-more__row')) {
        return original(element, pseudo);
      }
      return {
        columnGap: '8px',
        paddingInlineStart: '0px',
        paddingInlineEnd: '0px',
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '0px',
      } as CSSStyleDeclaration;
    },
  );
}

// ─── ResizeObserver double ──────────────────────────────────────────────────
//
// Faithful in the two ways the component depends on: `observe()` on a new
// target delivers an initial notification, and `observe()` on a live target
// does not. It delivers synchronously, which lets a spec drive a resize
// without a frame.

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly targets = new Set<Element>();

  constructor(private readonly _callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    if (this.targets.has(target)) return;
    this.targets.add(target);
    this._callback([{ target } as ResizeObserverEntry], this);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  /** Notifies every observer watching `target`; returns how many were. */
  static notify(target: Element): number {
    let delivered = 0;
    for (const instance of FakeResizeObserver.instances) {
      if (!instance.targets.has(target)) continue;
      instance._callback([{ target } as ResizeObserverEntry], instance);
      delivered++;
    }
    return delivered;
  }
}

@Injectable()
class FakeResizeObserverFactory extends MlvResizeObserverFactory {
  override create(callback: ResizeObserverCallback): ResizeObserver {
    return new FakeResizeObserver(callback);
  }
}

// ─── Host ───────────────────────────────────────────────────────────────────

interface HostItem {
  id: string;
  width: number;
  pinned?: boolean;
  noHidden?: boolean;
}

@Component({
  imports: [
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTriggerDef,
    MlvItemsMoreTrigger,
  ],
  template: `
    <input class="outside" aria-label="Elsewhere" />
    <mlv-items-more #more ariaLabel="More actions">
      @for (item of items(); track item.id) {
        <mlv-items-more-item [pinned]="item.pinned ?? false">
          <ng-template mlvItemsMoreVisible>
            <button
              type="button"
              class="row-button"
              [attr.data-id]="item.id"
              [attr.data-w]="item.width"
            >
              {{ item.id }}
            </button>
          </ng-template>
          @if (!item.noHidden) {
            <ng-template mlvItemsMoreHidden>
              <button
                type="button"
                class="panel-button"
                [attr.data-id]="item.id"
              >
                {{ item.id }}
              </button>
            </ng-template>
          }
        </mlv-items-more-item>
      }
      @if (inRowTrigger()) {
        <ng-template mlvItemsMoreTriggerDef let-count>
          <button
            type="button"
            class="more-button"
            mlvItemsMoreTrigger
            aria-label="Show more"
            [attr.data-w]="triggerWidth()"
          >
            +{{ count }}
          </button>
        </ng-template>
      }
    </mlv-items-more>
    @if (externalTrigger()) {
      <button
        type="button"
        class="external-trigger"
        [mlvItemsMoreTrigger]="more"
      >
        More
      </button>
    }
  `,
})
class HostComponent {
  readonly items = signal<HostItem[]>([
    { id: 'a', width: 100 },
    { id: 'b', width: 100 },
    { id: 'c', width: 100 },
  ]);
  readonly inRowTrigger = signal(true);
  readonly externalTrigger = signal(false);
  readonly triggerWidth = signal(40);
  readonly more = viewChild.required(MlvItemsMore);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let fixture: ComponentFixture<HostComponent>;
let host: HostComponent;

async function settle(): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function root(): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function row(): HTMLElement {
  const element = root().querySelector<HTMLElement>('.mlv-items-more__row');
  if (!element) throw new Error('row not rendered');
  return element;
}

/** Ids of the items rendered in the row, in rendered order. */
function rowIds(): string[] {
  return Array.from(
    row().querySelectorAll<HTMLElement>('.mlv-items-more__slot .row-button'),
  ).map((button) => button.dataset['id'] ?? '');
}

function inRowTrigger(): HTMLElement | null {
  return row().querySelector<HTMLElement>('.more-button');
}

function probe(): HTMLElement | null {
  return root().querySelector<HTMLElement>('.mlv-items-more__probe');
}

/** Resizes the row and delivers the notification the platform would. */
async function resizeRow(width: number): Promise<void> {
  rowWidth = () => width;
  expect(FakeResizeObserver.notify(row())).toBe(1);
  await settle();
}

async function create(
  configure?: (host: HostComponent) => void,
): Promise<void> {
  fixture = TestBed.createComponent(HostComponent);
  host = fixture.componentInstance;
  configure?.(host);
  await settle();
}

describe('MlvItemsMore', () => {
  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    rowWidth = () => 1000;
    stubGeometry();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvResizeObserverFactory,
          useClass: FakeResizeObserverFactory,
        },
        // CDK's checker asks for layout jsdom does not have, so nothing would
        // ever count as tabbable; a button does, which is all these hosts hold.
        {
          provide: InteractivityChecker,
          useValue: {
            isFocusable: (el: HTMLElement) => el.tagName === 'BUTTON',
            isTabbable: (el: HTMLElement) => el.tagName === 'BUTTON',
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
    vi.restoreAllMocks();
  });

  describe('fit', () => {
    it('renders every item and no in-row trigger while everything fits', async () => {
      await create();

      expect(rowIds()).toEqual(['a', 'b', 'c']);
      expect(inRowTrigger()).toBeNull();
      expect(host.more().hiddenCount()).toBe(0);
    });

    it('withholds the suffix that does not fit, reserving the measured trigger', async () => {
      rowWidth = () => 250;
      await create();

      // Budget 250 − (40 + 8): one item fits, two do not.
      expect(rowIds()).toEqual(['a']);
      expect(host.more().hiddenItems().length).toBe(2);
      expect(inRowTrigger()?.textContent?.trim()).toBe('+2');
    });

    it('keeps a row that fits exactly, gaps included', async () => {
      rowWidth = () => 316;
      await create();

      expect(rowIds()).toEqual(['a', 'b', 'c']);
    });

    it('does not withhold an item when the real trigger is narrower than any guess would be', async () => {
      // Two items plus a 20px trigger and gaps: 100 + 8 + 100 + 8 + 20 = 236.
      rowWidth = () => 236;
      await create((h) => h.triggerWidth.set(20));

      expect(rowIds()).toEqual(['a', 'b']);
    });

    it('reserves nothing for a trigger that is not in the row', async () => {
      // Two items and their gap are 208; with no in-row trigger both fit.
      rowWidth = () => 208;
      await create((h) => {
        h.inRowTrigger.set(false);
        h.externalTrigger.set(true);
      });

      expect(rowIds()).toEqual(['a', 'b']);
      expect(host.more().hiddenCount()).toBe(1);
      expect(probe()).toBeNull();
    });

    it('never withholds an item with no hidden template, or a pinned one', async () => {
      rowWidth = () => 150;
      await create((h) =>
        h.items.set([
          { id: 'a', width: 100 },
          { id: 'b', width: 40, noHidden: true },
          { id: 'c', width: 40, pinned: true },
        ]),
      );

      expect(rowIds()).toEqual(['b', 'c']);
      expect(host.more().hiddenItems().length).toBe(1);
    });

    it('orders an item that registers late by where it was written', async () => {
      await create();

      host.items.set([
        { id: 'a', width: 100 },
        { id: 'late', width: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
      ]);
      await settle();

      expect(rowIds()).toEqual(['a', 'late', 'b', 'c']);
    });

    it('re-derives the split when an item leaves', async () => {
      rowWidth = () => 250;
      await create();
      expect(rowIds()).toEqual(['a']);

      host.items.set([
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ]);
      await settle();

      expect(rowIds()).toEqual(['a', 'b']);
      expect(inRowTrigger()).toBeNull();
    });
  });

  describe('measurement', () => {
    it('commits nothing until the trigger has a measured width', async () => {
      rowWidth = () => 250;
      await create((h) => h.triggerWidth.set(0));

      // Overflowing, but a hide now would have to guess the trigger's width.
      expect(rowIds()).toEqual(['a', 'b', 'c']);

      const probeBox = probe()?.firstElementChild as HTMLElement;
      host.triggerWidth.set(40);
      await settle();
      expect(FakeResizeObserver.notify(probeBox)).toBe(1);
      await settle();

      expect(rowIds()).toEqual(['a']);
    });

    it('commits nothing while any item is unmeasured', async () => {
      rowWidth = () => 150;
      await create((h) =>
        h.items.set([
          { id: 'a', width: 100 },
          { id: 'b', width: 0 },
          { id: 'c', width: 100 },
        ]),
      );

      expect(rowIds()).toEqual(['a', 'b', 'c']);
    });

    it('measures the trigger from an inert, off-flow probe while nothing is withheld', async () => {
      await create();

      const element = probe();
      expect(element).not.toBeNull();
      expect(element?.hasAttribute('inert')).toBe(true);
      expect(element?.querySelector('.more-button')?.textContent?.trim()).toBe(
        '+1',
      );
    });

    it('re-measures an item whose own content changes width', async () => {
      rowWidth = () => 350;
      await create();
      expect(rowIds()).toEqual(['a', 'b', 'c']);

      host.items.update((items) =>
        items.map((item) => (item.id === 'a' ? { ...item, width: 150 } : item)),
      );
      await settle();
      const slotA = row().querySelector('[data-id="a"]')?.parentElement;
      expect(FakeResizeObserver.notify(slotA as Element)).toBe(1);
      await settle();

      // 150 + 8 + 100 + 8 + 100 = 366 no longer fits 350.
      expect(rowIds()).toEqual(['a', 'b']);
    });

    it('does not collapse a row that has no box', async () => {
      await create();

      await resizeRow(0);

      expect(rowIds()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('resizing', () => {
    it('withholds as soon as the row shrinks, without waiting for a debounce', async () => {
      await create();

      await resizeRow(250);

      expect(rowIds()).toEqual(['a']);
    });

    it('returns items only after the reveal debounce', async () => {
      rowWidth = () => 250;
      await create();

      await resizeRow(1000);
      expect(rowIds()).toEqual(['a']);

      await wait(90);
      await settle();
      expect(rowIds()).toEqual(['a', 'b', 'c']);
    });

    it('cancels a pending reveal when the row shrinks again', async () => {
      rowWidth = () => 250;
      await create();

      await resizeRow(1000);
      await resizeRow(250);
      await wait(90);
      await settle();

      expect(rowIds()).toEqual(['a']);
    });

    it('stops a reveal that undoes itself from repeating', async () => {
      // Returning the last item removes the trigger, and in this model that
      // makes the row 20px narrower — the shape of a page scrollbar appearing
      // because the row got taller. At 320px everything fits; at 300px it does
      // not. Without a guard this flips on every frame for ever.
      rowWidth = (r) => (r.querySelector('.more-button') ? 320 : 300);
      await create();
      expect(rowIds()).toEqual(['a', 'b']);

      const splits: number[] = [];
      for (let cycle = 0; cycle < 3; cycle++) {
        FakeResizeObserver.notify(row());
        await settle();
        await wait(90);
        await settle();
        splits.push(host.more().hiddenCount());
        // What the platform would deliver after the reveal's own render.
        FakeResizeObserver.notify(row());
        await settle();
        splits.push(host.more().hiddenCount());
      }

      // The first reveal is allowed and undone once; after that it holds.
      expect(splits.slice(2)).toEqual([1, 1, 1, 1]);
      expect(rowIds()).toEqual(['a', 'b']);
    });

    it('lets the guarded reveal through once the row is wider than where it failed', async () => {
      rowWidth = (r) => (r.querySelector('.more-button') ? 320 : 300);
      await create();
      FakeResizeObserver.notify(row());
      await settle();
      await wait(90);
      await settle();
      FakeResizeObserver.notify(row());
      await settle();
      expect(host.more().hiddenCount()).toBe(1);

      await resizeRow(400);
      await wait(90);
      await settle();

      expect(rowIds()).toEqual(['a', 'b', 'c']);
    });
  });

  // A split that removes the focused box from the row destroys the element the
  // keyboard user is standing on, and the browser drops focus to `<body>`. The
  // row puts it back — only when it was dropped, and onto whatever took the
  // removed box's place in the tab order.
  describe('focus across a split', () => {
    function rowButton(id: string): HTMLElement {
      const element = row().querySelector<HTMLElement>(
        `.row-button[data-id="${id}"]`,
      );
      if (!element) throw new Error(`row button ${id} not rendered`);
      return element;
    }

    /** What `document.activeElement` is, as a string a failure can print. */
    function focused(): string {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return 'body';
      if (active.classList.contains('more-button')) {
        return `trigger:${active.textContent?.trim() ?? ''}`;
      }
      return active.dataset['id'] ?? active.className;
    }

    it('moves focus to the trigger when a resize withholds the focused item', async () => {
      await create();
      rowButton('c').focus();

      await resizeRow(250);

      expect(rowIds()).toEqual(['a']);
      expect(focused()).toBe('trigger:+2');
      expect(document.activeElement).toBe(inRowTrigger());
    });

    it('moves focus to a trigger that was already in the row', async () => {
      // Budget 300 − (40 + 8): `a` and `b` fit, `c` does not.
      rowWidth = () => 300;
      await create();
      expect(rowIds()).toEqual(['a', 'b']);
      rowButton('b').focus();

      await resizeRow(250);

      expect(rowIds()).toEqual(['a']);
      expect(focused()).toBe('trigger:+2');
    });

    it('moves focus to the trigger when a structure change withholds the focused item', async () => {
      // Three items fit exactly; a fourth written before `c` pushes `b` and
      // `c` out in the render that adds it, with no resize notification.
      rowWidth = () => 316;
      await create();
      rowButton('c').focus();

      host.items.set([
        { id: 'a', width: 100 },
        { id: 'late', width: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
      ]);
      await settle();

      expect(rowIds()).toEqual(['a', 'late']);
      expect(focused()).toBe('trigger:+2');
    });

    it('lands on the item before it when the row has no trigger of its own', async () => {
      await create((h) => {
        h.inRowTrigger.set(false);
        h.externalTrigger.set(true);
        h.items.set([
          { id: 'a', width: 100 },
          { id: 'b', width: 100 },
          { id: 'c', width: 100, pinned: true },
        ]);
      });
      rowButton('b').focus();

      // `c` is pinned, so `b` is the one out; `a` before it and `c` after it
      // both stay, and the one before wins.
      await resizeRow(208);

      expect(rowIds()).toEqual(['a', 'c']);
      expect(focused()).toBe('a');
    });

    it('lands on the item after it when nothing before it stays', async () => {
      await create((h) => {
        h.inRowTrigger.set(false);
        h.externalTrigger.set(true);
        h.items.set([
          { id: 'a', width: 100 },
          { id: 'b', width: 100, pinned: true },
        ]);
      });
      rowButton('a').focus();

      // `b` is pinned and reserved first, so `a` is the one out and nothing
      // stays before it: the closest item after it is the only target.
      await resizeRow(150);

      expect(rowIds()).toEqual(['b']);
      expect(focused()).toBe('b');
    });

    it('leaves focus on an item the split keeps', async () => {
      await create();
      rowButton('a').focus();

      await resizeRow(250);

      expect(rowIds()).toEqual(['a']);
      expect(focused()).toBe('a');
    });

    it('leaves focus outside the row where it is', async () => {
      await create();
      const outside = root().querySelector<HTMLInputElement>('.outside');
      outside?.focus();

      await resizeRow(250);

      expect(rowIds()).toEqual(['a']);
      expect(document.activeElement).toBe(outside);
    });

    it('leaves focus that moved elsewhere before the withheld item left', async () => {
      await create();
      rowButton('c').focus();

      // The split commits in the notification; the row re-renders later.
      rowWidth = () => 250;
      FakeResizeObserver.notify(row());
      const outside = root().querySelector<HTMLInputElement>('.outside');
      outside?.focus();
      await settle();

      expect(rowIds()).toEqual(['a']);
      expect(document.activeElement).toBe(outside);
    });

    it('lands on the last returned item when a reveal removes the focused trigger', async () => {
      rowWidth = () => 250;
      await create();
      inRowTrigger()?.focus();
      expect(focused()).toBe('trigger:+2');

      await resizeRow(1000);
      await wait(90);
      await settle();

      expect(rowIds()).toEqual(['a', 'b', 'c']);
      expect(inRowTrigger()).toBeNull();
      expect(focused()).toBe('c');
    });
  });

  describe('panel', () => {
    function panel(): HTMLElement | null {
      return document.body.querySelector<HTMLElement>('.mlv-items-more__panel');
    }

    async function openFromTrigger(): Promise<HTMLElement> {
      const trigger = inRowTrigger();
      if (!trigger) throw new Error('no in-row trigger');
      trigger.click();
      await settle();
      return trigger;
    }

    it('lists the withheld items in a named group, in declaration order', async () => {
      rowWidth = () => 250;
      await create();

      await openFromTrigger();

      const element = panel();
      expect(element?.getAttribute('role')).toBe('group');
      expect(element?.getAttribute('aria-label')).toBe('More actions');
      expect(
        Array.from(
          element?.querySelectorAll<HTMLElement>('.panel-button') ?? [],
        ).map((b) => b.dataset['id']),
      ).toEqual(['b', 'c']);
    });

    it('reflects the panel state on the trigger', async () => {
      rowWidth = () => 250;
      await create();
      const trigger = inRowTrigger() as HTMLElement;

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.hasAttribute('aria-controls')).toBe(false);
      expect(trigger.hasAttribute('aria-haspopup')).toBe(false);

      await openFromTrigger();

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(host.more().panelId);
      expect(panel()?.id).toBe(host.more().panelId);
    });

    it('returns focus to the trigger when the panel closes with focus inside it', async () => {
      rowWidth = () => 250;
      await create();
      const trigger = await openFromTrigger();

      panel()?.querySelector<HTMLElement>('.panel-button')?.focus();
      host.more().closePanel();
      await settle();
      await wait(POPUP_DETACH_WATCHDOG_MS + 50);
      await settle();

      expect(document.activeElement).toBe(trigger);
    });

    it('leaves focus alone when it has already moved somewhere deliberate', async () => {
      rowWidth = () => 250;
      await create();
      await openFromTrigger();

      const outside = root().querySelector<HTMLInputElement>('.outside');
      outside?.focus();
      host.more().closePanel();
      await settle();
      await wait(POPUP_DETACH_WATCHDOG_MS + 50);
      await settle();

      expect(document.activeElement).toBe(outside);
    });

    it('closes when everything returns to the row, landing focus on the last item', async () => {
      rowWidth = () => 250;
      await create();
      await openFromTrigger();
      panel()?.querySelector<HTMLElement>('.panel-button')?.focus();

      await resizeRow(1000);
      await wait(90);
      await settle();
      await wait(POPUP_DETACH_WATCHDOG_MS + 50);
      await settle();

      expect(host.more().panelOpened()).toBe(false);
      expect(inRowTrigger()).toBeNull();
      // The trigger that opened the panel is gone; the item that came back
      // last is where focus lands.
      expect(
        (document.activeElement as HTMLElement | null)?.dataset['id'],
      ).toBe('c');
    });

    // The panel's container keeps a stack of registered anchors (#230). The
    // row registers the opener on every open, and its in-row trigger is
    // re-created each time items are withheld again, so a row that never
    // withdrew a registration would pin every trigger it ever rendered.
    describe('anchor registration', () => {
      function container(): MlvPopupContainer {
        return fixture.debugElement.query(By.directive(MlvPopupContainer))
          .componentInstance as MlvPopupContainer;
      }

      /**
       * Whether the container holds `el` anywhere in its own state — arrays,
       * plain objects and `ElementRef`s, a few levels deep. It does not know
       * the field a registration lives in, so it reads the same before and
       * after #230. Class instances other than `ElementRef` are not entered:
       * `ViewContainerRef` and the services reach the whole view tree.
       */
      function holds(value: unknown, el: Element, depth: number): boolean {
        if (value === el) return true;
        if (depth === 0 || value === null || typeof value !== 'object') {
          return false;
        }
        if (value instanceof ElementRef) return value.nativeElement === el;
        if (Array.isArray(value)) {
          return value.some((entry) => holds(entry, el, depth - 1));
        }
        const proto: unknown = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) return false;
        return Object.values(value).some((entry) =>
          holds(entry, el, depth - 1),
        );
      }

      function retains(el: Element): boolean {
        return Object.values(container()).some((value) => holds(value, el, 3));
      }

      async function closeAndSettle(): Promise<void> {
        host.more().closePanel();
        await settle();
        await wait(POPUP_DETACH_WATCHDOG_MS + 50);
        await settle();
      }

      it('releases the opener once the panel has closed', async () => {
        rowWidth = () => 250;
        await create();
        const trigger = await openFromTrigger();
        // Precondition: the probe sees the registration the open made.
        expect(retains(trigger)).toBe(true);

        await closeAndSettle();

        expect(host.more().panelOpened()).toBe(false);
        expect(retains(trigger)).toBe(false);
      });

      it('keeps a single registration when a second opener takes over an open panel', async () => {
        rowWidth = () => 250;
        await create((h) => h.externalTrigger.set(true));
        const inRow = await openFromTrigger();
        const external = root().querySelector<HTMLElement>('.external-trigger');
        if (!external) throw new Error('external trigger not rendered');

        host.more().openPanel(new ElementRef(external));
        await settle();

        expect(host.more().panelOpened()).toBe(true);
        expect(retains(external)).toBe(true);
        expect(retains(inRow)).toBe(false);

        await closeAndSettle();

        expect(retains(external)).toBe(false);
      });
    });
  });

  describe('external trigger', () => {
    it('drives the row it is bound to from outside it', async () => {
      rowWidth = () => 208;
      await create((h) => {
        h.inRowTrigger.set(false);
        h.externalTrigger.set(true);
      });
      const trigger = root().querySelector<HTMLElement>('.external-trigger');

      expect(trigger?.getAttribute('aria-expanded')).toBe('false');
      trigger?.click();
      await settle();

      expect(host.more().panelOpened()).toBe(true);
      expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('lifecycle', () => {
    it('stops observing when destroyed', async () => {
      await create();
      const observer = FakeResizeObserver.instances[0];
      expect(observer.targets.size).toBeGreaterThan(0);

      fixture.destroy();

      expect(observer.targets.size).toBe(0);
    });

    it('observes the row, every rendered item, and the probe', async () => {
      await create();
      const observer = FakeResizeObserver.instances[0];

      expect(observer.targets.has(row())).toBe(true);
      for (const slot of Array.from(
        row().querySelectorAll('.mlv-items-more__slot'),
      )) {
        expect(observer.targets.has(slot)).toBe(true);
      }
      expect(observer.targets.has(probe()?.firstElementChild as Element)).toBe(
        true,
      );
    });

    it('stops observing a slot whose item was withheld', async () => {
      await create();
      const observer = FakeResizeObserver.instances[0];
      const slotC = row().querySelector('[data-id="c"]')
        ?.parentElement as Element;
      expect(observer.targets.has(slotC)).toBe(true);

      await resizeRow(250);

      expect(observer.targets.has(slotC)).toBe(false);
      expect(
        observer.targets.has(inRowTrigger()?.parentElement as Element),
      ).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations while everything fits', async () => {
      await create();
      await expectNoAxeViolations(root());
    });

    it('has no axe violations with items withheld', async () => {
      rowWidth = () => 250;
      await create();
      await expectNoAxeViolations(root());
    });

    it('has no axe violations with the panel open', async () => {
      rowWidth = () => 250;
      await create();
      inRowTrigger()?.click();
      await settle();

      await expectNoAxeViolations(document.body);
    });
  });
});

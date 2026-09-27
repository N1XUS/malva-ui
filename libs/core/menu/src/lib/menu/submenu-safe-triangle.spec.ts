import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvListItem } from '@malva-ui/core/list';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuTrigger } from './menu-trigger';

/**
 * The submenu safe triangle, end to end (#345).
 *
 * Drives the real `MlvPopupService` / CDK connected strategy with measured
 * geometry stubbed in, so CDK itself decides which side each submenu opens on
 * — `SUBMENU_POSITIONS` is `right-start` (inline end) falling back to
 * `left-start` (inline start) — and the pointer then walks the diagonal the
 * triangle exists for: from the parent row toward a *lower* row of the
 * submenu, across the sibling rows below the parent. The same rules are pinned
 * for a submenu opened from the keyboard, and for a third level, whose aim
 * must stay within its own parent panel.
 *
 * jsdom performs no layout, so every rect is stubbed: the root menu rows, the
 * submenu pane at the position CDK puts it, and the viewport
 * (`documentElement.clientWidth` / `clientHeight`, which CDK's fit test reads).
 * Each placement asserts the arrow edge first, so a stub that no longer makes
 * CDK choose the intended side fails loudly instead of testing the wrong case.
 */

const VIEWPORT = { width: 1024, height: 768 };
const ROW = { width: 200, height: 36 };
/** Root menu rows, top to bottom. Appearance owns the submenu under test. */
const ROW_LABELS = ['Profile', 'Appearance', 'Language', 'Density'] as const;
const FIRST_ROW_TOP = 64;
/** `SUBMENU_POSITIONS`' `offsetX` — the gap between a row and its submenu. */
const GAP = 8;
/** Three rows plus padding, top-aligned with the Appearance row. */
const PANEL = { width: 200, height: 120 };
/** How long the controller waits before a scheduled hover close fires. */
const GRACE_MS = 150;

type RowLabel = (typeof ROW_LABELS)[number];

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <button [mlvMenuTrigger]="rootMenu">Settings</button>
    </div>

    <!-- Declared outside the scope, as a page-level menu normally is. -->
    <mlv-menu #rootMenu label="Settings">
      <mlv-list-item mlvMenuItem>Profile</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="themeMenu"
        [isSubmenuTrigger]="true"
        >Appearance</mlv-list-item
      >
      <mlv-list-item mlvMenuItem>Language</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="densityMenu"
        [isSubmenuTrigger]="true"
        >Density</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #themeMenu label="Appearance">
      <mlv-list-item mlvMenuItem>Light</mlv-list-item>
      <mlv-list-item mlvMenuItem>Dark</mlv-list-item>
      <mlv-list-item mlvMenuItem>System</mlv-list-item>
    </mlv-menu>

    <mlv-menu #densityMenu label="Density">
      <mlv-list-item mlvMenuItem>Compact</mlv-list-item>
      <mlv-list-item mlvMenuItem>Comfortable</mlv-list-item>
    </mlv-menu>
  `,
})
class SafeTriangleHost {
  readonly themeMenu = viewChild.required<MlvMenu>('themeMenu');
  readonly densityMenu = viewChild.required<MlvMenu>('densityMenu');

  readonly scopeDir = signal<'ltr' | 'rtl'>('ltr');
}

/** Rows of the nested host's Appearance submenu, top to bottom. */
const THEME_LABELS = ['Light', 'Dark', 'Accent', 'Font', 'System'] as const;
/** Rows of the nested host's third-level Accent submenu. */
const ACCENT_ROW_COUNT = 3;

type ThemeLabel = (typeof THEME_LABELS)[number];

/**
 * Three levels: the Appearance submenu owns two submenu triggers of its own,
 * Accent and Font, so a pointer aiming at Accent's panel crosses Font the way
 * a pointer aiming at Appearance's panel crosses Density one level up.
 */
@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <button [mlvMenuTrigger]="rootMenu">Settings</button>
    </div>

    <mlv-menu #rootMenu label="Settings">
      <mlv-list-item mlvMenuItem>Profile</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="themeMenu"
        [isSubmenuTrigger]="true"
        >Appearance</mlv-list-item
      >
      <mlv-list-item mlvMenuItem>Language</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="densityMenu"
        [isSubmenuTrigger]="true"
        >Density</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #themeMenu label="Appearance">
      <mlv-list-item mlvMenuItem>Light</mlv-list-item>
      <mlv-list-item mlvMenuItem>Dark</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="accentMenu"
        [isSubmenuTrigger]="true"
        >Accent</mlv-list-item
      >
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="fontMenu"
        [isSubmenuTrigger]="true"
        >Font</mlv-list-item
      >
      <mlv-list-item mlvMenuItem>System</mlv-list-item>
    </mlv-menu>

    <mlv-menu #accentMenu label="Accent">
      <mlv-list-item mlvMenuItem>Blue</mlv-list-item>
      <mlv-list-item mlvMenuItem>Green</mlv-list-item>
      <mlv-list-item mlvMenuItem>Orange</mlv-list-item>
    </mlv-menu>

    <mlv-menu #fontMenu label="Font">
      <mlv-list-item mlvMenuItem>Serif</mlv-list-item>
      <mlv-list-item mlvMenuItem>Sans</mlv-list-item>
    </mlv-menu>

    <mlv-menu #densityMenu label="Density">
      <mlv-list-item mlvMenuItem>Compact</mlv-list-item>
      <mlv-list-item mlvMenuItem>Comfortable</mlv-list-item>
    </mlv-menu>
  `,
})
class NestedSubmenuHost {
  readonly themeMenu = viewChild.required<MlvMenu>('themeMenu');
  readonly accentMenu = viewChild.required<MlvMenu>('accentMenu');
  readonly fontMenu = viewChild.required<MlvMenu>('fontMenu');
  readonly densityMenu = viewChild.required<MlvMenu>('densityMenu');

  readonly scopeDir = signal<'ltr' | 'rtl'>('ltr');
}

/**
 * One way the submenu can end up relative to its row. `rowLeft` is what makes
 * CDK choose: a row near the viewport's inline-end edge leaves no room for
 * `right-start`, so the `left-start` fallback wins.
 */
interface Placement {
  readonly name: string;
  readonly dir: 'ltr' | 'rtl';
  readonly rowLeft: number;
  /** The physical side CDK is expected to put the panel on. */
  readonly panelSide: 'left' | 'right';
}

const PLACEMENTS: readonly Placement[] = [
  {
    name: 'LTR, opening toward inline-end (physical right)',
    dir: 'ltr',
    rowLeft: 0,
    panelSide: 'right',
  },
  {
    name: 'LTR, `left-start` fallback toward inline-start (physical left)',
    dir: 'ltr',
    rowLeft: 800,
    panelSide: 'left',
  },
  {
    name: 'scoped [dir="rtl"], opening toward inline-end (physical left)',
    dir: 'rtl',
    rowLeft: 800,
    panelSide: 'left',
  },
  {
    name: 'scoped [dir="rtl"], `left-start` fallback toward inline-start (physical right)',
    dir: 'rtl',
    rowLeft: 0,
    panelSide: 'right',
  },
];

function rowTop(label: RowLabel): number {
  return FIRST_ROW_TOP + ROW_LABELS.indexOf(label) * ROW.height;
}

/** The rect CDK is expected to give the Appearance submenu pane. */
function panelRect(placement: Placement): DOMRect {
  const left =
    placement.panelSide === 'right'
      ? placement.rowLeft + ROW.width + GAP
      : placement.rowLeft - GAP - PANEL.width;
  return DOMRect.fromRect({
    x: left,
    y: rowTop('Appearance'),
    width: PANEL.width,
    height: PANEL.height,
  });
}

/**
 * Converts a distance travelled toward the panel into a viewport x, so one
 * path serves both sides: `d = 0` is the row edge facing away from the panel,
 * `d = ROW.width` the edge facing it, and `d > ROW.width` the gap.
 */
function towardPanel(placement: Placement, d: number): number {
  return towardSide(placement.panelSide, placement.rowLeft, d);
}

/** {@link towardPanel} for a row starting at `rowLeft`, facing `side`. */
function towardSide(
  side: Placement['panelSide'],
  rowLeft: number,
  d: number,
): number {
  return side === 'right' ? rowLeft + d : rowLeft + ROW.width - d;
}

/**
 * Stubs every rect CDK and the controller read. Must run before the submenu
 * opens: CDK measures the row (origin) and the pane when it first positions.
 */
function stubGeometry(placement: Placement): void {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    VIEWPORT.width,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    VIEWPORT.height,
  );
  const measure = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const text = this.textContent?.trim() ?? '';
      if (
        this.classList.contains('cdk-overlay-pane') &&
        text.includes('Light')
      ) {
        return panelRect(placement);
      }
      if (
        this.getAttribute('role') === 'menuitem' &&
        (ROW_LABELS as readonly string[]).includes(text)
      ) {
        return DOMRect.fromRect({
          x: placement.rowLeft,
          y: rowTop(text as RowLabel),
          width: ROW.width,
          height: ROW.height,
        });
      }
      return measure.call(this);
    },
  );
}

/**
 * The nested host's Appearance pane: where {@link panelRect} puts it, tall
 * enough for its five rows, which it stacks from its top edge.
 */
function themePaneRect(placement: Placement): DOMRect {
  return DOMRect.fromRect({
    x: panelRect(placement).x,
    y: rowTop('Appearance'),
    width: PANEL.width,
    height: THEME_LABELS.length * ROW.height,
  });
}

function themeRowTop(label: ThemeLabel): number {
  return rowTop('Appearance') + THEME_LABELS.indexOf(label) * ROW.height;
}

/**
 * The rect CDK is expected to give the third-level Accent pane: top-aligned
 * with the Accent row, on the same side of the Appearance pane as that pane is
 * of the root menu — which holds for the inline-end placements only.
 */
function accentPaneRect(placement: Placement): DOMRect {
  const theme = themePaneRect(placement);
  return DOMRect.fromRect({
    x:
      placement.panelSide === 'right'
        ? theme.right + GAP
        : theme.left - GAP - PANEL.width,
    y: themeRowTop('Accent'),
    width: PANEL.width,
    height: ACCENT_ROW_COUNT * ROW.height,
  });
}

/** {@link stubGeometry} for the nested host. */
function stubNestedGeometry(placement: Placement): void {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    VIEWPORT.width,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    VIEWPORT.height,
  );
  const measure = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const text = this.textContent?.trim() ?? '';
      if (this.classList.contains('cdk-overlay-pane')) {
        if (text.includes('Light')) return themePaneRect(placement);
        if (text.includes('Blue')) return accentPaneRect(placement);
      }
      if (this.getAttribute('role') === 'menuitem') {
        if ((ROW_LABELS as readonly string[]).includes(text)) {
          return DOMRect.fromRect({
            x: placement.rowLeft,
            y: rowTop(text as RowLabel),
            width: ROW.width,
            height: ROW.height,
          });
        }
        if ((THEME_LABELS as readonly string[]).includes(text)) {
          return DOMRect.fromRect({
            x: themePaneRect(placement).x,
            y: themeRowTop(text as ThemeLabel),
            width: ROW.width,
            height: ROW.height,
          });
        }
      }
      return measure.call(this);
    },
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('submenu safe triangle (#345)', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SafeTriangleHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    overlayContainer.ngOnDestroy();
  });

  function row(label: RowLabel | ThemeLabel): HTMLElement {
    return Array.from(
      overlayContainerEl.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === label) as HTMLElement;
  }

  /** The open submenu pane holding the row labelled `label`. */
  function paneWith(label: string): HTMLElement {
    const pane = Array.from(
      overlayContainerEl.querySelectorAll('.cdk-overlay-pane'),
    ).find((candidate) => candidate.textContent?.includes(label));
    if (!pane) throw new Error(`No open pane holding ${label}`);
    return pane as HTMLElement;
  }

  function trigger(
    fixture: ComponentFixture<unknown>,
    label: RowLabel | ThemeLabel,
  ): MlvMenuTrigger {
    const ref = fixture.debugElement
      .queryAll(By.directive(MlvMenuTrigger))
      .find((candidate) =>
        (candidate.nativeElement as HTMLElement).textContent?.includes(label),
      );
    if (!ref) throw new Error(`No menu trigger labelled ${label}`);
    return ref.injector.get(MlvMenuTrigger);
  }

  /**
   * Opens the root menu, then the Appearance submenu — by hover, or from the
   * keyboard with the inline-end arrow key — and returns a pointer driver for
   * the chosen placement.
   */
  async function openAppearance(
    placement: Placement,
    via: 'hover' | 'keyboard' = 'hover',
  ) {
    stubGeometry(placement);
    const fixture = TestBed.createComponent(SafeTriangleHost);
    fixture.componentInstance.scopeDir.set(placement.dir);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    if (via === 'hover') {
      row('Appearance').dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true }),
      );
    } else {
      // The inline-end arrow, which is ArrowLeft inside the RTL scope.
      row('Appearance').dispatchEvent(
        new KeyboardEvent('keydown', {
          key: placement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight',
          bubbles: true,
        }),
      );
    }
    fixture.detectChanges();
    await fixture.whenStable();
    // Hover-intent tracking is installed from a `setTimeout(0)`, and so is the
    // keyboard path's move of focus into the submenu.
    await wait(0);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    expect(host.themeMenu()._isOpen()).toBe(true);
    // Guards the premise: the stubs made CDK put the panel where the case says.
    // The arrow rides the panel edge facing the row.
    expect(host.themeMenu()._popup().arrowEdge()).toBe(
      placement.panelSide === 'right' ? 'left' : 'right',
    );

    const closeTheme = vi.spyOn(trigger(fixture, 'Appearance'), 'close');
    let current: HTMLElement | null = null;

    /**
     * Moves the pointer to `(d, y)` over `target`, firing the boundary events
     * a browser sends first when the target changes: leave, then enter, then
     * the move itself.
     */
    function move(target: HTMLElement, d: number, y: number): void {
      const clientX = towardPanel(placement, d);
      if (target !== current) {
        current?.dispatchEvent(
          new MouseEvent('mouseleave', {
            clientX,
            clientY: y,
            relatedTarget: target,
          }),
        );
        target.dispatchEvent(
          new MouseEvent('mouseenter', {
            clientX,
            clientY: y,
            relatedTarget: current,
          }),
        );
        current = target;
      }
      target.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX, clientY: y }),
      );
    }

    /** Enters the submenu pane, which ends triangle tracking. */
    function enterPanel(): void {
      const pane = paneWith('Light');
      current?.dispatchEvent(
        new MouseEvent('mouseleave', { relatedTarget: pane }),
      );
      current = pane;
      pane.dispatchEvent(new MouseEvent('mouseenter', { relatedTarget: null }));
    }

    return { fixture, host, closeTheme, move, enterPanel };
  }

  /**
   * Opens Settings → Appearance → Accent in the nested host the way a pointer
   * does: hover Appearance, move into its pane, hover Accent. Returns a driver
   * working in viewport coordinates, with the pointer resting on Accent.
   */
  async function openAccent(placement: Placement) {
    stubNestedGeometry(placement);
    const fixture = TestBed.createComponent(NestedSubmenuHost);
    fixture.componentInstance.scopeDir.set(placement.dir);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    row('Appearance').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    await wait(0);
    fixture.detectChanges();

    // Reaching the Appearance pane ends that submenu's triangle and its entry
    // in the aim registry.
    const themePane = paneWith('Light');
    row('Appearance').dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: themePane }),
    );
    themePane.dispatchEvent(
      new MouseEvent('mouseenter', { relatedTarget: row('Appearance') }),
    );
    row('Accent').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    await wait(0);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    expect(host.themeMenu()._isOpen()).toBe(true);
    expect(host.accentMenu()._isOpen()).toBe(true);
    // Premise: CDK put both panes on the side the case says.
    const facingEdge = placement.panelSide === 'right' ? 'left' : 'right';
    expect(host.themeMenu()._popup().arrowEdge()).toBe(facingEdge);
    expect(host.accentMenu()._popup().arrowEdge()).toBe(facingEdge);

    const closeTheme = vi.spyOn(trigger(fixture, 'Appearance'), 'close');
    const closeAccent = vi.spyOn(trigger(fixture, 'Accent'), 'close');
    let current: HTMLElement = row('Accent');

    /**
     * Moves the pointer to viewport `(x, y)` over `target`. When the target
     * changes it first fires `mouseleave` on the previous target and on every
     * element in `leaving` (a pane the pointer crosses out of), then
     * `mouseenter` on the new one — the order a browser uses.
     */
    function move(
      target: HTMLElement,
      x: number,
      y: number,
      leaving: readonly HTMLElement[] = [],
    ): void {
      if (target !== current) {
        for (const left of [current, ...leaving]) {
          left.dispatchEvent(
            new MouseEvent('mouseleave', {
              clientX: x,
              clientY: y,
              relatedTarget: target,
            }),
          );
        }
        target.dispatchEvent(
          new MouseEvent('mouseenter', {
            clientX: x,
            clientY: y,
            relatedTarget: current,
          }),
        );
        current = target;
      }
      target.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }),
      );
    }

    /** Viewport x at distance `d` across a row of the Appearance pane. */
    function themeX(d: number): number {
      return towardSide(placement.panelSide, themePaneRect(placement).left, d);
    }

    return {
      host,
      closeTheme,
      closeAccent,
      move,
      themeX,
      themePane,
      accentPane: paneWith('Blue'),
    };
  }

  describe.each(PLACEMENTS)('$name', (placement) => {
    it('keeps the submenu open while a diagonal crosses a sibling toward a lower row', async () => {
      const { host, closeTheme, move, enterPanel } =
        await openAppearance(placement);
      if (placement.dir === 'rtl') {
        // The mirror comes from the trigger's scope, not the document.
        expect(rtlService.direction()).toBe('ltr');
      }

      // Aiming at "System", the panel's third row: the straight line from the
      // parent row runs across "Language" before it reaches the gap.
      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 172, 138);
      expect(closeTheme).not.toHaveBeenCalled();
      move(row('Language'), 185, 150);
      move(row('Language'), 198, 162);
      move(document.body, 204, 168);
      enterPanel();
      await wait(GRACE_MS + 100);

      expect(closeTheme).not.toHaveBeenCalled();
      expect(host.themeMenu()._isOpen()).toBe(true);
    });

    it('keeps the submenu open across the gap, clear of every sibling', async () => {
      const { closeTheme, move } = await openAppearance(placement);

      // Straight at the panel, never over another row. Before #345 the side
      // was hard-coded to the right, so a panel on the left read every step
      // toward it as moving away and closed after the grace period.
      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 190, 118);
      move(document.body, 202, 118);
      move(document.body, 205, 120);
      await wait(GRACE_MS + 100);

      expect(closeTheme).not.toHaveBeenCalled();
    });

    it('closes at once when a move onto a sibling leaves the triangle', async () => {
      const { closeTheme, move } = await openAppearance(placement);

      // Straight down onto the next row: no travel toward the panel at all.
      move(row('Appearance'), 160, 127);
      move(row('Language'), 160, 150);

      expect(closeTheme).toHaveBeenCalledTimes(1);
    });

    it('closes after the grace period when the pointer rests on a sibling inside the triangle', async () => {
      const { closeTheme, move } = await openAppearance(placement);

      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 172, 138);
      expect(closeTheme).not.toHaveBeenCalled();

      // Stopping over the sibling is the one thing a pointer on its way to
      // the panel does not do.
      await wait(GRACE_MS + 50);

      expect(closeTheme).toHaveBeenCalledTimes(1);
    });

    it('holds a sibling submenu shut while the pointer crosses its row inside the triangle', async () => {
      const { host, closeTheme, move, enterPanel } =
        await openAppearance(placement);

      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 170, 140);
      move(row('Language'), 180, 158);
      // "Density" owns a submenu of its own. Opening it here would stack a
      // second panel over the lower rows the pointer is heading for.
      move(row('Density'), 188, 174);
      expect(host.densityMenu()._isOpen()).toBe(false);
      move(row('Density'), 196, 186);
      move(document.body, 203, 196);
      enterPanel();
      await wait(GRACE_MS + 100);

      expect(host.densityMenu()._isOpen()).toBe(false);
      expect(closeTheme).not.toHaveBeenCalled();
    });

    it('opens the held sibling submenu once the pointer rests on its row', async () => {
      const { host, closeTheme, move } = await openAppearance(placement);

      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 170, 140);
      move(row('Language'), 180, 158);
      move(row('Density'), 188, 174);
      expect(host.densityMenu()._isOpen()).toBe(false);

      await wait(GRACE_MS + 50);

      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(true);
    });

    it('drops the held sibling submenu once the pointer moves off its row', async () => {
      const { host, closeTheme, move } = await openAppearance(placement);

      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 170, 140);
      move(row('Language'), 180, 158);
      move(row('Density'), 188, 174);
      // Off the menu altogether, below the panel: outside the triangle and
      // off the held row.
      move(document.body, 150, 260);
      await wait(GRACE_MS + 50);

      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(false);
    });

    it('hands over to the sibling submenu at once when a move onto it leaves the triangle', async () => {
      const { host, closeTheme, move } = await openAppearance(placement);

      move(row('Appearance'), 160, 127);
      move(row('Density'), 160, 190);

      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(true);
    });

    it('hands a keyboard-opened submenu over to a sibling submenu the pointer lands on', async () => {
      const { host, closeTheme, move } = await openAppearance(
        placement,
        'keyboard',
      );
      // Premise: the keyboard path, which moves focus into the submenu.
      expect(paneWith('Light').contains(document.activeElement)).toBe(true);

      // The pointer arrives from outside the menu and never crossed the
      // Appearance row, so there is no apex and nothing to protect: the
      // submenu hands over at once rather than stacking Density beside it.
      move(row('Density'), 160, 190);

      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(true);
    });

    it('holds a sibling submenu inside the triangle of a keyboard-opened submenu, then hands over after a rest', async () => {
      const { host, closeTheme, move } = await openAppearance(
        placement,
        'keyboard',
      );

      move(row('Appearance'), 150, 118);
      move(row('Appearance'), 160, 127);
      move(row('Language'), 170, 140);
      move(row('Language'), 180, 158);
      move(row('Density'), 188, 174);
      expect(host.densityMenu()._isOpen()).toBe(false);
      expect(closeTheme).not.toHaveBeenCalled();

      await wait(GRACE_MS + 50);

      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(true);
    });
  });

  /**
   * Three levels, over the inline-end placements only. In a fallback
   * placement CDK tries the inline end again for the third level, which puts
   * that pane back over the root menu, and the second-level stubs here do not
   * model it. Direction is still covered: the RTL case is scoped.
   */
  describe.each(
    PLACEMENTS.filter(
      (placement) =>
        placement.panelSide === (placement.dir === 'ltr' ? 'right' : 'left'),
    ),
  )('three levels, $name', (placement) => {
    it('keeps a third-level submenu open while a diagonal crosses a second-level sibling submenu, and holds that sibling shut', async () => {
      const {
        host,
        closeTheme,
        closeAccent,
        move,
        themeX,
        themePane,
        accentPane,
      } = await openAccent(placement);

      // Aiming at "Orange", the Accent pane's third row: the straight line from
      // the Accent row runs across "Font", which owns a submenu of its own.
      move(row('Accent'), themeX(150), 190);
      move(row('Accent'), themeX(160), 199);
      move(row('Font'), themeX(172), 210);
      expect(closeAccent).not.toHaveBeenCalled();
      expect(host.fontMenu()._isOpen()).toBe(false);
      move(row('Font'), themeX(185), 222);
      move(row('Font'), themeX(198), 234);
      // Into the gap, out of the Appearance pane, then into the Accent pane.
      move(document.body, themeX(204), 240, [themePane]);
      move(accentPane, themeX(212), 244);

      expect(host.themeMenu()._isOpen()).toBe(true);
      expect(closeTheme).not.toHaveBeenCalled();
      await wait(GRACE_MS + 100);

      // Appearance's own fate once the pointer left its pane for its child's
      // is a separate, pre-existing defect and is not pinned here.
      expect(closeAccent).not.toHaveBeenCalled();
      expect(host.accentMenu()._isOpen()).toBe(true);
      expect(host.fontMenu()._isOpen()).toBe(false);
    });

    it('does not let a third-level triangle hold a first-level sibling submenu', async () => {
      const { host, closeTheme, closeAccent, move, themeX, themePane } =
        await openAccent(placement);

      move(row('Accent'), themeX(150), 190);
      move(row('Accent'), themeX(160), 199);
      // Back out of the Appearance pane onto Density, a submenu trigger of the
      // root menu, away from the Accent pane. Accent aims from the Appearance
      // panel's registry entry; the root panel has none, so Density opens.
      move(row('Density'), towardPanel(placement, 150), 190, [themePane]);

      expect(host.densityMenu()._isOpen()).toBe(true);

      await wait(GRACE_MS + 50);

      // Both levels the pointer left close after the grace period.
      expect(closeAccent).toHaveBeenCalledTimes(1);
      expect(closeTheme).toHaveBeenCalledTimes(1);
      expect(host.densityMenu()._isOpen()).toBe(true);
    });
  });
});

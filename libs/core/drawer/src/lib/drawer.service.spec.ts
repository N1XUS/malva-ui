import type { Type } from '@angular/core';
import {
  ApplicationRef,
  Component,
  getDebugNode,
  reflectComponentType,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

import { MlvDrawerBody } from './drawer-body';
import { MlvDrawerHeader } from './drawer-header';
import { MlvDrawerSection } from './drawer-section/drawer-section';
import { MlvDrawerSections } from './drawer-sections/drawer-sections';
import type { MlvDrawerConfig } from './drawer.service';
import { MlvDrawerService } from './drawer.service';
import { MlvDrawerPanel } from './drawer/drawer-panel';

@Component({
  selector: 'test-drawer-content',
  template: `
    <div class="mlv-scrollbar__viewport" tabindex="0">
      <input class="drawer-field" />
    </div>
  `,
})
class DrawerContentComponent {}

@Component({
  selector: 'test-drawer-sheet',
  imports: [MlvDrawerHeader, MlvDrawerBody],
  template: `
    <mlv-drawer-header title="Details" />
    <div mlvDrawerBody><button class="inside" type="button">In</button></div>
  `,
})
class SheetContentComponent {}

@Component({
  selector: 'test-drawer-sections',
  imports: [
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDrawerSection,
    MlvDrawerSections,
  ],
  template: `
    <mlv-drawer-header title="Settings" level="4">
      <mlv-drawer-sections />
    </mlv-drawer-header>
    <div mlvDrawerBody>
      <section mlvDrawerSection id="general" label="General">General</section>
      <section mlvDrawerSection id="access" label="Access">Access</section>
    </div>
  `,
})
class SectionsContentComponent {}

/**
 * `MlvDrawerSectionsService` builds an `IntersectionObserver` from a render
 * hook; jsdom ships none. Nothing here reads what it observes.
 */
class NoopIntersectionObserver {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}

/** A resizable bottom sheet, the shape every declarative-only feature needs. */
const SHEET: MlvDrawerConfig = {
  position: 'bottom',
  size: '20rem',
  resizable: true,
  snapPoints: [30, 60],
  defaultSnap: 60,
};

describe('MlvDrawerService', () => {
  let service: MlvDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvDrawerService);
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.mlv-drawer');
  }

  function finishClose(): void {
    panel()?.dispatchEvent(new Event('animationend'));
  }

  function pane(): HTMLElement | null {
    return document.querySelector('.cdk-overlay-pane');
  }

  /**
   * Selector of the component whose host `element` is, or `null` when no
   * Angular component renders it. A string, so a failure prints no instance.
   */
  function hostComponentSelector(element: HTMLElement | null): string | null {
    const instance: unknown = element
      ? getDebugNode(element)?.componentInstance
      : null;
    if (!instance) return null;
    const type = (instance as object).constructor as Type<unknown>;
    return reflectComponentType(type)?.selector ?? null;
  }

  /**
   * The height the drawer panel component binds onto its host, or `null` when
   * `element` is not one. jsdom's CSSOM drops a `height: var(…)` declaration,
   * so `style.height` reads `''` for every resizable panel and cannot show
   * which snap it opened at; the binding can. A string, so a failure prints no
   * instance.
   */
  function boundPanelHeight(element: HTMLElement | null): string | null {
    const instance: unknown = element
      ? getDebugNode(element)?.componentInstance
      : null;
    if (!(instance instanceof MlvDrawerPanel)) return null;
    return instance['_dimensions']()['height'] ?? null;
  }

  it('clamps a fixed size to the viewport', () => {
    const ref = service.open(DrawerContentComponent, { size: '36rem' });

    expect(panel()?.style.width).toBe('36rem');
    expect(panel()?.style.maxWidth).toBe('100dvw');
    expect(panel()?.style.maxHeight).toBe('100dvh');

    ref.close();
    finishClose();
  });

  it('folds a configured maxSize into the viewport clamp', () => {
    const ref = service.open(DrawerContentComponent, {
      position: 'bottom',
      size: '40rem',
      maxSize: '24rem',
    });

    expect(panel()?.style.height).toBe('40rem');
    expect(panel()?.style.maxHeight).toBe('min(24rem, 100dvh)');
    expect(panel()?.style.maxWidth).toBe('100dvw');

    ref.close();
    finishClose();
  });

  it('focuses content past the scroll viewport rather than the viewport itself', async () => {
    const ref = service.open(DrawerContentComponent);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(
      document.querySelector('.drawer-field'),
    );

    ref.close();
    finishClose();
  });

  describe('animationend target', () => {
    /**
     * A bubbling `animationend`, the way a finished CSS animation dispatches
     * one. A plain `Event`: jsdom implements neither `AnimationEvent` nor CSS
     * animations, and the listener under test reads only `target`.
     */
    function animationEnd(): Event {
      return new Event('animationend', { bubbles: true });
    }

    /** Drawer panes attached to the live CDK overlay container right now. */
    function attachedPanes(): NodeListOf<HTMLElement> {
      return TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelectorAll<HTMLElement>('.mlv-drawer');
    }

    it("ignores an animationend bubbling out of its content during the leave, then disposes on the pane's own at once", () => {
      const ref = service.open(DrawerContentComponent);
      expect(attachedPanes()).toHaveLength(1);
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      // Synchronous from here on, well inside MlvDrawerRef's 350ms fallback.
      const child = attachedPanes()[0].querySelector('.drawer-field');
      expect(child).not.toBeNull();
      child?.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(1);
      expect(closed).toBe(false);

      // …and the pane's own leave still disposes at once. A `once: true`
      // listener spent on the ignored event above would leave the close to the
      // 350ms fallback, which cannot fire inside this synchronous test.
      attachedPanes()[0].dispatchEvent(animationEnd());
      expect(attachedPanes()).toHaveLength(0);
      expect(closed).toBe(true);
    });

    it('disposes the drawer for an animationend raised by the pane itself', () => {
      const ref = service.open(DrawerContentComponent);
      const pane = attachedPanes()[0];
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      pane.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(0);
      expect(closed).toBe(true);
    });
  });

  describe('renders through the drawer component shell', () => {
    it('renders the panel as the shell component inside the pane, not on the pane itself', () => {
      const ref = service.open(DrawerContentComponent);

      expect(panel()).not.toBeNull();
      expect(panel()).not.toBe(pane());
      expect(panel()?.parentElement).toBe(pane());
      // The component that owns `drawer.scss`: the stylesheet arrives with
      // the panel instead of depending on an `<mlv-drawer>` elsewhere.
      expect(hostComponentSelector(panel())).toBe('div[mlvDrawerPanel]');

      ref.close();
      finishClose();
    });

    it('puts the dialog semantics and the fallback name on the panel, not the pane', () => {
      const ref = service.open(DrawerContentComponent);

      expect(panel()?.getAttribute('role')).toBe('dialog');
      expect(panel()?.getAttribute('aria-modal')).toBe('true');
      expect(panel()?.getAttribute('aria-label')).toBe('Drawer');
      expect(pane()?.hasAttribute('role')).toBe(false);
      expect(pane()?.hasAttribute('aria-label')).toBe(false);

      ref.close();
      finishClose();
    });

    it('plays the enter and the leave on the panel, not the pane', () => {
      const ref = service.open(DrawerContentComponent);

      expect(panel()?.classList.contains('mlv-drawer--enter')).toBe(true);
      expect(pane()?.classList.contains('mlv-drawer--enter')).toBe(false);

      ref.close();
      expect(panel()?.classList.contains('mlv-drawer--leave')).toBe(true);
      expect(pane()?.classList.contains('mlv-drawer--leave')).toBe(false);

      finishClose();
    });

    it('renders the resize handle for resizable: true and opens at defaultSnap', () => {
      const ref = service.open(SheetContentComponent, SHEET);

      expect(panel()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
      expect(panel()?.classList.contains('mlv-drawer--resizable')).toBe(true);
      expect(boundPanelHeight(panel())).toBe(
        'var(--mlv-drawer-current-size, 60dvh)',
      );
      // The configured `size` is not what a resizable drawer opens at.
      expect(panel()?.style.height).not.toBe(SHEET.size);
      expect(panel()?.style.maxHeight).toBe('100dvh');

      ref.close();
      finishClose();
    });

    it('hands snapPoints to the handle', () => {
      const ref = service.open(SheetContentComponent, SHEET);
      const handle = panel()?.querySelector<HTMLElement>('[role="separator"]');

      handle?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );

      // Home snaps to the smallest snap point: 30% of the viewport.
      expect(panel()?.style.getPropertyValue('--mlv-drawer-current-size')).toBe(
        `${(window.innerHeight * 30) / 100}px`,
      );

      ref.close();
      finishClose();
    });

    it('closes the drawer when the handle dismisses it', () => {
      const ref = service.open(SheetContentComponent, SHEET);
      let closing = false;
      ref.beforeClose().subscribe(() => (closing = true));
      const handle = panel()?.querySelector<HTMLElement>('[role="separator"]');

      // jsdom lays nothing out, so the panel measures 0 and one step down
      // reaches zero size — the keyboard form of swipe-to-dismiss.
      handle?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(closing).toBe(true);
      finishClose();
    });

    it('keeps the header one content host below the panel, where the merged band reaches it', async () => {
      const ref = service.open(SheetContentComponent, SHEET);
      await TestBed.inject(ApplicationRef).whenStable();

      const header = panel()?.querySelector('.mlv-drawer__header');
      expect(
        header?.parentElement?.classList.contains('mlv-drawer__content'),
      ).toBe(true);
      expect(header?.parentElement?.parentElement).toBe(panel());

      ref.close();
      finishClose();
    });

    it('has no axe violations for an open resizable sheet with a header', async () => {
      const ref = service.open(SheetContentComponent, SHEET);
      await TestBed.inject(ApplicationRef).whenStable();

      await expectNoAxeViolations(document.body);

      ref.close();
      finishClose();
    });

    describe('with section content', () => {
      beforeEach(() => {
        vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('opens [mlvDrawerSection] and mlv-drawer-sections content against one sections service', async () => {
        let error = '';
        let ref: ReturnType<MlvDrawerService['open']> | null = null;
        try {
          ref = service.open(SectionsContentComponent);
          await TestBed.inject(ApplicationRef).whenStable();
        } catch (caught) {
          error = caught instanceof Error ? caught.message : String(caught);
        }

        expect(error).toBe('');
        expect(
          document.querySelectorAll('.mlv-drawer .mlv-drawer-section__heading'),
        ).toHaveLength(2);
        // The navigator renders its trigger only once it sees both sections,
        // i.e. the sections and the navigator share one service instance.
        expect(
          document.querySelector('.mlv-drawer mlv-drawer-sections button'),
        ).not.toBeNull();

        ref?.close();
        finishClose();
      });
    });
  });
});
